const AWS = require('aws-sdk')
const { createQuickSightResource } = require('./createQuickSightResource');
const { getCredentials } = require('./getCredentials');

const region = process.env.REGION;
const identityType = process.env.ID_TYPE;
const awsAccountId = process.env.AWS_ACC_ID;
const userRole = process.env.USER_ROLE;
const email = process.env.EMAIL;


async function registerQuickSightUser(tenant, idToken, accessToken) {

    try {
    // Get the temporary credentials and role ARN using getCredentials
    const { roleArn, credentials } = await getCredentials(idToken, accessToken);
    if (!credentials || !roleArn) {
        if(!credentials){
            throw new Error('Failed to obtain credentials.');
        } else {
            throw new Error('Failed to obtain assumed Role ARN');
        }    
    }

    console.log(`Tenant ${tenant}'s roleARN: ${roleArn}`);
    console.log(`Tenant ${tenant}'s credentials: ${credentials}`);

    // Create Quicksight instance using obtained credentials
    const quicksight = new AWS.QuickSight({
        accessKeyId: credentials.Credentials.AccessKeyId,
        secretAccessKey: credentials.Credentials.SecretAccessKey,
        sessionToken: credentials.Credentials.SessionToken,
        region: region
    });

    // Quicksight registration
    const registerUser = createQuickSightResource('User', quicksight.registerUser);
    const registerUserParams = {
        IdentityType: identityType,
        AwsAccountId: awsAccountId,  
        Namespace: tenant, 
        SessionName:tenant,
        Email: email,
        UserRole: userRole,
        IamArn: roleArn,
    };
    
    try {
        await registerUser(registerUserParams);
        console.log("User registered in QuickSight");
        return true;
    } catch (error) {
        if (error.code === 'ResourceExistsException') { // User already registered
            console.log("User already exists in QuickSight");
            return true;
        } else {
            console.error("Error registering user:", error.message);
        }
    };
    } catch (error) {
        console.error("Error registering user:", error.message);
    }
// // ========= Generate Role Session Name and Assume Role =========
//     const sts = new AWS.STS({
//         region: region,
//         credentials: {
//             accessKeyId: accessKey,
//             secretAccessKey:secretKey,
//             sessionToken: sessionToken,
//         }
//     });

// // ========= Assume the IAM Role =========
//     const assumeRoleParams = {
//         RoleArn: assumeRole,
//         RoleSessionName: `${tenant}RegistrationSession`,
//     }
//     try {
//         roleCredentialsData = await sts.assumeRole(assumeRoleParams).promise();
//     } catch (error) {
//         console.log("Error Assuming Role: ", error.message);
//     }

// // ========= Create Quicksight instance using assumed role's credentials =========
//     const quicksight = new AWS.QuickSight({
//         accessKeyId: roleCredentialsData.Credentials.AccessKeyId,
//         secretAccessKey: roleCredentialsData.Credentials.SecretAccessKey,
//         sessionToken: roleCredentialsData.Credentials.SessionToken,
//         region: region
//     });

//     const registerUser = createQuickSightResource('User', quicksight.registerUser);

// // ========= Register User Params =========
//     const registerUserParams = {
//         IdentityType: identityType,
//         AwsAccountId: awsAccountId,  
//         Namespace: tenant, 
//         SessionName:tenant,
//         UserRole: userRole,
//         Email: email,
//         IamArn: assumeRole,
//     };
};

module.exports = { registerQuickSightUser };