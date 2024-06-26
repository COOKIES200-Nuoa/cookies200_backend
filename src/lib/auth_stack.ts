import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam'; 

interface AuthStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  identityPool: cognito.CfnIdentityPool;
  authRole: iam.Role;
}

export class AuthStack extends cdk.Stack {
  public readonly loginApiUrl: cdk.CfnOutput;
  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    // ========= Creating lambda function =========
    const getDashboardUrlFunction = new lambda.Function(this, 'GetDashboardUrlFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'getDashboardUrl.handler',
      code: lambda.Code.fromAsset('src/lambda-code/QSaccess'), 
      role: props.authRole,
      environment: {
        REGION: this.region,
        USER_POOL_ID: props.userPool.userPoolId,
        IDENTITY_POOL_ID: props.identityPool.ref,
    
      },
    });

    // ========= API Gateway =========
    const api = new apigw.RestApi(this, 'LoginApi', {
      restApiName: 'Login API',
      description: 'API to handle user login and return dashboard URL',
    });

    const loginIntegration = new apigw.LambdaIntegration(getDashboardUrlFunction);
    const loginResource = api.root.addResource('login'); 
    loginResource.addMethod('POST', loginIntegration); // POST method for /login

    // ========= Output API Gateway Endpoint =========
    this.loginApiUrl = new cdk.CfnOutput(this, 'LoginApiUrl', {
      value: api.url + 'login', // Output the full URL for the /login endpoint
      description: 'The URL to call for user login and retrieving the dashboard URL',
    });
  }
}