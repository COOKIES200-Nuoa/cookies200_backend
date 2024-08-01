import { QuickSightClient, UpdateDataSetCommand } from "@aws-sdk/client-quicksight";

export const updateQS = async (event) => {
    const quicksightClient = new QuickSightClient({});
    const athenaDatabaseName = process.env.ATHENA_DATABASE_NAME;
    const datasetNames = process.env.DATASET_NAMES.split(",");

    for (const datasetName of datasetNames) {
        const command = new UpdateDataSetCommand({
            AwsAccountId: process.env.AWS_ACCOUNT_ID, 
            DataSetId: datasetName,
            Name: datasetName,
            PhysicalTableMap: {
                AthenaSource: {
                    DataSourceArn: `arn:aws:athena:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:datacatalog/AthenaCatalog`,
                    Catalog: "AwsDataCatalog",
                    Database: athenaDatabaseName,
                    Name: datasetName,
                },
            },
        });

        try {
            await quicksightClient.send(command);
        } catch (err) {
            console.error(`Error updating QuickSight dataset: ${datasetName}`, err);
            throw err;
        }
    }

    return {
        statusCode: 200,
        body: "QuickSight datasets updated successfully",
    };
};
