const AWS = require('aws-sdk')
const { createQuickSightResource } = require('./createQsResources');

const region = process.env.REGION;
const identityType = process.env.ID_TYPE;
const awsAccountId = process.env.AWS_ACC_ID;
const userRole = process.env.USER_ROLE;
const assumeRole = process.env.ASSUMED_ROLE_ARN;

var roleCredentialsData;

async function registerQuickSightUser(tenant , email, accessKey, secretKey, sessionToken) {
// ========= Generate Role Session Name and Assume Role =========
    const sts = new AWS.STS({
        region: region,
        credentials: {
            accessKeyId: accessKey,
            secretAccessKey:secretKey,
            sessionToken: sessionToken,
        }
    });

// ========= Assume the IAM Role =========
    const assumeRoleParams = {
        RoleArn: assumeRole,
        RoleSessionName: `${tenant}RegistrationSession`,
    }
    try {
        roleCredentialsData = await sts.assumeRole(assumeRoleParams).promise();
    } catch (error) {
        console.log("Error Assuming Role: ", error.message);
    }

// ========= Create Quicksight instance using assumed role's credentials =========
    const quicksight = new AWS.QuickSight({
        accessKeyId: roleCredentialsData.Credentials.AccessKeyId,
        secretAccessKey: roleCredentialsData.Credentials.SecretAccessKey,
        sessionToken: roleCredentialsData.Credentials.SessionToken,
        region: region
    });

    const registerUser = createQuickSightResource('User', quicksight.registerUser);

// ========= Register User Params =========
    const registerUserParams = {
        IdentityType: identityType,
        AwsAccountId: awsAccountId,  
        Namespace: tenant, 
        SessionName:tenant,
        UserRole: userRole,
        Email: email,
        IamArn: assumeRole,
    };

// ========= Register User =========
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
};

module.exports = { registerQuickSightUser };