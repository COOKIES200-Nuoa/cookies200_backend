import { expect as expectCDK, haveResource } from '@aws-cdk/assert';
import { MyStack } from '../src/lib/stack';
import * as cdk from 'aws-cdk-lib';

describe('MyStack', () => {
  const app = new cdk.App();
  const stack = new MyStack(app, 'TestStack');

  it('creates an S3 bucket', () => {
    //example checking the creation of S3
    expectCDK(stack).to(haveResource('AWS::S3::Bucket'));
  });
});