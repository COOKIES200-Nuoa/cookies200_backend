const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');

const cognito = new AWS.CognitoIdentityServiceProvider();
const quicksight = new AWS.QuickSight();

const USER_POOL_ID = process.env.USER_POOL_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const AWS_ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;
const AWS_REGION = process.env.AWS_REGION;

/**
 * Authenticate user with Cognito and get user details
 * @param {string} username 
 * @param {string} password 
 */
async function authUserToFetchAccessToken(username, password) {
    const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID, //app-client-id?
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
/* @param {string} token - The JWT access token from Cognito.
 * @returns {string[]} - An array of groups the user belongs to.*/
function getCognitoUserGroups(accessToken) {
    try {
        const decodedToken = jwt.decode(accessToken);
        const groups = decodedToken['cognito:groups'] || [];  // Returns an empty array if no groups are found
        if (!groups || groups.length === 0) {
            throw new Error('No group found in the access token. ');
        }
        return groups[0];
    } catch (error) {
        console.error('Failed to decode token:', error);
        throw new Error('Invalid token');
    }
}   
// function getCognitoUsername(accessToken) {
//     try {
//         const decodedToken = jwt.decode(accessToken);
//         const names = decodedToken['cognito:username'] || [];  // Returns an empty array if no groups are found
//         if (!names || names.length === 0) {
//             throw new Error('No username found in the access token. ');
//         }
//         return names[0];
//     } catch (error) {
//         console.error('Failed to decode token:', error);
//         throw new Error('Invalid token');
//     }
// }   

// async function getUserInfo(accessToken) {
//     const params = {
//         AccessToken: accessToken
//     };

//     try {
//         const userInfo = await cognito.getUser(params).promise();

//         // Extract the username
//         const username = userInfo.Username; //cogito-username
//         const groupName = getCognitoUserGroups(accessToken); //tenant
        

//         return { username };
//     } catch (error) {
//         console.error('Error retrieving user info:', error);
//         throw new Error('Failed to retrieve user information');
//     }
// }


/**
 * Generate QuickSight embedded URL for the user dashboard
 * @param {string} userEmail 
 */

async function generateQuickSightURL(userEmail) {
    const userGroup = await getCognitoUserGroups(accessToken);

    //arn:aws:quicksight:ap-southeast-1:891377270638:user/TenantK/TenantKTenantRole/TenantK
    const userArn = `arn:aws:quicksight:${AWS_REGION}:${AWS_ACCOUNT_ID}:user/${userGroup}/${userGroup}TenantRole/${userGroup}`;

    const experienceConfiguration = {
        Dashboard: {
            InitialDashboardId: dashboardId
        }
    };

    const params = {
        AwsAccountId: AWS_ACCOUNT_ID,
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
        const accessToken = await authUserToFetchAccessToken(username, password);

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