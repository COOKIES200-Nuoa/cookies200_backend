const AWS = require('aws-sdk');
const { authenticateUser } = require('./helpers/authenticateUser');
const { registerQuickSightUser } = require('./helpers/registerQuickSightUser');


exports.quicksightRegistration = async (event) => {

    var userRegistered = false;
    const userName = event.userName;
    const password = event.password;

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