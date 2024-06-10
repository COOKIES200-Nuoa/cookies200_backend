import { expect as expectCDK, haveResource } from '@aws-cdk/assert';
import { QuickSightIntegrationStack } from '../src/lib/stack'; // Adjust the import path as necessary
import * as cdk from 'aws-cdk-lib';

describe('QuickSightStack', () => {
  const app = new cdk.App();
  const stack = new QuickSightIntegrationStack(app, 'TestQuickSightStack');

  // Example test: checks for a QuickSight dataset
  it('creates a QuickSight dataset', () => {
    expectCDK(stack).to(haveResource('AWS::QuickSight::DataSet'));
  });
});