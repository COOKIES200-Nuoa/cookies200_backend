const AWS = require('aws-sdk');
const QuickSight = new AWS.QuickSight();
const { authenticateUser } = require('../registerQs/helpers/authenticateUser'); 

exports.handler = async (event) => {
  try {
    // Extract Username and Password from Request
    const { username, password } = JSON.parse(event.body);

    // Authenticate User using helper function
    const authResponse = await authenticateUser(username, password);

    // Handle Authentication Errors
    if (!authResponse || !authResponse.AuthenticationResult) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Authentication failed' }),
      };
    }

    // Extract User Identifier (Adjust based on your Cognito setup)
    const userId = authResponse.AuthenticationResult.IdToken.payload.sub; // Assuming 'sub' claim

    // Dynamically Construct Dashboard ID and ARN
    const dashboardId = `${username}-dashboard`;

    // Generate Dashboard URL (using QuickSight API)
    const quickSightParams = {
      AwsAccountId: process.env.AWS_ACC_ID,
      DashboardId: dashboardId,
      UserId: userId,
      Namespace: username, 
    };

    const embedUrlResponse = await QuickSight.getDashboardEmbedUrl(quickSightParams).promise();

    // Return Response
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        dashboardUrl: embedUrlResponse.EmbedUrl
      }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};