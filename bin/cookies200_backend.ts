#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AuthStack } from "../src/lib/auth_stack";
import { GenerateQSUrlStack } from "../src/lib/generateQSUrl_stack";
import { CognitoStack } from "../src/lib/cognito_stack";
import { QuickSightOnboardingStack } from "../src/lib/onboarding_stack";
import { DynamoDBExportStack } from "../src/lib/database_stack"

const app = new cdk.App();

const cognitoStack = new CognitoStack(app, "CognitoStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

const onboardingStack = new QuickSightOnboardingStack(
  app,
  "OnboardingStack",
  cognitoStack.userPool,
  cognitoStack.userPoolClientId,
  cognitoStack.nuoaAuthRoleARN,
  cognitoStack.identityPoolId,
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  }
);

const authStack = new AuthStack(
  app,
  "AuthStack",
  cognitoStack.userPool,
  cognitoStack.userPoolClientId,
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  }
);

const generateQSUrlStack = new GenerateQSUrlStack(
  app,
  "GenerateQSUrlStack",
  cognitoStack.userPool,
  cognitoStack.userPoolClientId,
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  }
);

new DynamoDBExportStack(app, 'DynamoDBExportStack');

app.synth();
