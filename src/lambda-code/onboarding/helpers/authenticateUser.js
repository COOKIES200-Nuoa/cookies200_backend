const AWS = require('aws-sdk')

const region = process.env.REGION;
const clientId = process.env.USER_POOL_CLIENT_ID;
const cognito = new AWS.CognitoIdentityServiceProvider({ region: region });

async function authenticateUser (userName, password) {

    try {
        const authParams = {
            AuthFlow: 'USER_PASSWORD_AUTH', 
            ClientId: clientId, 
            AuthParameters: {
                'USERNAME': userName,
                'PASSWORD': password 
            }
        };
        let authResult = await cognito.initiateAuth(authParams).promise();
        
        return authResult;

    } catch (error) {
        console.log("Authentication Error: ", error.message);
    };
};

module.exports = { authenticateUser };
