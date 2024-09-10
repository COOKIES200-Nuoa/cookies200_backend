import { App, Fn } from 'aws-cdk-lib';
import { Template, Match, } from 'aws-cdk-lib/assertions';
import { GlueStack } from '../../src/lib/glue_stack'; // Adjust path

describe('GlueStack', () => {
    
    const app = new App();

    app.node.setContext('activityTableName', 'ActivityTable');
    app.node.setContext('entityTableName', 'EntityTable');
    app.node.setContext('rlsTableName', 'RLSTable');
    app.node.setContext('dataSourceBucket', 'my-data-source-bucket');
    app.node.setContext('tableName', 'my-data-source-table');
    app.node.setContext('databaseName', 'my-glue-database');

    const glueStack = new GlueStack(app, 'TestJoinedTableWorkFlowStack');
    const template = Template.fromStack(glueStack);

    test('Create an S3 Bucket for glue script and data output', () => {
        template.hasResourceProperties('AWS::S3::Bucket', {
            BucketName: 'my-data-source-bucket', 
        });
    });

    test('Adding permission to access output bucket to Quicksight', () => {
        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
            Statement: [
                {
                Action: [
                    's3:ListBucket',
                    "s3:GetObject",
                    "s3:GetObjectVersion",
                    "s3:ListBucketMultipartUploads",
                    "s3:GetBucketLocation",
                    "s3:PutObject",
                    "s3:AbortMultipartUpload",
                    "s3:ListMultipartUploadParts"
                ],
                Effect: 'Allow',
                Resource: [
                    {
                    'Fn::GetAtt': [
                        Match.stringLikeRegexp('GlueOutputBucket*'), 
                        'Arn',
                    ],
                    },
                    {
                    'Fn::Join': [
                        '',
                        [
                        {
                            'Fn::GetAtt': [
                            Match.stringLikeRegexp('GlueOutputBucket*'),
                            'Arn',
                            ],
                        },
                        '*',
                        ],
                    ],
                    },
                ],
                },
            ],
            },
            Roles: ['aws-quicksight-service-role-v0'],
        });
    });

    test('Creating Glue Crawler for DynamoDB tables', () => {
        template.hasResourceProperties('AWS::Glue::Crawler', {
            Name: 'dynamodb_db_crawler',
            Role: {
            'Fn::GetAtt': [
                Match.stringLikeRegexp('GlueRole*'),
                'Arn'
            ]
            },
            DatabaseName: 'dynamodb_db',
            Targets: {
            DynamoDBTargets: [
                {
                Path: 'ActivityTable'
                },
                {
                Path: 'EntityTable'
                }
            ]
            },
            RecrawlPolicy: {
            RecrawlBehavior: 'CRAWL_EVERYTHING'
            }
        });
    });

    test('Creating Glue Join Job',() => { 
        template.hasResourceProperties('AWS::Glue::Job', {
            Name: 'glue_join_job',
            Role: {
            'Fn::GetAtt': [
                Match.stringLikeRegexp('GlueRole*'),
                'Arn'
            ]
            },
            Command: {
            Name: 'glueetl',
            PythonVersion: '3',
            ScriptLocation: { 
                'Fn::Join': [
                    "",
                    [
                        "s3://",
                        { "Ref": Match.stringLikeRegexp(`GlueOutputBucket*`) }, 
                        "/glue-scripts/glue__job.py"
                    ]
                ]
            }
            },
            DefaultArguments: {
                '--TempDir': {
                    'Fn::Join': [
                        "",
                        [
                            "s3://",
                            { "Ref": Match.stringLikeRegexp(`GlueOutputBucket*`) },
                            "/temp/"
                        ]
                    ]
                },
                '--output_path': {
                    'Fn::Join': [
                        "",
                        [
                            "s3://",
                            { "Ref": Match.stringLikeRegexp(`GlueOutputBucket*`) }, 
                            "/my-data-source-table/" 
                        ]
                    ]
                },
                '--activity_table': 'ActivityTable',
                '--entity_table': 'EntityTable'
            },
            MaxRetries: 1,
            GlueVersion: '4.0'
        });
    });

    test('Creating Glue Crawler for Parquet table',() => {  
        template.hasResourceProperties('AWS::Glue::Crawler', {
            Name: 'joinedTable-s3-parquet-crawler',
            Role: {
            'Fn::GetAtt': [
                Match.stringLikeRegexp('GlueRole*'),
                'Arn'
            ]
            },
            DatabaseName: 'my-glue-database',
            Targets: {
            S3Targets: [
                {
                Path: 's3://my-data-source-bucket/my-data-source-table/'
                }
            ]
            }
        });
    });
});
