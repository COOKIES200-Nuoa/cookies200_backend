#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { QuickSightIntegrationStack } from '../src/lib/stack'; 

const app = new cdk.App();
new QuickSightIntegrationStack(app, 'QuickSightIntegrationStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  }
});

app.synth();