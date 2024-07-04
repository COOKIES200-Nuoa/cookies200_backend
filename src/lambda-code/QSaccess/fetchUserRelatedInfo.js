const jwt = require("jsonwebtoken");
const {CognitoIdentityProviderClient, InitiateAuthCommand} = require('@aws-sdk/client-cognito-identity-provider');
const {QuickSightClient, GenerateEmbedUrlForRegisteredUserCommand} = require('@aws-sdk/client-quicksight');

const USER_POOL_ID = process.env.USER_POOL_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const AWS_ACC_ID = process.env.AWS_ACC_ID;
const AWS_REGION = process.env.AWS_REGION;

const cognito = new CognitoIdentityProviderClient();
const quicksight = new QuickSightClient();
/**
 * Authenticate user with Cognito and get user details
 * @param {string} username
 * @param {string} password
 */
async function authUserToFetchAccessToken(username, password) {
  const params = {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENT_ID, //app-client-id?
    UserPoolId: USER_POOL_ID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  };

  try {
    const command = new InitiateAuthCommand(params);
    const response = await cognito.send(command);
    const accessToken = response.AuthenticationResult.AccessToken;
    return accessToken;
  } catch (error) {
    console.error("Authentication error:", error);
    throw new Error("Authentication failed");
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
    const groups = decodedToken["cognito:groups"] || []; // Returns an empty array if no groups are found
    if (!groups || groups.length === 0) {
      throw new Error("No group found in the access token. ");
    }
    return groups[0];
  } catch (error) {
    console.error("Failed to decode token:", error);
    throw new Error("Invalid token");
  }
}

async function generateQuickSightURL(accessToken) {
  const userGroup = await getCognitoUserGroups(accessToken);
  console.log("Usergroup: ", userGroup);
  
  //arn:aws:quicksight:ap-southeast-1:891377270638:user/TenantK/TenantKTenantRole/TenantK
  const userArn = `arn:aws:quicksight:${AWS_REGION}:${AWS_ACC_ID}:user/${userGroup}/${userGroup}TenantRole/${userGroup}`;

  const experienceConfiguration = {
    Dashboard: {
      InitialDashboardId: `${userGroup}-dashboard`,
    },
  };

  const params = {
    AwsAccountId: AWS_ACC_ID,
    UserArn: userArn,
    // SessionLifetimeInMinutes: 100,  // Adjust as necessary within the allowed range
    ExperienceConfiguration: experienceConfiguration,
  };

  try {
    const command = new GenerateEmbedUrlForRegisteredUserCommand(params);
    const response = await quicksight.send(command);
    return response.EmbedUrl;
  } catch (error) {
    console.error("Error generating QuickSight URL:", error);
    throw new Error("Failed to generate QuickSight URL");
  }
}

module.exports = {
  authUserToFetchAccessToken,
  getCognitoUserGroups,
  generateQuickSightURL,
};
