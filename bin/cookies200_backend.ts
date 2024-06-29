#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AuthStack } from "../src/lib/auth_stack";
import { QuickSightIntegrationStack } from "../src/lib/stack";
import { TenantStack } from "../src/lib/tenant_stack";

const app = new cdk.App();

// new AuthStack(app, "AuthStack", {
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: process.env.CDK_DEFAULT_REGION,
//   },
// });

new QuickSightIntegrationStack(app, "QuickSightIntegrationStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

// new AuthStack(app, "AuthStack", quickSightIntegrationStack.userPool);

new TenantStack(app, "TenantStack", {});
app.synth();
