const { QuickSightClient } = require('@aws-sdk/client-quicksight');

const region = process.env.REGION;

function createQuickSightResource( resourceType, createCommandConstructor) {
    const quickSightClient = new QuickSightClient({ region: region });

    return async function (resourceParams) {
        const command = new createCommandConstructor(resourceParams);

        try {
            const response = await quickSightClient.send(command);
            if (resourceType === 'Namespace') {
                await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds before attaching moving on // Replace with better solution later
            }
            console.log(`${resourceType} ${resourceParams.Name} || ${resourceParams.TemplateId} created`);
            return response;
        } catch (error) {
            if (
                error.name === 'ResourceExistsException' ||
                error.name === 'ConflictException'
            ) {
                console.warn(`${resourceType} already exists. Moving on...`);
            } else {
                console.error(`Error creating ${resourceType}: `, error);
                throw error;
            }
        }
    };
}

module.exports = { createQuickSightResource };