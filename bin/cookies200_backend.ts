#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { QuickSightIntegrationStack } from '../src/lib/stack';

const app = new cdk.App();
new QuickSightIntegrationStack(app, 'MyStack', {
  //pass stack props. gonna set up later
});

app.synth(); 