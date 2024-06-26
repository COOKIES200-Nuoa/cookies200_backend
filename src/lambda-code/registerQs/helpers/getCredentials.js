const AWS = require('aws-sdk')
const jwt = require('jsonwebtoken')
const region = process.env.REGION;
// const identityPoolId = process.env.IDPOOL_ID;
// const userPoolId = process.env.USER_POOL_ID;

// const cognitoIdentity = new AWS.CognitoIdentity({ region: region});
// const cognitoISP = new AWS.CognitoIdentityServiceProvider({ region: region })

async function getCredentials(idToken) {
    // Get user's assigned role from the ID token
    let roleArn = null;
    try {
        const decodedToken = jwt.decode(idToken);
        const roles = decodedToken['cognito:roles'];
        if (!roles || roles.length === 0) {
            throw new Error('No roles found in the ID token. ');
        }

        roleArn = roles[0]; // Get the assigned role
    } catch (error) {
        console.error('Error extracting role from ID token:', error);
        throw error;
    }

    // Assume assigned role
    try {
        if (!roleArn.endsWith("authenticated")) { // Check user belongs to a tenant and is assigned a tenant role
            const sts = new AWS.STS();
            const assumedRoleParams = {
                RoleArn: roleArn,
                RoleSession: "tenant-session"
            };
            const assumeRoleResult = await sts.assumeRole(assumedRoleParams).promise();

            return {
                roleArn,
                credentials: assumeRoleResult.Credentials
            };
        } else {
            console.log("Default authenticated role, no need to assume another role."); // Check user does not belongs to a tenant and is using the default authenticated role
            throw new Error("User does not belong to any tenant. Access Denied!");
        }
    } catch (error) {
        console.error('Error assuming role:', error);
    }

//     var identityId;
//     console.log("Identity Pool ID: ", identityPoolId );
//     console.log("User Pool ID: ", userPoolId);

// // ========= Exchange for Credentials =========
//     const getIdParams = {
//         IdentityPoolId: identityPoolId,
//         Logins: {
//             [`cognito-idp.${region}.amazonaws.com/${userPoolId}`]: idToken 
//         }
//     }; 
//     // Get Cognito Identity ID
//     try {
//         const idData = await cognitoIdentity.getId(getIdParams).promise();
//         identityId = idData.IdentityId 
//     } catch (error) {
//         console.log("Error getting Cognito ID ", error.message);
//     }

// // ========= Generate Role Session Name and Assume Role =========
//     const getCredentialsParams = {
//         IdentityId: identityId, 
//         Logins: {
//             [`cognito-idp.${region}.amazonaws.com/${userPoolId}`]: idToken
//         }
//     };
//     // Get Credential Data
//     try {
//         const credentialsData = await cognitoIdentity.getCredentialsForIdentity(getCredentialsParams).promise(); 
//         return credentialsData;
//     } catch (error) {
//         console.log("Error getting Credential Data: ", error.message);
//     }
// };

};

// async function getCognitoUserEmail(accessToken) {
//     const getUserParams = {
//         AccessToken: accessToken
//     };

//     // Get Cognito User's Email
//     try {
//         const userData = await cognitoISP.getUser(getUserParams).promise();
//             const emailData = userData.UserAttributes.find(Attr => Attr.Name === 'email');
//             const email = emailData.Value;
//             console.log("User's email: ", email);
//             return email;
//     } catch (error) {
//         console.log("Error getting Cognito User's Email: ", error.message);
//     }
// };

module.exports = { getCredentials };