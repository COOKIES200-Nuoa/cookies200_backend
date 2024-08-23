import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

export class GluePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Import existing DynamoDB tables
    const ActivityTable_dev = dynamodb.Table.fromTableArn(this, 'ActivityTable_dev', 'arn:aws:dynamodb:ap-southeast-1:203903977784:table/ActivityTable_dev');
    const EntityTable_dev = dynamodb.Table.fromTableArn(this, 'EntityTable_dev', 'arn:aws:dynamodb:ap-southeast-1:203903977784:table/EntityTable_dev');

    // Import existing S3 bucket
    const outputBucket = s3.Bucket.fromBucketName(this, 'OutputBucket', 'nuoadatabasetest');

    // Glue IAM Role
    const glueRole = new iam.Role(this, 'GlueRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
      ],
    });

    const gluePolicy = new iam.Policy(this, 'GlueRolePolicy', {
        policyName: 'GlueRolePolicy',
        roles: [glueRole],
        statements: [
            new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'dynamodb:DescribeTable',
                'dynamodb:Scan',
                'dynamodb:Query',
            ],
            resources: [
                ActivityTable_dev.tableArn,
                EntityTable_dev.tableArn,
            ],
            }),
        ],
        });

    // Add full S3 access to the Glue role
    glueRole.addToPolicy(new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        's3:GetObject',
        's3:PutObject',
        's3:ListBucket',
    ],
    resources: [
        `${outputBucket.bucketArn}/*`, 
        outputBucket.bucketArn,
    ],
    }));

    // Create a single Glue Crawler to crawl both DynamoDB tables
    const crawler = new glue.CfnCrawler(this, 'DynamoDBCrawler', {
      role: glueRole.roleArn,
      databaseName: 'dynamodb_db',
      targets: {
        dynamoDbTargets: [
          { path: ActivityTable_dev.tableName },
          { path: EntityTable_dev.tableName },
        ],
      },
    });

    crawler.node.addDependency(gluePolicy);

    // Glue Job
    const glueJob = new glue.CfnJob(this, 'GlueJob', {
      role: glueRole.roleArn,
      command: {
        name: 'glueetl',
        scriptLocation: 's3://nuoadatabasetest/glue__job.py',
        pythonVersion: '3',
      },
      defaultArguments: {
        '--TempDir': outputBucket.s3UrlForObject('temp/'),
        '--output_path': outputBucket.s3UrlForObject('data/'),
      },
      maxRetries: 1,
      glueVersion: '4.0',
    });

    // Glue job runs after crawler
    glueJob.addDependency(crawler);

    // Lambda to Trigger Glue Job
    const triggerGlueJobLambda = new lambda.Function(this, 'TriggerGlueJobLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { GlueClient, StartJobRunCommand } = require("@aws-sdk/client-glue");
        const glue = new GlueClient();
        exports.handler = async (event) => {
          const command = new StartJobRunCommand({ JobName: "${glueJob.ref}" });
          await glue.send(command);
        };
      `),
      environment: {
        JOB_NAME: glueJob.ref,
      },
      role: new iam.Role(this, 'LambdaExecutionRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
        ],
      }),
    });

    // EventBridge Rule to Trigger Lambda every 24 hours
    new events.Rule(this, 'DailyTrigger', {
      schedule: events.Schedule.rate(Duration.days(1)),
      targets: [new targets.LambdaFunction(triggerGlueJobLambda)],
    });
  }
}
