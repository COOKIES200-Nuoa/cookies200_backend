import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class MyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    //sample s3 creation
    new s3.Bucket(this, 'MyUniqueBucketId', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}