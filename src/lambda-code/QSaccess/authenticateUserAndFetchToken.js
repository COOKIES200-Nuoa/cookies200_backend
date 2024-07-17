const jwt = require("jsonwebtoken");
const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
const {
  QuickSightClient,
  GenerateEmbedUrlForRegisteredUserCommand,
} = require("@aws-sdk/client-quicksight");
const { error } = require("console");

const USER_POOL_ID = process.env.USER_POOL_ID;
const CLIENT_ID = process.env.USER_POOL_CLIENT_ID;
const cognito = new CognitoIdentityProviderClient();

exports.authenticateUserAndFetchToken = async (event) => {
  const body = JSON.parse(event.body);
  const { username, password, newPassword } = body;

  try {
    const params = {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: CLIENT_ID,
      UserPoolId: USER_POOL_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    };
    const command = new InitiateAuthCommand(params);
    const responseInitiateAuth = await cognito.send(command);

    if (responseInitiateAuth.ChallengeName === "NEW_PASSWORD_REQUIRED") {
      if (!newPassword) {
        return {
          statusCode: 400,
          headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            message: "New password required.",
            challengeName: command.ChallengeName,
          }),
        };
      } else {
        // Step 2: Respond to Auth Challenge
        const respondToAuthChallengeParams = {
          ChallengeName: "NEW_PASSWORD_REQUIRED",
          ClientId: CLIENT_ID,
          UserPoolId: USER_POOL_ID,
          ChallengeResponses: {
            USERNAME: username,
            NEW_PASSWORD: newPassword,
          },
          Session: responseInitiateAuth.Session,
        };
        const commandAuthChallange = new RespondToAuthChallengeCommand(
          respondToAuthChallengeParams
        );
        const responseAuthChallenge = await cognito.send(commandAuthChallange);
        return {
          statusCode: 200,
          headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            message: "Password changed successfully!",
            tokens: responseAuthChallenge.AuthenticationResult
          }),
        };
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Origin': '*'
          },
      body: JSON.stringify({
        message: "Authentication successful!",
        tokens: responseInitiateAuth.AuthenticationResult
      }),
    };
    
  } catch (error) {
    console.error("Error during authentication:", error);
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Origin': '*'
          },
      body: JSON.stringify({
        message: "Authentication failed",
        error: error.message,
      }),
    };
  }
};