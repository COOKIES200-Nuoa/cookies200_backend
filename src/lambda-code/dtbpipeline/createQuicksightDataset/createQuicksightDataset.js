const {
    CreateDataSourceCommand,
    CreateDataSetCommand,
    QuickSightClient,
} = require('@aws-sdk/client-quicksight');

exports.createQuicksightDataset = async (event) => {
    const quicksightClient = new QuickSightClient({});

    const command = new CreateDataSourceCommand(
        {
            AwsAccountId:'',
            DataSourceId: '',
            Name: '',
            Type: '',
            
        }
    )
}