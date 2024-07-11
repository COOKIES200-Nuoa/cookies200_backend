import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as athena from 'aws-cdk-lib/aws-athena';
import * as iam from 'aws-cdk-lib/aws-iam';

// import * as quicksight from 'aws-cdk-lib/aws-quicksight'; 

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
    });

    glueRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'));

    // Glue Job
    const glueJob = new glue.CfnJob(this, 'GlueJob', {
      role: glueRole.roleArn,
      command: {
        name: 'gluepipeline',
        scriptLocation: 's3://path-to-glue-script/glue-script.py',
      },
      defaultArguments: {
        '--TempDir': rawDataBucket.s3UrlForObject(),
        '--job-bookmark-option': 'job-bookmark-enable',
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

    // QuickSight Setup (Optional - Example only)
    /*
    const quicksightUser = new quicksight.CfnUser(this, 'QuickSightUser', {
      email: 'your-email@example.com',
      identityType: 'IAM',
      awsAccountId: this.account,
      namespace: 'default',
      userRole: 'READER',
      iamArn: glueRole.roleArn,
    });
    */

   // Lambda Function to refresh QuickSight dataset
    const refreshLambda = new lambda.Function(this, 'RefreshLambda', {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'quicksightOnboarding.quicksightOnboarding',
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
        `arn:aws:quicksight:${this.region}:${this.account}:dataset/your-dataset-id`,
        ],
    }));

    // S3 Notification to trigger Lambda
    rawDataBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(refreshLambda));

  }
}
