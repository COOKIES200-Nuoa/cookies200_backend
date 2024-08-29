const { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand } = require("@aws-sdk/client-athena");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const region = process.env.REGION;
const resultBucket = process.env.RESULT_BUCKET;
const updateFunctionArn = process.env.UPDATE_FUNC_ARN;

const athenaClient = new AthenaClient({ region: region });
const lambdaClient = new LambdaClient({ region: region });

exports.createAthenaTable = async (event) => {

    const catalogName = process.env.CATALOG_NAME;
    const databaseName = process.env.DATABASE_NAME;
    const tableName = process.env.TABLE_NAME;
    const dataSourceBucket = process.env.DATA_BUCKET;

    const query = 
        `
        CREATE OR REPLACE VIEW latest_partition_data AS
        SELECT * 
        FROM data
        WHERE partition_0 = (SELECT partition_0 FROM "${catalogName}"."${databaseName}"."${tableName}" ORDER BY partition_0 DESC LIMIT 1);
        `
    ;

    const queryExecutionCommand = new StartQueryExecutionCommand({
        QueryString: query,
        QueryExecutionContext: { Database: databaseName },
        ResultConfiguration: { OutputLocation: `s3://${resultBucket}/athena-results/` },
    });

    try {
        const athenaClientRes = await athenaClient.send(queryExecutionCommand);
        const queryId = athenaClientRes.QueryExecutionId;
        const result = await waitForQuery(queryId);
        return result;
    } catch (err) {
        console.error(`Error executing query: ${query}`, err);
        throw err;
    }
    
};

async function waitForQuery(queryId) {
    const getQueryCommand = new GetQueryExecutionCommand({
        QueryExecutionId: queryId,
    });

    const MAX_RETRIES = 100;
    const RETRY_DELAY_MS = 5000;

    for (let retryCount = 0; retryCount < MAX_RETRIES; retryCount++) {
        try {
            const queryStatusRes = await athenaClient.send(getQueryCommand);
            const queryStatus = queryStatusRes.QueryExecution.Status.State;
            console.log(`Query status: ${queryStatus}`);

            if (queryStatus === 'SUCCEEDED') {
                await invokeUpdate(); // Query succeeded, invoke update function
                return {
                    statusCode: 200,
                    body: 'Athena tables created successfully, QuickSight datasets update initiated.',
                };
            } else if (queryStatus === 'FAILED' || queryStatus === 'CANCELLED') {
                return { // Query failed/cancelled
                    statusCode: 400,
                    body: "Athena tables unsuccessfully created.",
                };
            }

            // If query is still running, wait and retry
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        } catch (error) {
            console.error('Error getting query execution status: ', error);
            throw error;
        }
    }

    throw new Error('Query exceeded maximum retries');
};

async function invokeUpdate() {

    const invokeUpdate = new InvokeCommand({
        FunctionName: updateFunctionArn,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
    });
    try {
        const lambdaClientRes = await lambdaClient.send(invokeUpdate);
        
        // Handle response
        if (lambdaClientRes.StatusCode === 200) {
            console.log('Update Quicksight dataset lambda function invoked');
        } else {
            console.log('Update Quicksight dataset lambda function invocation failed');
        }
    } catch (error) {
        console.error("Error invoking QuickSight update function", error);
        throw error;
    }
}
