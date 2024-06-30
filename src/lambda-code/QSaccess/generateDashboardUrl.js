const AWS = require('aws-sdk');
const axios = require('axios'); // Assuming axios is used for HTTP requests
const jwt = require('jsonwebtoken');

const cognito = new AWS.CognitoIdentityServiceProvider();
const quicksight = new AWS.QuickSight();

const USER_POOL_ID = process.env.USER_POOL_ID;
const CLIENT_ID = process.env.CLIENT_ID;

/**
 * Authenticate user with Cognito and get user details
 * @param {string} username 
 * @param {string} password 
 */
async function authenticateUser(username, password) {
    const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        UserPoolId: USER_POOL_ID,
        AuthParameters: {
            USERNAME: username,
            PASSWORD: password
        }
    };

    try {
        const session = await cognito.initiateAuth(params).promise();
        const accessToken = session.AuthenticationResult.AccessToken;
        return accessToken;
    } catch (error) {
        console.error('Authentication error:', error);
        throw new Error('Authentication failed');
    }
}

/**
 * Get user's email from Cognito using access token
 * @param {string} accessToken 
 */
// async function getUserEmail(accessToken) {
//     const params = {
//         AccessToken: accessToken
//     };

//     try {
//         const userInfo = await cognito.getUser(params).promise();
//         const emailAttribute = userInfo.UserAttributes.find(attr => attr.Name === 'email');
//         return emailAttribute ? emailAttribute.Value : null;
//     } catch (error) {
//         console.error('Error retrieving user email:', error);
//         throw new Error('Failed to retrieve user email');
//     }
// }

/* @param {string} token - The JWT access token from Cognito.
 * @returns {string[]} - An array of groups the user belongs to.*/
function getCognitoUserGroups(token) {
    try {
        const decodedToken = jwt.decode(token);
        return decodedToken['cognito:groups'] || [];  // Returns an empty array if no groups are found
    } catch (error) {
        console.error('Failed to decode token:', error);
        throw new Error('Invalid token');
    }
}   

// Example usage within an async function
async function handleUserAuthentication(accessToken) {
    try {
        const userGroups = getCognitoUserGroups(accessToken);
        console.log('User belongs to groups:', userGroups);
        // Further processing based on groups
    } catch (error) {
        console.error('Error processing the access token:', error);
    }
}

async function getUserInfo(accessToken) {
    const params = {
        AccessToken: accessToken
    };

    try {
        const userInfo = await cognito.getUser(params).promise();

        // Extract the username
        const username = userInfo.Username;

        // Extract Cognito groups from user attributes
        // const groupsAttribute = userInfo.UserAttributes.find(attr => attr.Name === 'cognito:groups');
        // const groups = groupsAttribute ? groupsAttribute.Value.split(',') : [];
        // const group = await cognito.getGroup.

        return { username };
    } catch (error) {
        console.error('Error retrieving user info:', error);
        throw new Error('Failed to retrieve user information');
    }
}


/**
 * Generate QuickSight embedded URL for the user dashboard
 * @param {string} userEmail 
 */
/**
 * Generate QuickSight embedded URL for the user dashboard
 * @param {string} userEmail 
 */

async function generateQuickSightURL(userEmail) {
    //"Arn": "arn:aws:quicksight:ap-southeast-1:891377270638:user/TenantK/TenantKTenantRole/TenantK"
    const userArn = `arn:aws:quicksight:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:user/default/${userEmail}`;

    const experienceConfiguration = {
        Dashboard: {
            InitialDashboardId: dashboardId
        }
    };

    const params = {
        AwsAccountId: process.env.AWS_ACCOUNT_ID,
        UserArn: userArn,
        // SessionLifetimeInMinutes: 100,  // Adjust as necessary within the allowed range
        ExperienceConfiguration: experienceConfiguration
    };

    try {
        const { EmbedUrl } = await quicksight.generateEmbedUrlForRegisteredUser(params).promise();
        return EmbedUrl;
    } catch (error) {
        console.error('Error generating QuickSight URL:', error);
        throw new Error('Failed to generate QuickSight URL');
    }
}

exports.handler = async (event) => {
    try {
        const username = event.username;
        const password = event.password;
        // const dashboardId = event.dashboardId;

        // Authenticate user
        const accessToken = await authenticateUser(username, password);

        // // Get user email
        // const userEmail = await getUserEmail(accessToken);
        const userGroup = await getCognitoUserGroups(accessToken);

        // // Generate QuickSight embedded URL
        // const embedUrl = await generateQuickSightURL(userEmail);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Lambda execution successful!',
                // embedUrl: embedUrl
                cognitoUserGroup: userGroup
            })
        };
    } catch (error) {
        console.error('Error in Lambda execution:', error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                message: `Something went wrong: ${error.message}`
            })
        };
    }
};