import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";

export class QuickSightIntegrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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

    // Lambda function for QuickSight account registration
    const qsLambda = new lambda.Function(this, "QuickSightLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      // so does Lambda return a Quicksight access token or create a new Quicksight account
      code: lambda.Code.fromAsset("path/to/lambda/folder"),
      role: lambdaRole, // Assign the role here
      environment: {
        QUICKSIGHT_NAMESPACE: "default",
      },
    });

    // Output the user pool ID (useful for configuring other systems/for administrative purposes)
    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });
  }
}

const app = new cdk.App();
new QuickSightIntegrationStack(app, "QuickSightIntegrationStack");
