import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications';

export class GlueStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Reference existing S3 Bucket for processed data
    const processedDataBucket = s3.Bucket.fromBucketName(this, 'ProcessedDataBucket', 'processed-nuoa-database');

    // IAM Role for Glue Job
    const glueRole = new iam.Role(this, 'GlueJobRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
      ],
    });

    glueRole.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:ListBucket', 's3:PutObject', 's3:DeleteObject' ],
      resources: [
        `arn:aws:s3:::nuoadatabase`,
        `arn:aws:s3:::nuoadatabase/*`,
        processedDataBucket.bucketArn,
        `${processedDataBucket.bucketArn}/*`,
      ],
    }));

    // Glue Job
    const glueJob = new glue.CfnJob(this, 'GlueJob', {
      role: glueRole.roleArn,
      command: {
        name: 'glueetl',
        scriptLocation: 's3://processed-nuoa-database/glue__job.py', 
        pythonVersion: '3',
      },
      defaultArguments: {
        '--job-bookmark-option': 'job-bookmark-enable',
        '--processed_bucket': processedDataBucket.bucketName, 
      },
      glueVersion: '4.0',
      maxCapacity: 2.0,
    });


    // Construct ARN for Glue Job
    const glueJobArn = `arn:aws:glue:${this.region}:${this.account}:job/${glueJob.ref}`;

    // IAM Role for Lambda Function
    const lambdaRole = new iam.Role(this, 'GlueJobTriggerLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['glue:StartJobRun'],
      resources: [glueJobArn], 
    }));

    // Lambda Function to Trigger Glue Job
    const triggerFunction = new lambda.Function(this, 'TriggerGlueJobFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('src/lambda-code/dtbpipeline'),
      handler: 'glueTrigger.glueTrigger',
      role: lambdaRole,
      environment: {
        JOB_NAME: glueJob.ref, 
      },
    });

    // S3 Bucket for raw data
    const rawDataBucket = s3.Bucket.fromBucketName(this, 'NuoaDatabaseBucket', 'nuoadatabase');

    // Add S3 notification to trigger the Lambda function
    rawDataBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3Notifications.LambdaDestination(triggerFunction));
  }
}

