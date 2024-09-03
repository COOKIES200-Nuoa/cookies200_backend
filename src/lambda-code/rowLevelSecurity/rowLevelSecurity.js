const {
    BatchWriteItemCommand,
    DescribeTableCommand,
    DynamoDBClient,
} = require('@aws-sdk/client-dynamodb')

const {
    GetCommand,
    PutCommand,
    BatchWriteCommand,
    DynamoDBDocumentClient,
} = require('@aws-sdk/lib-dynamodb');

exports.rowLevelSecurity = async (event) => {

    const region = process.env.REGION;
    const dynamodbClient = new DynamoDBClient({ region: region });
    const docClient = DynamoDBDocumentClient.from(dynamodbClient);

    const updateRLS_Admin = new BatchWriteCommand({
        RequestItems: {
            'RowLevelSecurity_Nuoa': [
                {
                    PutRequest: {
                        Item: {
                            UserArn: 'arn:aws:quicksight:ap-southeast-1:203903977784:user/default/admin_ncbinh',
                            tenantid: ''
                        }
                    }
                },
                {
                    PutRequest: {
                        Item: {
                            UserArn: 'arn:aws:quicksight:ap-southeast-1:203903977784:user/default/Nham-Cookies200',
                            tenantid: ''
                        }
                    }
                },
                {
                    PutRequest: {
                        Item: {
                            UserArn: 'arn:aws:quicksight:ap-southeast-1:203903977784:user/default/Nuoa-view',
                            tenantid: ''
                        }
                    }
                },
            ]
        }
    });

    const updateRLS_Tenant = new PutCommand({
        TableName: 'RowLevelSecurity_Nuoa',
        Item: {
            UserArn: 'arn:aws:quicksight:ap-southeast-1:203903977784:user/default/test-user',
            tenantid: 'test-tenant-id'
        },
    });

    const getAdmin = new GetCommand({
        TableName: 'RowLevelSecurity_Nuoa',
        Key: {
            UserArn: 'arn:aws:quicksight:ap-southeast-1:203903977784:user/default/admin_ncbinh'
        },
    });

    try {
        const getAdminRes = await docClient.send(getAdmin);
        console.log("Get Admin Response: ", getAdminRes);

        if (getAdminRes.Item === undefined) {
            const updateRLS_Admin_Res = await docClient.send(updateRLS_Admin);
            console.log("Update RLS table with Admin permissions");
        } else {
            const updateRLS_Tenant_Res = await docClient.send(updateRLS_Tenant);
            console.log("Update RLS table with Tenant permissions");
        }
    } catch (error) {
        console.error(error);
    }
};