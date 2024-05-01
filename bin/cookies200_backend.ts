#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MyStack } from '../src/lib/stack';

const app = new cdk.App();
new MyStack(app, 'MyStack', {
  //pass stack props. gonna set up later
});

app.synth(); 