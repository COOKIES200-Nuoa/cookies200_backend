const jwt = require("jsonwebtoken");
const {
  QuickSightClient,
  GenerateEmbedUrlForRegisteredUserCommand,
  DescribeUserCommand,
} = require("@aws-sdk/client-quicksight");
const { error } = require("console");

const AWS_ACC_ID = process.env.AWS_ACC_ID;
const AWS_REGION = process.env.AWS_REGION;
const quicksight = new QuickSightClient();

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
      throw new Error(`No group found in the access token ${error}`);
    }
    return groups[0];
  } catch (error) {
    console.error("Failed to decode token:", error);
    throw new Error(`Invalid token ${error}`);
  }
}

function getCognitoUsername(accessToken) {
  try {
    const decodedToken = jwt.decode(accessToken);
    const usernames =
      decodedToken["cognito:username"] || decodedToken["username"] || [];
    if (!usernames || usernames.length === 0) {
      throw new Error(`No group found in the access token ${error}`);
    }
    return usernames[0];
  } catch (error) {
    console.error("Failed to decode token:", error);
    throw new Error(`Invalid token ${error}`);
  }
}

async function getUserRole(accessToken) {
  const userGroup = await getCognitoUserGroups(accessToken);
  const username = await getCognitoUsername(accessToken);
  const input = {
    // DescribeUserRequest
    UserName: username,
    AwsAccountId: AWS_ACC_ID,
    Namespace: userGroup,
  };
  try {
    const command = new DescribeUserCommand(input);
    const response = await quicksight.send(command);
    return response.User.Role;
  } catch (Error) {
    console.error("Error: ", error);
    throw new Error(error);
  }
}

async function generateQuickSightURL(accessToken) {
  const userGroup = await getCognitoUserGroups(accessToken);
  const userRole = await getUserRole(accessToken);
  const userArn = `arn:aws:quicksight:${AWS_REGION}:${AWS_ACC_ID}:user/${userGroup}/${userGroup}TenantRole/${userGroup}`;
  const dashboardId = `${userGroup}-dashboard`;
  const analysisId = `${userGroup}-analysis`;

  const experienceId = userRole == "READER" ? dashboardId : analysisId;
  const initialPath =
    userRole == "READER"
      ? `/dashboards/${dashboardId}`
      : `/analyses/${analysisId}`;

  const dashboardExperienceConfiguration = {
    Dashboard: {
      InitialDashboardId: experienceId,
    },
  };
  const consoleExperienceConfiguration = {
    QuickSightConsole: {
      FeatureConfigurations: {
        StatePersistence: {
          Enabled: true,
        },
      },
      InitialPath: initialPath,
    },
  };
  const params = {
    // GenerateEmbedUrlForRegisteredUserRequest
    AwsAccountId: AWS_ACC_ID,
    UserArn: userArn,
    // SessionLifetimeInMinutes: 100,  // Adjust as necessary within the allowed range
    ExperienceConfiguration: consoleExperienceConfiguration,
  };
  
  try {
    const command = new GenerateEmbedUrlForRegisteredUserCommand(params);
    const response = await quicksight.send(command);
    return response.EmbedUrl;
  } catch (error) {
    console.error("Error generating QuickSight URL:", error);
    throw new Error(error);
  }
}

module.exports = {
  getCognitoUserGroups,
  generateQuickSightURL,
};
