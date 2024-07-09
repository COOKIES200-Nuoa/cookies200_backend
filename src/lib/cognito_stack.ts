import {
  aws_iam as iam,
  aws_cognito as cognito,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
// import * as cognito from 'aws-cdk-lib/aws-cognito';
// import * as lambda from 'aws-cdk-lib/aws-lambda';
// import * as iam from 'aws-cdk-lib/aws-iam';
// import * as targets from 'aws-cdk-lib/aws-events-targets';
// import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';

export class CognitoStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClientId: string;
  public readonly nuoaAuthRoleARN: string;
  public readonly identityPoolId: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // ========= Create User Pool =========
    const userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: false,
      userPoolName: "TenantUserPool",
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


    // Cognito Domain (Hosted UI)
    userPool.addDomain('EmbedDashboardDomain', {
      cognitoDomain: {
        domainPrefix: this.account
      }
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: "NuoaQuicksight",
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      oAuth: {
        scopes: [
          cognito.OAuthScope.OPENID, 
          cognito.OAuthScope.PROFILE
        ],
        flows: {
          implicitCodeGrant: true
        },
        callbackUrls: ['https://dummy'], // Placeholder URL
        logoutUrls: ['https://dummy']
      },
      // generateSecret: false,
      // authFlows: {
      //   userPassword: true,
      // },
    });

    // ========= Creating Cognito Identity Pool =========
    // Create Identity Pool FIRST

    const identityPool = new cognito.CfnIdentityPool(this, 'TenantIdentityPool',
      {
        identityPoolName: "TenantIdentityPool",
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
    new CfnOutput(this, "IdentityPoolId", {
      value: identityPool.ref,
      description: "The ID of the Cognito Identity Pool",
    });

    // Create Roles for authenticated users
    const nuoaAuthRole = new iam.Role(this, "NuoaAuthRole", {
      assumedBy: new iam.WebIdentityPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated",
          },
        }
      ),
      description: "Default role for authenticated users",
    });

    // Add policies for cognito operations
    nuoaAuthRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "mobileanalytics:PutEvents",
          "cognito-sync:*",
          "cognito-identity:*",
        ],
        resources: ["*"],
      })
    );
    
    // Add policies for assume tenant role
    nuoaAuthRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${this.account}:role/*TenantRole*`],
      })
    );

    // // ========= Creating lambda function =========
    // const lambdaRole = new iam.Role(this, "NuoaLambdaExecutionRole", {
    //   assumedBy: new iam.CompositePrincipal( // Use CompositePrincipal to combine principals
    //     new iam.ServicePrincipal("lambda.amazonaws.com"),
    //     new iam.ServicePrincipal("quicksight.amazonaws.com")
    //   ),
    // });

    // // Policies for creating Dashboard, Tenant Group, Tenant Role, and Role Mapping
    // lambdaRole.addToPolicy(
    //   new iam.PolicyStatement({
    //     effect: iam.Effect.ALLOW,
    //     actions: [
    //       'quicksight:CreateNamespace',
    //       'quicksight:CreateTemplate',
    //       'quicksight:CreateAnalysis',
    //       'quicksight:CreateDashboard',
    //       'quicksight:PassDataSet',
    //       'quicksight:UpdateAnalysisPermissions',
    //       'quicksight:UpdateDashboardPermissions',
    //       'quicksight:DescribeNamespace',
    //       'quicksight:DescribeTemplate',
    //       'quicksight:DescribeAnalysis',
    //       'quicksight:DescribeDashboard',
    //       'quicksight:RegisterUser',
    //     ],
    //     resources: ['*'],
    //   })
    // );

    // lambdaRole.addToPolicy(
    //   new iam.PolicyStatement({
    //     effect: iam.Effect.ALLOW,
    //     actions: [
    //       'cognito-idp:CreateGroup',
    //     ],
    //     resources: ['*'],
    //   })
    // );

    // lambdaRole.addToPolicy(
    //   new iam.PolicyStatement({
    //     effect: iam.Effect.ALLOW,
    //     actions: [
    //       'iam:CreateRole',
    //       'iam:PutRolePolicy',
    //       'iam:GetRole',
    //       "iam:CreateServiceLinkedRole",
    //       "iam:PutRolePolicy",
    //       "iam:DeleteRole",
    //       "iam:AttachRolePolicy",
    //       "iam:DeleteRolePolicy",
    //       "iam:ListRolePolicies",
    //       "iam:ListAttachedRolePolicies",
    //       "iam:DetachRolePolicy",
    //     ],
    //     resources: ["*"],
    //   })
    // );

    // // Directory Services policies for creating Namespace
    // lambdaRole.addToPolicy(
    //   new iam.PolicyStatement({
    //     effect: iam.Effect.ALLOW,
    //     actions: [
    //       "ds:CreateIdentityPoolDirectory",
    //       "ds:DescribeDirectories",
    //       "ds:AuthorizeApplication",
    //     ],
    //     resources: [`*`],
    //   })
    // );

    // lambdaRole.addToPolicy(
    //   new iam.PolicyStatement({
    //     effect: iam.Effect.ALLOW,
    //     actions: ["iam:PassRole"],
    //     resources: [
    //       `arn:aws:iam::${this.account}:role/*TenantRole`,
    //       `${nuoaAuthRole.roleArn}`,
    //     ],
    //   })
    // );

    // lambdaRole.addToPolicy(
    //   new iam.PolicyStatement({
    //     effect: iam.Effect.ALLOW,
    //     actions: [
    //       "cognito-identity:SetIdentityPoolRoles",
    //       "cognito-identity:GetIdentityPoolRoles",
    //     ],
    //     resources: [
    //       `arn:aws:cognito-identity:${this.region}:${this.account}:identitypool/*`,
    //     ],
    //   })
    // );

    // const qsOnboardingFunction = new lambda.Function(this, 'QuickSightOnboardingLambda', {
    //   runtime: lambda.Runtime.NODEJS_18_X,
    //   handler: 'quicksightOnboarding.quicksightOnboarding',
    //   code: lambda.Code.fromAsset('src/lambda-code/onboarding'),
    //   role: lambdaRole,
    //   environment: {
    //     REGION: this.region,
    //     AWS_ACC_ID: this.account,
    //     QUICKSIGHT_ADMIN_ID: 'Cookies200',
    //     USER_POOL_ID: userPool.userPoolId,
    //     IDPOOL_ID: identityPool.ref,
    //     USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
    //     AUTH_ROLE_ARN: nuoaAuthRole.roleArn,
    //     DATASET: 'bc93b225-e6f7-4664-8331-99e66f5b7841', // Place holder dataset
    //   },
    //   timeout: cdk.Duration.minutes(1),
    // });

    // lambdaRole.addManagedPolicy(
    //   iam.ManagedPolicy.fromAwsManagedPolicyName(
    //     "service-role/AWSLambdaBasicExecutionRole"
    //   )
    // );

    // const trail = new cloudtrail.Trail(this, "CloudTrail");

    // const eventRule = cloudtrail.Trail.onEvent(this, "MyCloudWatchEvent", {
    //   target: new targets.LambdaFunction(qsOnboardingFunction),
    // });

    // eventRule.addEventPattern({
    //   account: [this.account],
    //   source: ["aws.cognito-idp"],
    //   detailType: ["AWS API Call via CloudTrail"],
    //   detail: {
    //     eventSource: ["cognito-idp.amazonaws.com"],
    //     eventName: ["CreateGroup"],
    //   },
    // });

    // Store the User Pool ID in the public property
    this.userPool = userPool;
    // Store the User Pool client ID in the public property
    this.userPoolClientId = userPoolClient.userPoolClientId;
    this.nuoaAuthRoleARN = nuoaAuthRole.roleArn;
    this.identityPoolId = identityPool.ref;
  }
}
