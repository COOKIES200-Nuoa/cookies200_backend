import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

export class QuickSightIntegrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========= Create User Pool =========
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: false,
      userPoolName: 'TenantUserPool',
      autoVerify: { email: true },
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
        username: true,
        email: true,
      },
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      generateSecret: false,
      userPoolClientName: 'NuoaQuicksight',
      authFlows: {
        userPassword: true,
      },
    });

    // ========= Creating Cognito Identity Pool ========= 
    const identityPool = new cognito.CfnIdentityPool(this, 'TenantIdentityPool', {
      identityPoolName: 'TenantIdentityPool',
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [{
        clientId: userPoolClient.userPoolClientId,
        providerName: `cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
        serverSideTokenCheck: true,
      }],
    });

    // Output the Identity Pool ID
    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: identityPool.ref,
      description: 'The ID of the Cognito Identity Pool',
    });

    // Create Roles for authenticated users
    const nuoaAuthRole = new iam.Role(this, 'NuoaAuthRole', {
      assumedBy: new iam.WebIdentityPrincipal('cognito-identity.amazonaws.com'),
      description: 'Default role for authenticated users',
    });

    nuoaAuthRole.assumeRolePolicy?.addStatements(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sts:AssumeRoleWithWebIdentity'],
      principals: [new iam.ServicePrincipal('cognito-identity.amazonaws.com')],
      conditions: {
        StringEquals: {
          'cognito-identity.amazonaws.com:aud': identityPool.ref,
        },
        'ForAnyValue:StringLike': {
          'cognito-identity.amazonaws.com:amr': 'authenticated',
        },
      }
    }));

    // Add policies for cognito operations
    nuoaAuthRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['mobileanalytics:PutEvents', 'cognito-sync:*', 'cognito-identity:*'],
      resources: ['*'],
    }));

    nuoaAuthRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sts:AssumeRole'],
      resources: [`arn:aws:iam::${this.account}:role/*TenantRole*`],
    }));

    // ========= Defining Tenant Groups and Roles =========
    const tenantGroups = ['TenantA', 'TenantB'];
    const roleMappings: { [key: string]: { Type: string, AmbiguousRoleResolution: string } } = {};

    tenantGroups.forEach(tenantName => {
      const group = new cognito.CfnUserPoolGroup(this, `${tenantName}Group`, {
        userPoolId: userPool.userPoolId,
        groupName: tenantName,
      });

      const tenantRole = new iam.Role(this, `${tenantName}TenantRole`, {
        assumedBy: new iam.ArnPrincipal(nuoaAuthRole.roleArn),
      });

      tenantRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'quicksight:DescribeDashboard',
          'quicksight:ListDashboards',
          'quicksight:GetDashboardEmbedUrl',
          'quicksight:GenerateEmbedUrlForRegisteredUser',
          'quicksight:RegisterUser',
        ],
        resources: [`arn:aws:quicksight:${this.region}:${this.account}:namespace/${tenantName}`],
      }));

      roleMappings[`cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}:${group.ref}`] = {
        Type: 'Token',
        AmbiguousRoleResolution: 'Deny',
      };
    });

    const roleMappingsJson = new cdk.CfnJson(this, 'RoleMappingsJson', {
      value: roleMappings,
    });
    
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: nuoaAuthRole.roleArn,
      },
      roleMappings: roleMappingsJson.value, // Use value property
    });

    // ========= Creating lambda function =========
    const lambdaRole = new iam.Role(this, 'NuoaLambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['quicksight:*', 'cognito-idp:AdminCreateUser', 'cognito-idp:AdminAddUserToGroup'],
      resources: ['*'],
    }));

    new lambda.Function(this, 'QuickSightLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'quicksightOnboarding.handler',
      code: lambda.Code.fromAsset('src/lambda-function/onboarding'),
      role: lambdaRole,
      environment: {
        REGION: this.region,
        ID_TYPE: 'IAM',
        AWS_ACC_ID: this.account,
        USER_ROLE: 'READER',
        EMAIL: 's3938145@rmit.edu.vn',
        QUICKSIGHT_ADMIN: 'Cookies200',
        IDPOOL_ID: identityPool.ref,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });
  }
}