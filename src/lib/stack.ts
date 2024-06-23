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
    // Create Identity Pool FIRST
    const identityPool = new cognito.CfnIdentityPool(
      this,
      'TenantIdentityPool',
      {
        identityPoolName: 'TenantIdentityPool',
        allowUnauthenticatedIdentities: false,
        cognitoIdentityProviders: [
          {
            clientId: userPoolClient.userPoolClientId,
            providerName: userPool.userPoolProviderName,
            serverSideTokenCheck: true,
          },
        ],
      }
    );

    // Output the Identity Pool ID
    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: identityPool.ref,
      description: 'The ID of the Cognito Identity Pool',
    });

    // Create Roles for authenticated users
    const nuoaAuthRole = new iam.Role(this, 'NuoaAuthRole', {
      assumedBy: new iam.WebIdentityPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        }
      ),
      description: 'Default role for authenticated users',
    });
    // Add policies for cognito operations
    nuoaAuthRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'mobileanalytics:PutEvents',
          'cognito-sync:*',
          'cognito-identity:*',
        ],
        resources: ['*'],
      })
    );
    // Add policies for assume tenant role
    nuoaAuthRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/*TenantRole*`],
      })
    );

    // // ========= Defining Tenant Groups =========

    // const tenantGroups = ['TenantA', 'TenantB']; // Replace with trigger with user input later 

    // const roleMappings: { [key: string]: any } = {};

    // tenantGroups.forEach((tenantName) => {
    //   const group = new cognito.CfnUserPoolGroup(this, `${tenantName}`, {
    //     userPoolId: userPool.userPoolId,
    //     groupName: tenantName,
    //   });

    //   // Create tenant-specific IAM role
    //   const tenantRole = new iam.Role(this, `${tenantName}TenantRole`, {
    //     assumedBy: new iam.PrincipalWithConditions(new iam.ArnPrincipal(nuoaAuthRole.roleArn), {
    //       "StringEquals": {
    //         "sts:ExternalId": `${tenantName}`,
    //       },
    //     }),
    //     description: `Role for ${tenantName}`,
    //   });

    //   // Add permissions to tenant-specific role
    //   tenantRole.addToPolicy(
    //     new iam.PolicyStatement({
    //       effect: iam.Effect.ALLOW,
    //       actions: [
    //         'quicksight:DescribeDashboard',
    //         'quicksight:ListDashboards',
    //         'quicksight:GetDashboardEmbedUrl',
    //         'quicksight:GenerateEmbedUrlForRegisteredUser',
    //         'quicksight:RegisterUser',
    //       ], 
    //       resources: [`arn:aws:quicksight:${this.region}:${this.account}:namespace/${tenantName}`], 
    //     })
    //   );

    // // Configure the rule-based mapping
    // roleMappings[
    //   `cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}:${userPoolClient.userPoolClientId}` // Identity provider
    //   ] = {
    //       Type: 'Rules',
    //       AmbiguousRoleResolution: 'Deny', // Or choose another resolution strategy
    //       RulesConfiguration: {
    //           Rules: [
    //               {
    //                   Claim: 'cognito:groups',
    //                   MatchType: 'Equals',
    //                   Value: `${tenantName}`, // Use the group name as the value
    //                   RoleARN: tenantRole.roleArn, // Assign the role ARN
    //               },
    //           ],
    //       },
    //   };
    // });

    // const roleMappingsJson = new cdk.CfnJson(this, `RoleMappingsJson`, {
    //   value: roleMappings,
    // });

    // // Attach the Identity Pool to the User Pool
    // new cognito.CfnIdentityPoolRoleAttachment(this, `IdentityPoolRoleAttachment`, {
    //   identityPoolId: identityPool.ref,
    //   roles: {
    //     authenticated: nuoaAuthRole.roleArn,
    //   },
    //   roleMappings: roleMappingsJson,
    // });

    // ========= Creating lambda function =========
    const lambdaRole = new iam.Role(this, 'NuoaLambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'quicksight:*',
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminAddUserToGroup',
        ],
        resources: ['*'],
      })
    );

    const identityPoolId = cdk.Fn.getAtt(
      identityPool.ref,
      'IdentityPoolId'
    ).toString();

    new lambda.Function(this, 'QuickSightLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'quicksightOnboarding',
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

    // Export values
    new cdk.CfnOutput(this, 'UserPoolIdOutput', { value: userPool.userPoolId, exportName: 'UserPoolIdOutput'});
    new cdk.CfnOutput(this, 'UserPoolClientIdOutput', { value: userPoolClient.userPoolClientId, exportName: 'UserPoolClientIdOutput'});
    new cdk.CfnOutput(this, 'IdentityPoolIdOutput', { value: identityPool.ref , exportName: 'IdentityPoolIdOutput'});
    new cdk.CfnOutput(this, 'NuoaAuthRoleArnOutput', { value: nuoaAuthRole.roleArn , exportName: 'NuoaAuthRoleArnOutput'});
  }
}