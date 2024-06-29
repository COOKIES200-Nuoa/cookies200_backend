const { CognitoIdentityProviderClient } = require("@aws-sdk/client-cognito-identity-provider"); 
const  { IAMClient, CreateRoleCommand, PutRolePolicyCommand, GetRoleCommand } = require ("@aws-sdk/client-iam");
const { CognitoIdentityClient, SetIdentityPoolRolesCommand, GetIdentityPoolRolesCommand } = require ("@aws-sdk/client-cognito-identity");

const userPoolId = process.env.USER_POOL_ID;
const region = process.env.REGION;
const awsAccountId = process.env.AWS_ACC_ID; 
const nuoaAuthRoleArn = process.env.AUTH_ROLE_ARN;
const identityPoolId = process.env.IDPOOL_ID;
const userPoolClientId = process.env.USER_POOL_CLIENT_ID;

const cognitoClient = new CognitoIdentityProviderClient({ region: region });
const iamClient = new IAMClient({ region: region });
const cognitoIdentityClient = new CognitoIdentityClient({ region: region});

async function createTenant(tenantName) {
    const tenantRoleArn = await createTenantRole(tenantName);
    console.log('Tennant role arn: ', tenantRoleArn);
    await createRoleMapping(tenantName, tenantRoleArn);
    return tenantRoleArn;
};

async function createTenantRole(tenantName) {
    const roleTenantName = `${tenantName}TenantRole`;
        // Construct the assume role policy document as an object
        const assumeRolePolicyDocument = {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: {
                        AWS: nuoaAuthRoleArn,
                    },
                    Action: "sts:AssumeRole",
                    Condition: {
                        StringEquals: {
                            "sts:ExternalId": tenantName,
                        },
                    },
                },
            ],
        };

        // Add permissions to the role (policy document as an object)
        const rolePolicyName = `${roleTenantName}Policy`;
        const policyDocument = {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Action: [
                        "quicksight:DescribeDashboard",
                        "quicksight:ListDashboards",
                        "quicksight:GetDashboardEmbedUrl",
                        "quicksight:GenerateEmbedUrlForRegisteredUser",
                        "quicksight:RegisterUser",
                    ],
                    Resource: [`arn:aws:quicksight:${region}:${awsAccountId}:namespace/${tenantName}`], 
                },
            ],
        };

    try {
        const createRoleCommnand = new CreateRoleCommand({
            RoleName: roleTenantName,
            AssumeRolePolicyDocument:JSON.stringify(assumeRolePolicyDocument),
            Description: `Role for ${tenantName}`,
        });
        const createRoleResponse = await iamClient.send(createRoleCommnand);
        const roleArn = createRoleResponse.Role.Arn;

        console.log(`Role created: ${roleArn}`);

        // Add Role Policies
        const putRolePolicyCommand = new PutRolePolicyCommand({
            RoleName: roleTenantName,
            PolicyName: rolePolicyName,
            PolicyDocument: JSON.stringify(policyDocument),
        });
        await iamClient.send(putRolePolicyCommand);

        console.log(`${rolePolicyName} policy attached to role: ${roleTenantName}; ARN: ${roleArn}`);
        await waitForRoleCreation(roleTenantName);
        return roleArn;
    } catch (error) {
        if (error.Code === "EntityAlreadyExists") {
            console.error("Role already exists.");
        } else {
            console.error("Error creating tenant role:", error);
            throw error; 
        }
    }
};

async function createRoleMapping(tenantName, tenantRoleArn) {
    console.log('Inside createRoleMapping: tenantRoleArn: ', tenantRoleArn);

// 1. Get Existing Role Mappings
    const getIdentityPoolRolesCommandInput = new GetIdentityPoolRolesCommand({
        IdentityPoolId: identityPoolId
    });
    const currentRolesResponse = await cognitoIdentityClient.send(getIdentityPoolRolesCommandInput);
    const existingRoleMappings = currentRolesResponse.RoleMappings || {};

// 2. Retrieve Existing Rules or Create New Array
    const cognitoResourceId = `cognito-idp.${region}.amazonaws.com/${userPoolId}:${userPoolClientId}`;
    const existingRules = existingRoleMappings[cognitoResourceId]?.RulesConfiguration?.Rules || []; // Extract existing rules or initialize an empty array

// 3. Append New Rule to Existing Rules
    existingRules.push({
        Claim: 'cognito:groups',
        MatchType: 'Equals',
        Value: tenantName,
        RoleARN: tenantRoleArn
    });

// 4. Update (or Create) Rule Configuration
    existingRoleMappings[cognitoResourceId] = {
        Type: 'Rules',
        AmbiguousRoleResolution: 'Deny',
        RulesConfiguration: {
            Rules: existingRules
        }
    };

// 5. Set Updated Role Mappingsd
    const params = {
        IdentityPoolId: identityPoolId,
        Roles: {
            authenticated: nuoaAuthRoleArn
        },
        RoleMappings: existingRoleMappings,
    };

    try {
        const command = new SetIdentityPoolRolesCommand(params);
        const response = await cognitoIdentityClient.send(command);
        console.log("Identity Pool roles configured successfully:", response);
    } catch (error) {
        if (error.Code === 'InvalidParameterException') {
            console.error("Invalid parameters:", error.message);
            throw error;
        } else if (error.Code === 'ResourceNotFoundException') {
            console.error("Identity pool or role not found:", error.message);
            throw error;
        } else if (error.Code === 'NotAuthorizedException') {
            console.error("Not authorized to perform this action:", error.message);
            throw error;
        } else {
            console.error("Unexpected error:", error);
            throw error;
        }
    }
};
module.exports = { createTenant };

async function waitForRoleCreation(roleName, retryDelay = 2000, maxRetries = 10) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const command = new GetRoleCommand({ RoleName: roleName });
            await iamClient.send(command); // No need to store the response, just need successful execution
            return; // Role exists, we can proceed
        } catch (error) {
            if (error.Code === "NoSuchEntity") {
                retries++;
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            } else {
                throw error; // Unexpected error
            }
        }
    }
    throw new Error(`Role creation timed out after ${maxRetries} retries`);
}