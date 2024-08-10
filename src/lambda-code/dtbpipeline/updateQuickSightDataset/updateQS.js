const { QuickSightClient, CreateIngestionCommand } = require("@aws-sdk/client-quicksight");

exports.updateQS = async (event) => {
    const region = process.env.REGION;
    const account = process.env.ACCOUNT_ID

    const quicksightClient = new QuickSightClient({ region: region });

    const datasetId = process.env.DATASET_ID;
    const timestamp = Date.now();

    const refreshParams = { 
        DataSetId: datasetId, 
        IngestionId: `refresh-${timestamp}`,
        AwsAccountId: account,
        IngestionType: "INCREMENTAL_REFRESH",
    };
    const refreshCommand = new CreateIngestionCommand(refreshParams);
    
    try {
        const refreshResponse = await quicksightClient.send(refreshCommand);
        console.log('Refresh status ', refreshResponse.IngestionStatus);
        if(refreshResponse.IngestionStatus === "INITIALIZED") {
            console.log(`QuickSight dataset ${datasetId} update underway`);
            
            return {
                statusCode: 200,
                body: `QuickSight dataset ${datasetId} update underway`
            };
        }
        else {
            console.log(`QuickSight dataset ${datasetId} updated failed to start`);
            
            return {
                statusCode: 400,
                body: `QuickSight dataset ${datasetId} updated failed to start`,
            }
        }
    } catch (error) {
        console.error(`Failed to refresh dataset ${datasetId} due to ${error}`);
    }
};