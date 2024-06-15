const AWS = require('aws-sdk');
const { authenticateUser } = require('./helpers/authenticateUser');
// const { getCredentials } = require('./helpers/getCredentials');
const { createQSDashboard } = require('./helpers/createDashboard');

// async function onboarding() {
    // const userName = "test-user-2";
    // const password = "P@ssw0rd12366";
    // const tenant = "ExampleCompany";
    // const dashboardId = "lambda-created-dashboard-3";
    // const dashboardName = "Lambda created Dashboard 3";
    // const templateId = "test-template";

exports.handler = async (event) => {

    var email = '';
    var userRegistered = false;

    const userName = event.userName;
    const password = event.password;
    const tenant = event.tenant;

    try {
    // ========= Login Simulation (Focus on Authentication) =========
        const authResult = await authenticateUser (userName, password);

        if (authResult != undefined && authResult != null) {
            console.log("Authentication Successful");
        } else {
            console.log("Authentication Failed");
        }
        const accessToken = authResult.AuthenticationResult.AccessToken;
        const idToken = authResult.AuthenticationResult.IdToken; 

    // ========= Exchange for Credentials =========
        // Getting Credential Data
        // const credentialsData = await getCredentials(idToken);
        // if (credentialsData != undefined && credentialsData != null) {
        //     console.log("Credential Data Obtained");
        // } else {
        //     console.log("Credential Data Failed to Obtain");
        // }
        // const accessKey = credentialsData.Credentials.AccessKeyId;
        // const secretKey = credentialsData.Credentials.SecretKey;
        // const sessionToken = credentialsData.Credentials.SessionToken;
        // console.log("Temp Access Key Obtained");
        // console.log("Temp Secret Key Obtained");

    // ========= Get Cognito User's Email =========
        // email = await getCognitoUserEmail(accessToken);
        // console.log("Email: ", email);

    // ========= Create Dashboard and Invite User =========
        var createDashboardResponse = await createQSDashboard(tenant)

    // ========= Register Quicksight User =========
        userRegistered = await registerQuickSightUser(
            tenant, 
            idToken,
            accessToken,
        );
        console.log("User registered: ", true);
        
    } catch (error) {
        let statusCode = 500;
        if (error.code === 'ResourceNotFoundException') {
            statusCode = 404;
        }
        console.error("Error in Lambda execution: ", error);

        return {
            statusCode: statusCode,
            body: JSON.stringify(`Something went wrong: ${error.message}`)
        }
    }
};