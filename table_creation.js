const AWS = require('aws-sdk');


AWS.config.update({ region: 'ap-southeast-1' });

const dynamodb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

const createTable = (params) => {
    dynamodb.createTable(params, function(err, data) {
        if (err) {
            console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
        }
    });
}

// USERS Table
const usersParams = {
    TableName: 'USERS',
    KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' }
    ],
    ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
    }
};

// CUSTOMIZATION REQUESTS Table
const requestsParams = {
    TableName: 'CUSTOMIZATION_REQUESTS',
    KeySchema: [
        { AttributeName: 'requestId', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
        { AttributeName: 'requestId', AttributeType: 'S' }
    ],
    ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
    }
};

// DASHBOARD CONFIGURATIONS Table
const dashboardsParams = {
    TableName: 'DASHBOARD_CONFIGURATIONS',
    KeySchema: [
        { AttributeName: 'dashboardId', KeyType: 'HASH' },
        { AttributeName: 'userId', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
        { AttributeName: 'dashboardId', AttributeType: 'S' },
        { AttributeName: 'userId', AttributeType: 'S' }
    ],
    ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
    }
};

// Create tables
createTable(usersParams);
createTable(requestsParams);
createTable(dashboardsParams);