const {authUserToFetchAccessToken} = require('./fetchUserRelatedInfo')

exports.authenticateUserAndFetchToken = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { username, password } = body;

    // Authenticate user
    const tokens = await authUserToFetchAccessToken(username, password);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Login successful!",
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        refreshToken: tokens.refreshToken
      }),
    };
  } catch (error) {
    console.error("Error in login execution:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Something went wrong: ${error.message}`,
      }),
    };
  }
};
