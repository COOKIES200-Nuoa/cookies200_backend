function createQuickSightResource(resourceType, createFunction) {
    return async function(resourceParams) {
        try {
            const response = await createFunction(resourceParams).promise();
            console.log(`${resourceType} ${resourceParams.Name || resourceParams.Username} created`);
        } catch(error) {
            // Handle errors based on the error code and message
            console.log(`Error creating ${resourceType} ${resourceParams.Name || resourceParams.Username}: `, error.message);
            throw error;
        }
    };
};

module.exports = { createQuickSightResource };
  