import {
  aws_lambda as lambda,
  aws_apigateway as apigateway,
  aws_cognito as cognito,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";

export class AuthStack extends Stack {
  constructor(scope: Construct, id: string, userPool: cognito.UserPool, props?: StackProps) {
    super(scope, id, props);

    // Define a new Lambda resource
    const generateDashboardUrlFunc = new lambda.Function(
      this,
      "BackendHandler",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        code: lambda.Code.fromAsset("src/lambda-code/QSaccess"),
        handler: "generateDashboardUrl.handler",
      }
    );

    // Define the API Gateway
    const api = new apigateway.RestApi(this, "UserApi", {
      restApiName: "Login API",
      description: "API to handle user login and return dashboard URL",
    });
    
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "UserAuthorizer",
      {
        cognitoUserPools: [userPool],
      }
    );

    // Lambda Integration
    const lambdaIntegration = new apigateway.LambdaIntegration(
      generateDashboardUrlFunc,
      {
        requestTemplates: { "application/json": '{ "statusCode": "200" }' },
      }
    );
    // Define a new resource and method with Cognito Authorizer
    const loginResource = api.root.addResource("login");
    loginResource.addMethod("POST", lambdaIntegration, {
      authorizer: authorizer,
    });

    // ========= Output API Gateway Endpoint =========
    new CfnOutput(this, "LoginApiUrl", {
      value: api.url + "login",
      description:
        "The URL to call for user login and retrieving the dashboard URL",
    });
  }
}
