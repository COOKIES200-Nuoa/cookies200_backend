import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { DynamoDBExportStack } from '../../src/lib/database_stack';

describe('DynamoDBExportStack', () => {
    const app = new App();
    const dynamoDBExportStack = new DynamoDBExportStack(app, 'DynamoDBExportStack', {
        env: {
            account: '891377270638',
            region: 'ap-southeast-1',
        }
    });

    const template = Template.fromStack(dynamoDBExportStack);

    test('DynamoDB Streams Added as Event Sources to Lambda', () => {
        template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
            EventSourceArn: Match.stringLikeRegexp(`arn:aws:dynamodb:${dynamoDBExportStack.region}:${dynamoDBExportStack.account}:table/ActivityTable/stream/*`),
            FunctionName: { Ref: 'DynamoDBExportFunction79F31C57' },
            StartingPosition: 'TRIM_HORIZON',
        });

        template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
            EventSourceArn: Match.stringLikeRegexp(`arn:aws:dynamodb:${dynamoDBExportStack.region}:${dynamoDBExportStack.account}:table/EntityTable/stream/*`),
            FunctionName: { Ref: 'DynamoDBExportFunction79F31C57' },
            StartingPosition: 'TRIM_HORIZON',
        });

        template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
            EventSourceArn: Match.stringLikeRegexp(`arn:aws:dynamodb:${dynamoDBExportStack.region}:${dynamoDBExportStack.account}:table/EntityStructure/stream/*`),
            FunctionName: { Ref: 'DynamoDBExportFunction79F31C57' },
            StartingPosition: 'TRIM_HORIZON',
        });
    });

    test('Lambda Function Created with Correct IAM Role and Permissions', () => {
        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Version: '2012-10-17',
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Effect: 'Allow',
                        Action: Match.anyValue(),
                        Resource: Match.anyValue(),
                    }),
                ]),
            },
        });

        template.hasResourceProperties('AWS::Lambda::Function', {
            Runtime: 'nodejs18.x',
            Handler: 'exportDtb.exportDtb',
            Environment: {
                Variables: {
                    BUCKET_NAME: 'nuoadatabase',
                },
            },
            Timeout: 60,
        });
    });

});