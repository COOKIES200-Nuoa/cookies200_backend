import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { GlueStack } from '../../src/lib/glueJob_stack';

describe('GlueStack', () => {
    const app = new App();
    const glueStack = new GlueStack(app, 'GlueStack', {
        env: {
            account: '891377270638',
            region: 'ap-southeast-1',
        }
    });

    const template = Template.fromStack(glueStack);

    test('S3 Bucket Permissions in Glue Role', () => {
        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Effect: 'Allow',
                        Action: [
                            's3:GetObject',
                            's3:ListBucket',
                            's3:PutObject',
                            's3:DeleteObject',
                        ],
                        Resource: Match.arrayWith([
                            'arn:aws:s3:::nuoadatabase',
                            'arn:aws:s3:::nuoadatabase/*',
                            Match.objectLike({
                                "Fn::Join": [
                                    "",
                                    [
                                        "arn:",
                                        { "Ref": "AWS::Partition" },
                                        ":s3:::processed-nuoa-database",
                                    ],
                                ],
                            }),
                            Match.objectLike({
                                "Fn::Join": [
                                    "",
                                    [
                                        "arn:",
                                        { "Ref": "AWS::Partition" },
                                        ":s3:::processed-nuoa-database/*",
                                    ],
                                ],
                            }),
                        ]),
                    }),
                ]),
            },
        });
    });

    test('Glue Job Created with Correct Configuration', () => {
        template.hasResourceProperties('AWS::Glue::Job', {
            Role: { "Fn::GetAtt": ["GlueJobRoleF1B69418", "Arn"] },
            Command: {
                Name: 'glueetl',
                ScriptLocation: 's3://processed-nuoa-database/glue__job.py',
                PythonVersion: '3',
            },
            DefaultArguments: {
                '--job-bookmark-option': 'job-bookmark-enable',
                '--processed_bucket': 'processed-nuoa-database',
            },
            GlueVersion: '4.0',
            MaxCapacity: 2.0,
        });
    });

    test('Lambda Function Created with Correct Environment Variables', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            Runtime: 'nodejs18.x',
            Handler: 'glueTrigger.glueTrigger',
            Environment: {
                Variables: {
                    JOB_NAME: { Ref: 'GlueJob' },
                },
            },
            Role: { "Fn::GetAtt": ["GlueJobTriggerLambdaRole5080E2E7", "Arn"] },
        });
    });

    test('Glue Job Trigger Lambda Has Correct Permissions', () => {
        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Effect: 'Allow',
                        Action: 'glue:StartJobRun',
                        Resource: {
                            "Fn::Join": [
                                "",
                                [
                                    "arn:aws:glue:ap-southeast-1:891377270638:job/",
                                    { "Ref": "GlueJob" }
                                ]
                            ]
                        }
                    })
                ]),
                Version: '2012-10-17',
            },
            Roles: [
                { Ref: "GlueJobTriggerLambdaRole5080E2E7" }
            ]
        });
    });
});