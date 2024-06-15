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

  // ========= Creating Cognito Identity Pool =========
    // Create new Cognito identity pool for interacting with Quicksight
    const identityPool = new cognito.CfnIdentityPool(this, "TenantIdentityPool", {
      identityPoolName: "TenantIdentityPool",
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [{
        clientId: userPoolClient.userPoolClientId,
        providerName: userPool.userPoolProviderName,
      }]
    });
    // Create Roles for authenticated and unauthenticated users
    const authenticatedRole = new iam.Role(this, "CognitoAuthRole", {
      assumedBy: new iam.WebIdentityPrincipal("cognito-identity.amazonaws.com", {
        StringEquals: {
          "cognito-identity.amazonaws.com:aud": identityPool.ref,
        },
        "ForAnyValue:StringLike": {
          "cognito-identity.amazonaws.com:amr": "authenticated",
        },
      }),
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
      handler: "index.onboarding",
      // so does Lambda return a Quicksight access token or create a new Quicksight account
      code: lambda.Code.fromAsset("src/lambda-code/onboarding"),
      role: lambdaRole, // Assign the role here
      environment: {
        REGION: 'ap-southeast-1',
        ID_TYPE: 'IAM',
        AWS_ACC_ID: '891377270638',
        USER_ROLE: 'READER',
        QUICKSIGHT_ADMIN: 'Cookies200',
        ASSUMED_ROLE_ARN: 'TBD',
        IDPOOL_ID: identityPoolId,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });
  }
}
