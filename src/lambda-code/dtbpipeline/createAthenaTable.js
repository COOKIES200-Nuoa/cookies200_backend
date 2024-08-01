import { AthenaClient, StartQueryExecutionCommand } from "@aws-sdk/client-athena";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

export const createAthenaTable = async (event) => {
    const databaseName = process.env.DATABASE_NAME;
    const resultBucket = process.env.RESULT_BUCKET;
    const updateQuickSightFunctionName = process.env.UPDATE_QUICKSIGHT_FUNCTION_NAME;

    const athenaClient = new AthenaClient({});
    const lambdaClient = new LambdaClient({});

    const queries = [
        `
        CREATE EXTERNAL TABLE IF NOT EXISTS ${databaseName}.activity_table (
            id STRING,
            -- add schema vô đây nha 
        )
        STORED AS PARQUET
        LOCATION 's3://${resultBucket}/dynamodb/ActivityTable.parquet';
        `,
        `
        CREATE EXTERNAL TABLE IF NOT EXISTS ${databaseName}.entity_table (
            id STRING,
            -- add schema vô đây nha 
        )
        STORED AS PARQUET
        LOCATION 's3://${resultBucket}/dynamodb/EntityTable.parquet';
        `,
        `
        CREATE EXTERNAL TABLE IF NOT EXISTS ${databaseName}.entity_structure_table (
            id STRING,
            -- add schema vô đây nha 
        )
        STORED AS PARQUET
        LOCATION 's3://${resultBucket}/dynamodb/EntityStructureTable.parquet';
        `
    ];

    for (const query of queries) {
        const command = new StartQueryExecutionCommand({
            QueryString: query,
            QueryExecutionContext: { Database: databaseName },
            ResultConfiguration: { OutputLocation: `s3://${resultBucket}/athena-results/` },
        });

        try {
            await athenaClient.send(command);
        } catch (err) {
            console.error(`Error executing query: ${query}`, err);
            throw err;
        }
    }

    // Invoke QuickSight update function
    try {
        const invokeCommand = new InvokeCommand({
            FunctionName: updateQuickSightFunctionName,
            InvocationType: "Event", 
        });
        await lambdaClient.send(invokeCommand);
    } catch (err) {
        console.error("Error invoking QuickSight update function", err);
        throw err;
    }

    return {
        statusCode: 200,
        body: "Athena tables created successfully, QuickSight datasets update initiated.",
    };
};
