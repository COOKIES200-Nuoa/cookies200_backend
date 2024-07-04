#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AuthStack } from "../src/lib/auth_stack";
import { QuickSightIntegrationStack } from "../src/lib/stack";

const app = new cdk.App();

const qsIntegrationStack = new QuickSightIntegrationStack(
  app,
  "QuickSightIntegrationStack",
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  }
);

const authStack = new AuthStack(
  app,
  "AuthStack", qsIntegrationStack.userPool,
  qsIntegrationStack.userPoolClientId,
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  }
);
app.synth();
