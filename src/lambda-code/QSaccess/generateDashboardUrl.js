const {authUserToFetchAccessToken, generateQuickSightURL} = require('./fetchUserRelatedInfo')

exports.generateDashboardUrl = async (event) => {
  try {
    const username = event.username;
    const password = event.password;

    // Authenticate user
    const accessToken = await authUserToFetchAccessToken(username, password);
    console.log("Access Token: ", accessToken);

    // Generate QuickSight embedded URL
    const embedUrl = await generateQuickSightURL(accessToken);
    console.log("Quicksight Embeded URL: ", embedUrl);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Lambda execution successful!",
        embedUrl: embedUrl
      }),
    };
  } catch (error) {
    console.error("Error in Lambda execution:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Something went wrong: ${error.message}`,
      }),
    };
  }
};
