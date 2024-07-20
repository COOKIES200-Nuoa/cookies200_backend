import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

export class DynamoDBExportStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const exportBucket = s3.Bucket.fromBucketName(this, 'NuoaDatabaseBucket', 'nuoadatabase');

    // Import existing DynamoDB Tables with Streams enabled
    const activityTable = dynamodb.Table.fromTableAttributes(this, 'ImportedActivityTable', {
      tableArn:  `arn:aws:dynamodb:${this.region}:${this.account}:table/ActivityTable`,
      tableStreamArn: `arn:aws:dynamodb:${this.region}:${this.account}:table/ActivityTable/stream/2024-07-17T09:15:31.289`
    });

  const entityTable = dynamodb.Table.fromTableAttributes(this, 'ImportedEntityTable', {
      tableArn: `arn:aws:dynamodb:${this.region}:${this.account}:table/EntityTable` , 
      tableStreamArn: `arn:aws:dynamodb:${this.region}:${this.account}:table/EntityTable/stream/2024-07-17T09:20:09.806` 
    });

    const entityStructure = dynamodb.Table.fromTableAttributes(this, 'ImportedEntityStructureTable', {
      tableArn: `arn:aws:dynamodb:${this.region}:${this.account}:table/EntityStructure`,
      tableStreamArn:   `arn:aws:dynamodb:${this.region}:${this.account}:table/EntityStructure/stream/2024-07-17T09:21:18.900` 
    });

    // Create IAM Role for Lambda
    const lambdaRole = new iam.Role(this, 'DynamoDBExportLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant S3 permissions to Lambda
    exportBucket.grantReadWrite(lambdaRole);

    // Create Lambda Function to Process Stream Records
    const exportFunction = new lambda.Function(this, 'DynamoDBExportFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('src/lambda-code/dtbpipeline'),
      handler: 'exportDtb.exportDtb',
      role: lambdaRole,
      environment: {
        BUCKET_NAME: exportBucket.bucketName,
      },
      timeout: cdk.Duration.minutes(1), //change later
    });

    // Add DynamoDB Streams as Event Sources for Lambda
    exportFunction.addEventSource(new lambdaEventSources.DynamoEventSource(activityTable, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
    }));

    exportFunction.addEventSource(new lambdaEventSources.DynamoEventSource(entityTable, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
    }));

    exportFunction.addEventSource(new lambdaEventSources.DynamoEventSource(entityStructure, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
    }));
  }
}
