import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { JoinedTableWorkFlowStack } from "../src/lib/joinedTableWorkflow_stack"; 

describe('JoinedTableWorkFlowStack', () => {
    const app = new App({
        context: {
            activityTableName: 'ActivityTable_Nuoa', 
            entityTableName: 'EntityTable_Nuoa', 
            dataSourceBucket: 'nuoadatabasetest',
            tableName: 'data', 
            databaseName: 'processed_db', 
        }
    });
    
    const joinedTableWorkFlowStack = new JoinedTableWorkFlowStack(app, 'JoinedTableWorkFlowStack', {
        env: {
            account: '891377270638',
            region: 'ap-southeast-1',
        }
    });

    const template = Template.fromStack(joinedTableWorkFlowStack);

    test('Creates a Glue Role with necessary permissions', () => {
        template.hasResourceProperties('AWS::IAM::Role', {
            AssumeRolePolicyDocument: {
                Statement: [
                    {
                        Action: 'sts:AssumeRole',
                        Effect: 'Allow',
                        Principal: {
                            Service: 'glue.amazonaws.com'
                        }
                    }
                ]
            },
            ManagedPolicyArns: Match.arrayWith([
                {
                    'Fn::Join': [
                        '',
                        [
                            'arn:',
                            { 'Ref': 'AWS::Partition' },
                            ':iam::aws:policy/service-role/AWSGlueServiceRole'
                        ]
                    ]
                }
            ])
        });

        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: [
                    {
                        Action: [
                            'dynamodb:DescribeTable',
                            'dynamodb:Scan',
                            'dynamodb:Query',
                        ],
                        Effect: 'Allow',
                        Resource: [
                            "arn:aws:dynamodb:ap-southeast-1:203903977784:table/ActivityTable_Nuoa",
                            "arn:aws:dynamodb:ap-southeast-1:203903977784:table/EntityTable_Nuoa"
                        ]
                    }
                ]
            },
            Roles: Match.arrayWith([
                {
                    Ref: Match.stringLikeRegexp('GlueRole*')
                }
            ])
        });
    });

    
    test('Creates a Glue Crawler for DynamoDB tables', () => {
        template.hasResourceProperties('AWS::Glue::Crawler', {
            DatabaseName: 'dynamodb_db',
            Role: {
                'Fn::GetAtt': [Match.stringLikeRegexp('GlueRole*'), 'Arn'],
            },
            Targets: {
                DynamoDBTargets: Match.arrayWith([
                    {
                        Path: 'ActivityTable_Nuoa', 
                    },
                    {
                        Path: 'EntityTable_Nuoa',
                    }
                ])
            }
        });
    });

    test('Creates a Glue Job with appropriate arguments', () => {
        template.hasResourceProperties('AWS::Glue::Job', {
            Command: {
                Name: 'glueetl',
                ScriptLocation: 's3://nuoadatabasetest/glue__job.py',
                PythonVersion: '3',
            },
            Role: {
                'Fn::GetAtt': [Match.stringLikeRegexp('GlueRole*'), 'Arn'],
            },
            DefaultArguments: Match.objectLike({
                '--TempDir': `s3://nuoadatabasetest/temp/`, 
                '--output_path': `s3://nuoadatabasetest/data/`, 
                '--activity_table': 'ActivityTable_Nuoa',
                '--entity_table': 'EntityTable_Nuoa', 
            }),
            GlueVersion: '4.0',
            MaxRetries: 1,
        });
    });

    test('Creates a Glue Workflow and Triggers', () => {
        // Test for DynamoDB Crawler Trigger
        template.hasResourceProperties('AWS::Glue::Trigger', {
            Name: 'Run-Crawlerdynamodb_db_crawler',
            WorkflowName: 'glue-workflow',
            Actions: Match.arrayWith([
                Match.objectLike({
                    CrawlerName: 'dynamodb_db_crawler',
                    Timeout: 200
                })
            ]),
            Type: 'ON_DEMAND'
        });

        // Test for Glue Job Trigger
        template.hasResourceProperties('AWS::Glue::Trigger', {
            Name: 'Run-Jobglue_join_job',
            WorkflowName: 'glue-workflow',
            Actions: Match.arrayWith([
                Match.objectLike({
                    JobName: 'glue_join_job',
                    Timeout: 200
                })
            ]),
            Predicate: Match.objectLike({
                Conditions: Match.arrayWith([
                    Match.objectLike({
                        CrawlerName: 'dynamodb_db_crawler',
                        CrawlState: 'SUCCEEDED'
                    })
                ])
            }),
            Type: 'CONDITIONAL',
            StartOnCreation: true
        });

        // Test for S3 Parquet Crawler Trigger
        template.hasResourceProperties('AWS::Glue::Trigger', {
            Name: 'Run-Crawler-joinedTable-s3-parquet-crawler',
            WorkflowName: 'glue-workflow',
            Actions: Match.arrayWith([
                Match.objectLike({
                    CrawlerName: 'joinedTable-s3-parquet-crawler'
                })
            ]),
            Predicate: Match.objectLike({
                Conditions: Match.arrayWith([
                    Match.objectLike({
                        JobName: 'glue_join_job',
                        State: 'SUCCEEDED'
                    })
                ])
            }),
            Type: 'CONDITIONAL',
            StartOnCreation: true
        });
    });
});