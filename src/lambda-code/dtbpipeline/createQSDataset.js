const { QuickSightClient, CreateDataSetCommand } = require("@aws-sdk/client-quicksight"); 

async function createQSDataset (sqlQuery, datasetName, columns) {
    const awsAccountId = process.env.ACC;
    const region = process.env.REGION;
    const dataSourceArn = process.env.DATASOURCEARN;

    const quicksightClient = new QuickSightClient({ region: region});
    const datasetParams = {
        AwsAccountId: awsAccountId,
        DataSetId: datasetName,
        Name: datasetName,
        PhysicalTableMap: {
          "custom_sql_table": { // Give it a unique key
            CustomSql: { // Use CustomSql directly
              DataSourceArn: dataSourceArn,
              Name: datasetName, // A meaningful name for the custom table
              SqlQuery: sqlQuery,
              Columns: columns, // Define the column structure
            },
          },
        },
        ImportMode: "SPICE",
      };

    const quickSightCommand = new CreateDataSetCommand(datasetParams);
    const datasetResponse = await quicksightClient.send(quickSightCommand);

    console.log("Quicksight Dataset created: ", datasetResponse);
};
module.exports = { createQSDataset };