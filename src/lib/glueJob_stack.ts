import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications';

export class CompleteFlowStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // S3 Bucket for processed data
    const processedDataBucket = new s3.Bucket(this, 'ProcessedDataBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // IAM Role for Glue Job
    const glueRole = new iam.Role(this, 'GlueJobRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
      ],
    });

    // Glue Job
    const glueJob = new glue.CfnJob(this, 'GlueJob', {
      role: glueRole.roleArn,
      command: {
        name: 'glueetl',
        scriptLocation: 'src/lambda-code/dtb-pipeline/glue__job.py', // Update this path
        pythonVersion: '3',
      },
      defaultArguments: {
        '--job-bookmark-option': 'job-bookmark-enable',
      },
      glueVersion: '2.0',
      maxCapacity: 2.0,
    });

    // IAM Role for Lambda Function
    const lambdaRole = new iam.Role(this, 'GlueJobTriggerLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['glue:StartJobRun'],
      resources: [glueJob.attrArn], // Restrict this to specific resources
    }));

    // Lambda Function to Trigger Glue Job
    const triggerFunction = new lambda.Function(this, 'TriggerGlueJobFunction', {
      runtime: lambda.Runtime.PYTHON_3_8,
      code: lambda.Code.fromAsset('src'),
      handler: 'trigger_glue_job.lambda_handler',
      role: lambdaRole,
      environment: {
        JOB_NAME: glueJob.ref, // Reference the Glue job
      },
    });

    // S3 Bucket for raw data
    const rawDataBucket = s3.Bucket.fromBucketName(this, 'NuoaDatabaseBucket', 'nuoadatabase');

    // Add S3 notification to trigger the Lambda function
    rawDataBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3Notifications.LambdaDestination(triggerFunction));
  }
}

const app = new cdk.App();
new CompleteFlowStack(app, 'CompleteFlowStack');
app.synth();
