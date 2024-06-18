import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";

export class QuickSightIntegrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

// ========= Create User Pool =========
    // Create a new Cognito user pool with self-sign-up disabled
    const userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: false, // Disabled self sign-up (cuz admin creates account)
      userPoolName: "TenantUserPool",
      autoVerify: { email: true },
      // Configure the email and password requirements
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireUppercase: true,
        requireLowercase: true,
        requireSymbols: true,
      },
      signInAliases: {
        email: true
      },
    });
    // Output the user pool ID (useful for configuring other systems/for administrative purposes)
    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });

    // Create User pool client for interacting with quicksight and identity pool
    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool: userPool,
      generateSecret: false,
      userPoolClientName: "NuoaQuicksight",
      authFlows: {
        userPassword: true, // Enable USER_PASSWORD_AUTH flow
      },
    })

  // ========= Defining Tenant Groups =========
    const tenantGroups = [
      "TenantA",
      "TenantB",
    ];

    // Create Cognito group for each Tenant
    const cognitoGroups: cognito.CfnUserPoolGroup[] = [];
    const roleMappings: {[key: string]: string } = {}; // Initialize an empty mapping
    tenantGroups.forEach(tenantName => {
      const group = new cognito.CfnUserPoolGroup(this, `${tenantName}Group`, {
        userPoolId: userPool.userPoolId,
        groupName: tenantName,
      });
      cognitoGroups.push(group); // Add the group to the list
      // Create tenant-specific IAM role
      const role = new iam.Role(this, `${tenantName}Role`, {
        assumedBy: new iam.WebIdentityPrincipal(
          "cognito-identity.amazonaws.com",
          {
            StringEquals: {
              "cognito-identity.amazonaws.com:aud": identityPool.ref,
            },
            "ForAnyValue:StringLike": {
              "cognito-indetity.amazonaws.com:amr": "authenticated",
            },
          }
        ),
      });
      // Add permissions to tenant-specific role
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "quicksight:DescribeDashboard",
          "quicksight:ListDashboards",
          "quicksight:GetDashboardEmbedUrl",
          "quicksight:GenerateEmbedUrlForRegisteredUser",
          "quicksight:RegisterUser"
        ], // Add permissions here
        resources: [`arn:aws:quicksight:${this.region}:${this.account}:namespace/${tenantName}`], // Specify resources later here (preferably tenant's namespace)
      }));
      // Add Role Mapping to Identity Pool
      roleMappings[
        `cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}:${group.ref}`
      ] = role.roleArn;

      role.assumeRolePolicy?.addStatements(
        new iam.PolicyStatement({
          actions: ["sts:AssumeRole"],
          principals: [new iam.ArnPrincipal(authenticatedRole.roleArn)],
        })
      );
    });

  // ========= Creating Cognito Identity Pool =========
    // Create new Cognito identity pool for interacting with Quicksight
    const identityPool = new cognito.CfnIdentityPool(this, "TenantIdentityPool", {
      identityPoolName: "TenantIdentityPool",
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [{
        clientId: userPoolClient.userPoolClientId,
        providerName: userPool.userPoolProviderName,
        serverSideTokenCheck: true,
      }],
    });
    // Add role mappings
    identityPool.addPropertyOverride('RoleMappings', roleMappings);

    // Create Roles for authenticated and unauthenticated users
    const authenticatedRole = new iam.Role(this, "AuthenticatedRole", {
        assumedBy: new iam.WebIdentityPrincipal(
            "cognito-identity.amazonaws.com",
            {
                StringEquals: {
                    "cognito-identity.amazonaws.com:aud": identityPool.ref, // Reference to your Identity Pool
                },
                "ForAnyValue:StringLike": {
                    "cognito-identity.amazonaws.com:amr": "authenticated", // Only allow authenticated users
                },
            }
        ),
    });

    // Add Permissions to the Authenticated Role
    authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "mobileanalytics:PutEvents",
          "cognito-sync:*",
          "cognito-identity:*"
        ],
        resources: ["*"],
      })
    );
    // Attach the Identity pool to the User pool
    new cognito.CfnIdentityPoolRoleAttachment(this, "IdentityPoolRoleAttachment", {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
      },
    });

  // ========= Creating lambda function =========
    // Create IAM Role for Lambda to interact with QuickSight and Cognito
    const lambdaRole = new iam.Role(this, "LambdaExecutionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "quicksight:*",
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminAddUserToGroup",
        ],
        resources: ["*"],
      })
    );

    // Get identity pool's id
    const identityPoolId = cdk.Fn.getAtt(identityPool.logicalId, "IdentityPoolId").toString();

    // Lambda function for QuickSight account registration
    const qsLambda = new lambda.Function(this, "QuickSightLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "quicksightOnboarding",
      // so does Lambda return a Quicksight access token or create a new Quicksight account
      code: lambda.Code.fromAsset("src/lambda-function/onboarding"),
      role: lambdaRole, // Assign the role here
      environment: {
        REGION: this.region,
        ID_TYPE: 'IAM',
        AWS_ACC_ID: this.account,
        USER_ROLE: 'READER',
        EMAIL:'s3938145@rmit.edu.vn',
        QUICKSIGHT_ADMIN: 'Cookies200',
        IDPOOL_ID: identityPoolId,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });
  }
}
