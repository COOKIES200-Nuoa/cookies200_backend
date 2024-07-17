import { Stack, StackProps } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as athena from 'aws-cdk-lib/aws-athena';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

export class DataPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Assume the DynamoDB tables already exist
    const activityTable = dynamodb.Table.fromTableAttributes(this, 'ActivityTable', {
      tableName: 'ActivityTable',
    });

    const entityTable = dynamodb.Table.fromTableAttributes(this, 'EntityTable', {
      tableName: 'EntityTable',
    });

    const entityStructure = dynamodb.Table.fromTableAttributes(this, 'EntityStructure', {
      tableName: 'EntityStructure',
    });

    // S3 Buckets
    const rawDataBucket = new s3.Bucket(this, 'RawDataBucket');
    const processedDataBucket = new s3.Bucket(this, 'ProcessedDataBucket');

    // IAM Role for Glue
    const glueRole = new iam.Role(this, 'GlueRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess')
      ]
    });

    // Glue Job
    const glueJob = new glue.CfnJob(this, 'GlueJob', {
      role: glueRole.roleArn,
      command: {
        name: 'gluepipeline',
        scriptLocation: 's3://glue-scripts-bucket/glue-script.py',
      },
      defaultArguments: {
        '--TempDir': rawDataBucket.s3UrlForObject(),
        '--job-bookmark-option': 'job-bookmark-enable',
        '--INPUT_PATH': rawDataBucket.s3UrlForObject('input/'),
        '--OUTPUT_PATH': processedDataBucket.s3UrlForObject('output/'),
      },
      glueVersion: '2.0',
    });

    // Athena Setup
    const athenaWorkGroup = new athena.CfnWorkGroup(this, 'AthenaWorkGroup', {
      name: 'AthenaWorkGroup',
      workGroupConfiguration: {
        resultConfiguration: {
          outputLocation: processedDataBucket.s3UrlForObject(),
        },
      },
    });

    // Kinesis Data Stream
    const kinesisStream = new kinesis.Stream(this, 'KinesisStream');

    // Lambda Function to process records from Kinesis Stream
    const kinesisLambda = new lambda.Function(this, 'KinesisLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'kinesisLambda.handler',
      code: lambda.Code.fromAsset('src/lambda-code/kinesis'),
      environment: {
        ACTIVITY_TABLE: activityTable.tableName,
        ENTITY_TABLE: entityTable.tableName,
        ENTITY_STRUCTURE: entityStructure.tableName,
      },
    });

    // Grant necessary permissions to the Lambda function
    kinesisLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
      ],
      resources: [
        activityTable.tableArn,
        entityTable.tableArn,
        entityStructure.tableArn,
      ],
    }));

    // Add Kinesis event source to the Lambda function
    kinesisLambda.addEventSource(new lambdaEventSources.KinesisEventSource(kinesisStream, {
      batchSize: 100,
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
    }));

    // Lambda function to put S3 data into Kinesis Stream
    const s3ToKinesisLambda = new lambda.Function(this, 'S3ToKinesisLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 's3ToKinesis.handler',
      code: lambda.Code.fromAsset('src/lambda-code/dtbpipeline'),
      environment: {
        KINESIS_STREAM_NAME: kinesisStream.streamName,
      },
    });

    // Grant necessary permissions to the Lambda function
    s3ToKinesisLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'kinesis:PutRecord',
        'kinesis:PutRecords',
      ],
      resources: [
        kinesisStream.streamArn,
      ],
    }));

    // S3 Notification to trigger the S3 to Kinesis Lambda
    rawDataBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(s3ToKinesisLambda));

    // Lambda Function to refresh QuickSight dataset
    const refreshLambda = new lambda.Function(this, 'RefreshLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'refreshLambda.handler',
      code: lambda.Code.fromAsset('src/lambda-code/dtbpipeline'),
      environment: {
        DATASET_ID: 'dataset-id',
        AWS_ACCOUNT_ID: this.account,
        REGION: this.region,
      },
    });

    // Grant necessary permissions to the Lambda function
    refreshLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'quicksight:CreateIngestion',
      ],
      resources: [
        `arn:aws:quicksight:${this.region}:${this.account}:dataset/dataset-id`,
      ],
    }));

    // S3 Notification to trigger Lambda
    rawDataBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(refreshLambda));

    // Lambda function to trigger Glue job
    const glueTriggerLambda = new lambda.Function(this, 'GlueTriggerLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'glueTrigger.handler',
      code: lambda.Code.fromAsset('src/lambda-code/dtbpipeline'),
      environment: {
        GLUE_JOB_NAME: glueJob.ref,
      },
    });

    // Grant necessary permissions to the Lambda function
    glueTriggerLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'glue:StartJobRun',
      ],
      resources: [
        `arn:aws:glue:${this.region}:${this.account}:job/${glueJob.ref}`,
      ],
    }));

    // S3 Notification to trigger the Glue trigger Lambda
    rawDataBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(glueTriggerLambda));
  }
}