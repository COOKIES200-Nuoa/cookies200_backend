const { QuickSightClient, CreateDataSourceCommand }  = require("@aws-sdk/client-quicksight");

async function createQSDataSource(dataSourceId, dataSourceName) {
    const awsAccountId = process.env.AWS_ACC_ID;
    const region = process.env.REGION;

    try {
        const quicksightClient = new QuickSightClient({ region: region });
        const dataSourceParams = {
            AwsAccountId: awsAccountId,
            DataSourceId: dataSourceId,
            Name: dataSourceName,
            Type: "ATHENA",
            DataSourceParameters: {
                AthenaParameters: {
                    WorkGroup: "primary",
                },
            },
        };
    
        const quicksightDataSourceCommand = new CreateDataSourceCommand(dataSourceParams);
        const dataSourceResponse = await quicksightClient.send(quicksightDataSourceCommand);
    
        if (dataSourceResponse.CreationStatus === "CREATION_SUCCESSFUL") {
            console.log("Quicksight Data Source created: ", dataSourceResponse);
            const dataSourceArn = dataSourceResponse.Arn;
            return dataSourceArn;
        } else {
            // Retry 
        }
    } catch (error) {
        console.error("Error creating Data Source: ", error);
    }
};
module.exports = { createQSDataSource };