const AWS = require('aws-sdk')

const region = process.env.REGION;
const identityPoolId = process.env.IDPOOL_ID;
const userPoolId = process.env.USER_POOL_ID;

const cognitoIdentity = new AWS.CognitoIdentity({ region: region});
const cognito = new AWS.CognitoIdentityServiceProvider({ region: region })

async function getCredentials(idToken) {
    var identityId;
    console.log("Identity Pool ID: ", identityPoolId );
    console.log("User Pool ID: ", userPoolId);

// ========= Exchange for Credentials =========
    const getIdParams = {
        IdentityPoolId: identityPoolId,
        Logins: {
            [`cognito-idp.${region}.amazonaws.com/${userPoolId}`]: idToken 
        }
    }; 
    // Get Cognito Identity ID
    try {
        const idData = await cognitoIdentity.getId(getIdParams).promise();
        identityId = idData.IdentityId 
    } catch (error) {
        console.log("Error getting Cognito ID ", error.message);
    }

// ========= Generate Role Session Name and Assume Role =========
    const getCredentialsParams = {
        IdentityId: identityId, 
        Logins: {
            [`cognito-idp.${region}.amazonaws.com/${userPoolId}`]: idToken
        }
    };
    // Get Credential Data
    try {
        const credentialsData = await cognitoIdentity.getCredentialsForIdentity(getCredentialsParams).promise(); 
        return credentialsData;
    } catch (error) {
        console.log("Error getting Credential Data: ", error.message);
    }
};

async function getCognitoUserEmail(accessToken) {
    const getUserParams = {
        AccessToken: accessToken
    };

    // Get Cognito User's Email
    try {
        const userData = await cognito.getUser(getUserParams).promise();
            const emailData = userData.UserAttributes.find(Attr => Attr.Name === 'email');
            const email = emailData.Value;
            console.log("User's email: ", email);
            return email;
    } catch (error) {
        console.log("Error getting Cognito User's Email: ", error.message);
    }
}

module.exports = { getCredentials, getCognitoUserEmail };