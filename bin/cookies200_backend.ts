#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AuthStack } from "../src/lib/auth_stack";
import { QuickSightIntegrationStack } from "../src/lib/stack";
// import { TenantStack } from "../src/lib/tenant_stack";

const app = new cdk.App();

// new QuickSightIntegrationStack(
//   app,
//   "QuickSightIntegrationStack",
//   {
//     env: {
//       account: process.env.CDK_DEFAULT_ACCOUNT,
//       region: process.env.CDK_DEFAULT_REGION,
//     },
//   }
// );

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
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
  }
);
// new AuthStack(app, "AuthStack", {
//   userPoolId: "your-user-pool-id",
//   userPoolArn: "your-user-pool-arn",
//   userPoolProviderName: "your-user-pool-provider-name",
//   userPoolProviderUrl: "your-user-pool-provider-url",
//   // add other required properties here
// });

// new TenantStack(app, "TenantStack", {});
app.synth();
