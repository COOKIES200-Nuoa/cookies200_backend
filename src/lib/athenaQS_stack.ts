import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class AthenaQuickSightStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // S3 Bucket for Athena query results - anh Binh check giup em co can khong nhe. Em khong ro logic cho nay
    const athenaResultsBucket = new s3.Bucket(this, 'AthenaResultsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // IAM Role for Athena
    const athenaRole = new iam.Role(this, 'AthenaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Change result bucket to prod bucket after testing
    athenaRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'athena:StartQueryExecution',
        'athena:GetQueryResults',
        's3:PutObject',
        's3:GetObject',
        's3:ListBucket'
      ],
      resources: ['arn:aws:s3:::processed-nuoa-joinedtable-dev', 'arn:aws:s3:::processed-nuoa-joinedtable-dev/*'],
    }));

    // Create Athena tables Lambda
    const createAthenaTablesFunction = new lambda.Function(this, 'CreateAthenaTablesFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('src/lambda-code/dtbpipeline'),
      handler: 'createAthenaTable.createAthenaTable',
      role: athenaRole,
      environment: {
        AWS_ACC_ID: this.account,
        REGION: this.region,
        DATABASE_NAME: 'nuoa_database',
        RESULT_BUCKET: athenaResultsBucket.bucketName,
        UPDATE_QUICKSIGHT_FUNCTION_NAME: 'UpdateQuickSightFunction', 
      },
    });

    // Create Quicksight Data Source and Dataset Lambda
    // const createDatasetFunction = new lambda.Function(this, 'CreateDatasetFunction', {
    //   runtime: lambda.Runtime.NODEJS_18_X,
    //   code: lambda.Code.fromAsset('src/lambda-code/dtbpipeline'),
    //   handler: 'importDtQS.importDtQS',
    //   role: '',
    //   environment: {
    //     ACCOUNT_ID: this.account,
    //     REGION: this.region,
    //   },
    // });

    // Lambda update QuickSight datasets
    // const updateQuickSightFunction = new lambda.Function(this, 'UpdateQuickSightFunction', {
    //   runtime: lambda.Runtime.NODEJS_18_X,
    //   code: lambda.Code.fromAsset('src/lambda-code/dtbpipeline'),
    //   handler: 'updateQS.updateQS',
    //   role: athenaRole,
    //   environment: {
    //     ATHENA_DATABASE_NAME: 'nuoa_database',
    //     DATASET_NAMES: 'ActivityTable,EntityTable,EntityStructureTable',
    //     ACCOUNT_ID: this.account,
    //     REGION: this.region,
    //   },
    // });

    // Grant permission to the first Lambda to invoke the second one
    // updateQuickSightFunction.grantInvoke(createAthenaTablesFunction);

    // Outputs
    new cdk.CfnOutput(this, 'AthenaResultsBucketName', {
      value: athenaResultsBucket.bucketName,
      description: 'The name of the S3 bucket for Athena query results',
    });
  }
}
