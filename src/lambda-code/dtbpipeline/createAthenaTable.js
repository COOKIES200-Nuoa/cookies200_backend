const { AthenaClient, StartQueryExecutionCommand } = require("@aws-sdk/client-athena");
// const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

exports.createAthenaTable = async (event) => {
    const region = process.env.REGION;

    const databaseName = event.databaseName;
    const tableName = event.tableName;
    const resultBucket = event.resultBucket;
    // const updateQuickSightFunctionName = process.env.UPDATE_QUICKSIGHT_FUNCTION_NAME;

    const athenaClient = new AthenaClient({ region: region });
    // const lambdaClient = new LambdaClient({ });

    const query = 
        `
        CREATE EXTERNAL TABLE IF NOT EXISTS ${databaseName}.${tableName} (
            tenantactivitykey string,
            activityid string,
            emissioninkgco2 bigint,
            emissioninkgco2_forlocationbased bigint,
            emissioninkgco2_formarketbased bigint,
            tenantentitykey string,
            entityid string,
            tenantid string,
            entity_name string,
            parentid string,
            parentContributionPercentage int
        )
        ROW FORMAT SERDE 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe'

        STORED AS INPUTFORMAT 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat' 

        OUTPUTFORMAT 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat'

        LOCATION 's3://${resultBucket}'
        
        TBLPROPERTIES ('classification' = 'parquet');
        `

        // `
        // CREATE EXTERNAL TABLE IF NOT EXISTS ${databaseName}.activity_table (
        //     id STRING,
        //     -- add schema vô đây nha 
        // )
        // STORED AS PARQUET
        // LOCATION 's3://${resultBucket}/dynamodb/ActivityTable.parquet';
        // `,
        // `
        // CREATE EXTERNAL TABLE IF NOT EXISTS ${databaseName}.entity_table (
        //     id STRING,
        //     -- add schema vô đây nha 
        // )
        // STORED AS PARQUET
        // LOCATION 's3://${resultBucket}/dynamodb/EntityTable.parquet';
        // `,
        // `
        // CREATE EXTERNAL TABLE IF NOT EXISTS ${databaseName}.entity_structure_table (
        //     id STRING,
        //     -- add schema vô đây nha 
        // )
        // STORED AS PARQUET
        // LOCATION 's3://${resultBucket}/dynamodb/EntityStructureTable.parquet';
        // `
    ;

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
    

    // Invoke QuickSight update function
    // try {
    //     const invokeCommand = new InvokeCommand({
    //         FunctionName: updateQuickSightFunctionName,
    //         InvocationType: "Event", 
    //     });
    //     await lambdaClient.send(invokeCommand);
    // } catch (err) {
    //     console.error("Error invoking QuickSight update function", err);
    //     throw err;
    // }

    return {
        statusCode: 200,
        body: "Athena tables created successfully, QuickSight datasets update initiated.",
    };
};
