const {
    QuickSightClient, 
    DescribeDashboardCommand,
    DescribeNamespaceCommand,
    DescribeTemplateCommand,
    DescribeAnalysisCommand
}=  require('@aws-sdk/client-quicksight');

const region = process.env.REGION;

const quicksightClient = new QuickSightClient({ region: region});

async function waitForQuickSightOperation(
    resourceType, 
    params, 
    desiredStatuses, 
    retryDelay = 5000, 
    maxRetries = 20
) {
    let retries = 0;
    while (retries < maxRetries) {
        let command;
        let statusPath;

        switch (resourceType) {
            case 'dashboard':
                command = new DescribeDashboardCommand(params);
                statusPath = 'Dashboard.Version.Status';
                break;
            case 'namespace':
                command = new DescribeNamespaceCommand(params);
                statusPath = 'Namespace.CreationStatus';
                break;
            case 'template':
                command = new DescribeTemplateCommand(params);
                statusPath = 'Template.Version.Status';
                break;
            case 'analysis':
                command = new DescribeAnalysisCommand(params);
                statusPath = 'Analysis.Status';
                break;
            default:
                throw new Error(`Unsupported resource type: ${resourceType}`);
        }

        const response = await quicksightClient.send(command);
        const status = statusPath.split('.').reduce((obj, key) => obj[key], response);

        if (desiredStatuses.includes(status)) {
            return response;
        } else if (status.endsWith("FAILED") || status === 'NON_RETRYABLE_FAILURE') {
            throw new Error(`Operation failed with status: ${status}`);
        }

        retries++;
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    throw new Error(`Operation timed out after ${maxRetries} retries`);
}