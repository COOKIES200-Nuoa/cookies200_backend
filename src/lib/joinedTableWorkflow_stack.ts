import{
    aws_iam as iam,
    aws_glue as glue,
    aws_events as events,
    aws_events_targets as targets,
    aws_dynamodb as dynamodb,
    aws_s3 as s3
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Stack, StackProps, CfnOutput} from 'aws-cdk-lib';

export class JoinedTableWorkFlowStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

         // Get name of dynamodb tables from cdk.json
        const activityTableName = this.node.tryGetContext('activityTableName');
        const entityTableName = this.node.tryGetContext('entityTableName');
        const rlsTableName = this.node.tryGetContext('rlsTableName');

        // Import existing DynamoDB tables
        const ActivityTable_Nuoa = dynamodb.Table.fromTableArn(this, activityTableName, `arn:aws:dynamodb:ap-southeast-1:203903977784:table/${activityTableName}`);
        const EntityTable_Nuoa = dynamodb.Table.fromTableArn(this, entityTableName, `arn:aws:dynamodb:ap-southeast-1:203903977784:table/${entityTableName}`);
        const RLS_Table_Nuoa = dynamodb.Table.fromTableArn(this, rlsTableName, `arn:aws:dynamodb:ap-southeast-1:203903977784:table/${rlsTableName}`);

        // Get name of source bucket and source table
        const dataSourceBucket = this.node.tryGetContext('dataSourceBucket');
        const dataSourceTable = this.node.tryGetContext('tableName');

        // Get Glue Database name from cdk.json
        const databaseName = this.node.tryGetContext('databaseName');

        // Import existing S3 bucket
        const outputBucket = s3.Bucket.fromBucketName(this, 'OutputBucket', dataSourceBucket);

        // Glue IAM Role
        const glueRole = new iam.Role(this, 'GlueRole', {
            assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
            managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
            ],
        });
  
        // Glue IAM Policy
        const glue_joinJobPolicy = new iam.Policy(this, 'Glue_joinJobPolicy', {
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
                    ActivityTable_Nuoa.tableArn,
                    EntityTable_Nuoa.tableArn,
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

        // Create a single Glue Crawler to crawl Activity and Entity Table as well as RLS Table
        const dynamoDBCrawler = new glue.CfnCrawler(this, 'DynamoDBCrawler', {
            name:'dynamodb_db_crawler',
            role: glueRole.roleArn,
            databaseName: 'dynamodb_db',
            targets: {
                dynamoDbTargets: [
                    { path: ActivityTable_Nuoa.tableName },
                    { path: EntityTable_Nuoa.tableName },
                ],
            },
            recrawlPolicy: {
                recrawlBehavior: 'CRAWL_EVERYTHING'
            },
        });
        dynamoDBCrawler.node.addDependency(glue_joinJobPolicy);

        // Glue Job
        const glue_joinJob = new glue.CfnJob(this, 'Glue_joinJob', {
            name: 'glue_join_job',
            role: glueRole.roleArn,
            command: {
                name: 'glueetl',
                pythonVersion: "3",
                scriptLocation: 's3://nuoadatabasetest/glue__job.py',
            },
            defaultArguments: {
                '--TempDir': outputBucket.s3UrlForObject('temp/'),
                '--output_path': outputBucket.s3UrlForObject(`${dataSourceTable}/`),
                '--activity_table': activityTableName, 
                '--entity_table': entityTableName,     
            },
            maxRetries: 1,
            glueVersion: '4.0'
        });
        // Glue job runs after crawler
        glue_joinJob.node.addDependency(glue_joinJobPolicy)
        glue_joinJob.addDependency(dynamoDBCrawler);
  
        // IAM Policy for S3 Parquet Crawler
        const parquetTableCrawlPolicy = new iam.Policy(this, 'ParquetTableCrawlRolePolicy', {
        policyName: 'parquetTableCrawlRolePolicy',
        roles: [glueRole],
        statements: [
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                "s3:GetObject",
                "s3:PutObject"
                ],
                resources: [
                    `arn:aws:s3:::${dataSourceBucket}/${dataSourceTable}/*`
                ],
            }),
        ],
        });

        // Create crawler for joined table
        const parquetTableCrawler = new glue.CfnCrawler(this, 'S3ParquetTableCrawler', {
            name: "joinedTable-s3-parquet-crawler",
            role: glueRole.roleArn,
            databaseName: databaseName,
            targets: {
                s3Targets: [
                    { path: `s3://${dataSourceBucket}/${dataSourceTable}/` },
                ],
            },
        });
        parquetTableCrawler.node.addDependency(parquetTableCrawlPolicy);

    // ======================================= Creating Glue workflow =========================================
        const glue_workflow = new glue.CfnWorkflow(this, "glue-workflow", {
            name: "glue-workflow",
            description:
            "ETL workflow to convert DynamoDB tables to parquet and then load into Quicksight",
        });

        // Create triggers

        // Create trigger for DynamoDBCawrler
        const glue_trigger_dynamodb_crawlJob = new glue.CfnTrigger(
            this, "glue-trigger-dynamodb-crawler",
            {
                name: "Run-Crawler" + dynamoDBCrawler.name,
                workflowName: glue_workflow.name,
                actions: [
                    {
                        crawlerName: dynamoDBCrawler.name,
                        timeout: 200,
                    },
                ],
                type: "ON_DEMAND"
            }
        )
        // Add Trigger dependency on workflow and crawler
        glue_trigger_dynamodb_crawlJob.addDependency(dynamoDBCrawler);
        glue_trigger_dynamodb_crawlJob.addDependency(glue_workflow);

        // Create trigger for join job
        const glue_trigger_joinJob = new glue.CfnTrigger(
            this, "glue-trigger-joinJob",
            {
                name: "Run-Job" + glue_joinJob.name,
                workflowName: glue_workflow.name,
                actions: [
                    {
                        jobName: glue_joinJob.name,
                        timeout: 200,
                    },
                ],
                predicate: {
                    conditions: [
                        {
                            logicalOperator: "EQUALS",
                            crawlerName: dynamoDBCrawler.name, 
                            crawlState: "SUCCEEDED"
                        },
                    ],
                    logical: "ANY",
                },
                type: "CONDITIONAL",
                startOnCreation: true,
            }
        );

        const glue_trigger_parquet_crawler = new glue.CfnTrigger(
            this, "glue-trigger-crawlJob-parquet",
            {
                name: "Run-Crawler-" + parquetTableCrawler.name,
                workflowName: glue_workflow.name,
                actions: [
                    {
                        crawlerName: parquetTableCrawler.name,
                    },
                ],
                predicate: {
                    conditions: [
                        {
                            logicalOperator: "EQUALS",
                            jobName: glue_joinJob.name, // Hardcoded placeholder
                            state: "SUCCEEDED"
                        },
                    ],
                    logical: "ANY",
                },
                type: "CONDITIONAL",
                startOnCreation: true,
            }
        );
        glue_trigger_joinJob.addDependency(glue_trigger_dynamodb_crawlJob);
        glue_trigger_parquet_crawler.addDependency(glue_trigger_joinJob);

        // Output name of join table glue workflow
        new CfnOutput(this, 'WorkflowName', {
            value: glue_workflow.name? glue_workflow.name : '',
            description: 'Name of glue join table workflow',
            exportName: 'WorkflowName',
        })
        // Output name of S3 parquet crawler
        new CfnOutput(this, 'ParquetTableCrawlerName', {
            value: parquetTableCrawler.name? parquetTableCrawler.name : '',
            description: 'Name of crawler that crawl the parquet joined table',
            exportName: 'ParquetTableCrawlerName',
        });
    }
};