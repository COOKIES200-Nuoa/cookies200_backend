const AWS = require('aws-sdk');
const axios = require('axios'); // Assuming axios is used for HTTP requests

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
async function getUserEmail(accessToken) {
    const params = {
        AccessToken: accessToken
    };

    try {
        const userInfo = await cognito.getUser(params).promise();
        const emailAttribute = userInfo.UserAttributes.find(attr => attr.Name === 'email');
        return emailAttribute ? email.ibute.Value : null;
    } catch (error) {
        console.error('Error retrieving user email:', error);
        throw new Error('Failed to retrieve user email');
    }
}

/**
 * Generate QuickSight embedded URL for the user dashboard
 * @param {string} userEmail 
 * @param {string} dashboardId 
 */
/**
 * Generate QuickSight embedded URL for the user dashboard
 * @param {string} userEmail 
 * @param {string} dashboardId 
 */
// async function generateQuickSightURL(userEmail, dashboardId) {
//     const userArn = `arn:aws:quicksight:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:user/default/${userEmail}`;

//     // const params = {
//     //     AwsAccountId: process.env.AWS_ACCOUNT_ID,
//     //     DashboardId: dashboardId,
//     //     IdentityType: 'IAM', // Or 'QUICKSIGHT' if using QuickSight users
//     //     UserArn: userArn,
//     //     SessionLifetimeInMinutes: 100,
//     //     UndoRedoDisabled: false,
//     //     ResetDisabled: false
//     // };

//     const params = {
//         AwsAccountId: process.env.AWS_ACCOUNT_ID,
//         DashboardId: dashboardId,
//         UserArn: userArn,
//         SessionLifetimeInMinutes: 60, // Set according to your needs
//         UndoRedoDisabled: false,
//         ResetDisabled: false
//     };

//     try {
//         const { EmbedUrl } = await quicksight.generateEmbedUrlForRegisteredUser(params).promise();
//         return EmbedUrl;
//     } catch (error) {
//         console.error('Error generating QuickSight URL:', error);
//         throw new Error('Failed to generate QuickSight URL');
//     }
// }

async function generateQuickSightURL(userEmail, dashboardId) {
    const userArn = `arn:aws:quicksight:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:user/default/${userEmail}`;

    const experienceConfiguration = {
        Dashboard: {
            InitialDashboardId: dashboardId
        }
    };

    const params = {
        AwsAccountId: process.env.AWS_ACCOUNT_ID,
        UserArn: userArn,
        SessionLifetimeInMinutes: 100,  // Adjust as necessary within the allowed range
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
        const dashboardId = event.dashboardId;

        // Authenticate user
        const accessToken = await authenticateUser(username, password);

        // Get user email
        const userEmail = await getUserEmail(accessToken);

        // Generate QuickSight embedded URL
        const embedUrl = await generateQuickSightURL(userEmail, dashboardId);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Lambda execution successful!',
                embedUrl: embedUrl
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