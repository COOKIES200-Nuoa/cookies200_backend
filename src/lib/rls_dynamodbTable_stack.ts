import {
    aws_dynamodb as dynamodb,
    aws_lambda as lambda,
    aws_iam as iam,
    aws_s3 as s3,
    aws_athena as athena,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput, Fn } from 'aws-cdk-lib';

export class RLSTableStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Create RLS DynamoDB Table
        const RLS_Table = new dynamodb.TableV2(this, 'Table', {
            partitionKey: { name: 'UserArn', type: dynamodb.AttributeType.STRING },
            contributorInsights: true,
            tableClass: dynamodb.TableClass.STANDARD,
            pointInTimeRecovery: true,
            billing: dynamodb.Billing.provisioned({
                readCapacity: dynamodb.Capacity.fixed(1),
                writeCapacity: dynamodb.Capacity.autoscaled({ maxCapacity: 2, seedCapacity: 10 }),
            }),
            tableName: 'RowLevelSecurity_Nuoa',
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const spillbucket = new s3.Bucket(this, 'SpillBucket', {
            bucketName: 'rls-spillbucket',
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
        })

        const outputBucket = new s3.Bucket(this, 'OutputBucket', {
            bucketName: 'rls-outputbucket',
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
        })

        new athena.CfnWorkGroup(this, 'RLSWorkgroup', {
            name: 'rlsWorkgroup',
            recursiveDeleteOption: true,
            workGroupConfiguration: {
                resultConfiguration: {
                    outputLocation: outputBucket.s3UrlForObject(),
                },
            }
        })

        // Create DynamoDB Athena connector
        const connector = lambda.Function.fromFunctionArn(
            this, 
            'ddbconnector', 
            `arn:aws:lambda:${this.region}:${this.account}:function:ddbconnector`
        );
        console.log('Imported function: ', connector.functionArn);

        new athena.CfnDataCatalog(this, 'rlsDatacatalog', {
            name: 'ddbconnector',
            type: 'LAMBDA',
            parameters: {
                function: connector.functionArn,
            },
        });

        const qsrole = iam.Role.fromRoleArn(
            this, 
            'QuickSightRoleImport', 
            `arn:aws:iam::${this.account}:role/service-role/aws-quicksight-service-role-v0`
        );

        // Add Permissions to access spillbucket and outputbucket to Quicksight
        qsrole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSQuicksightAthenaAccess'));
        qsrole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSLambdaRole'));
        qsrole.addToPrincipalPolicy(new iam.PolicyStatement({
            actions: ['s3:ListAllMyBuckets'],
            resources: ['*'],
        }));
        qsrole.addToPrincipalPolicy(new iam.PolicyStatement({
            actions: [
            's3:ListBucket',
            's3:ListBucketMultipartUploads',
            's3:GetBucketLocation',
            ],
            resources: [
            spillbucket.bucketArn,
            outputBucket.bucketArn,
            ],
        }));
        qsrole.addToPrincipalPolicy(new iam.PolicyStatement({
            actions: [
            's3:GetObject',
            's3:GetObjectVersion',
            's3:PutObject',
            's3:AbortMultipartUpload',
            's3:ListMultipartUploadParts',
            ],
            resources: [
            spillbucket.bucketArn + '/*',
            outputBucket.bucketArn + '/*',
            ],
        }));

        // IAM Role for Athena
        const rlsRole = new iam.Role(this, 'RLSRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });

        // Get S3 bucket location permissions
        rlsRole.addToPolicy(new iam.PolicyStatement({
            sid: 'S3BucketPermissions',
            actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:BatchWriteItem',
            ],
            resources: [RLS_Table.tableArn],
        }));

        const rowLevelSecurityFunc = new lambda.Function(this, 'UpdateRowLevelSecurityFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'rowLevelSecurity.rowLevelSecurity',
            code: lambda.Code.fromAsset('src/lambda-code/rowLevelSecurity'),
            role: rlsRole,
            environment: {
                REGION: this.region,
                AWS_ACC_ID: this.account,
            },
            timeout: Duration.minutes(1),
        });

        // Outputs
        new CfnOutput(this, 'RLSTableFunc', {
            value: rowLevelSecurityFunc.functionName,
            description: 'The name function that update the Row Level Security Table',
            exportName: 'RLSTableFunc'
        });
    }
}