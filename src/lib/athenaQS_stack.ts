
import {
  aws_glue as glue,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput } from 'aws-cdk-lib';

export class AthenaQuickSightStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // // S3 Bucket for Athena query results - anh Binh check giup em co can khong nhe. Em khong ro logic cho nay
    const athenaResultsBucket = new s3.Bucket(this, 'AthenaResultsBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // IAM Role for Athena
    const athenaRole = new iam.Role(this, 'AthenaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Get S3 bucket location permissions
    athenaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'GetBucketLocationPermission',
      actions: [
        's3:GetBucketLocation',
      ],
      resources: ['arn:aws:s3:::*'],
    }));

    // Retreive processed data from datalake permissions
    athenaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'DatalakeQueryPermissions',
      actions: [
        's3:GetObject',
        's3:ListBucket',
      ],
      resources: ['arn:aws:s3:::processed-nuoa-joinedtable-dev', 'arn:aws:s3:::processed-nuoa-joinedtable-dev*'],
    }));

    // Athena query execution and table creation permissions
    athenaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'AthenaQueryPermission',
      actions: [
        'athena:StartQueryExecution',
        'athena:GetQueryExecution',
        'athena:CreateTable',
        'glue:GetDatabase',
        'glue:CreateTable',
        'glue:GetTable',
        'quicksight:CreateIngestion'
      ],
      resources: ['*'],
    }));

    // Retrieve query result from athena result bucket
    athenaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ResultBucketQueryPermissions',
      actions: [
        'athena:GetQueryResults',
        's3:ListMultipartUploadParts',
        'athena:GetWorkGroup',
        's3:PutObject',
        's3:GetObject',
        'athena:StopQueryExecution',
        's3:GetBucketLocation',
      ],
      resources: [`${athenaResultsBucket.bucketArn}*`],
    }));

    // Invoke update quicksight dataset function permission
    athenaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'InvokeUpdateFunctionPermission',
      actions: [
        'lambda:InvokeFunction',
      ],
      resources: [`arn:aws:lambda:${this.region}:${this.account}:function:${this.stackName}-UpdateQuickSightFunction*`],
    }));

    // Lambda update QuickSight datasets
    const updateQuickSightFunction = new lambda.Function(this, 'UpdateQuickSightFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('src/lambda-code/dtbpipeline/updateQuickSightDataset'),
      handler: 'updateQS.updateQS',
      role: athenaRole,
      environment: {
        DATASET_ID: this.node.tryGetContext('datasetId'),
        ACCOUNT_ID: this.account,
        REGION: this.region,
      },
      timeout: Duration.minutes(1),
    });

    // Create Athena tables Lambda
    const createAthenaTablesFunction = new lambda.Function(this, 'CreateAthenaTablesFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('src/lambda-code/dtbpipeline/createAthenaTable'),
      handler: 'createAthenaTable.createAthenaTable',
      role: athenaRole,
      environment: {
        ACCOUNT_ID: this.account,
        REGION: this.region,
        DATABASE_NAME: this.node.tryGetContext('databaseName'),
        TABLE_NAME: this.node.tryGetContext('tableName'),
        DATA_BUCKET: this.node.tryGetContext('dataSourceBucket'),
        RESULT_BUCKET: athenaResultsBucket.bucketName,
        UPDATE_FUNC_ARN: updateQuickSightFunction.functionArn, 
      },
      timeout: Duration.minutes(1),
    });

    // Outputs
    new CfnOutput(this, 'AthenaResultsBucketName', {
      value: athenaResultsBucket.bucketName,
      description: 'The name of the S3 bucket for Athena query results',
    });
  }
}
