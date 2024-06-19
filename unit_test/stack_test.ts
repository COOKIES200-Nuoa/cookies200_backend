import { App, Resource, Stack } from 'aws-cdk-lib';
import { Capture, Match, Template } from 'aws-cdk-lib/assertions';
import { QuickSightIntegrationStack } from '../src/lib/stack'; 
import { Effect } from 'aws-cdk-lib/aws-iam';
import { Action } from 'aws-cdk-lib/aws-appconfig';

describe('QuickSightIntegrationStack', () => {
  const app = new App();
  const stack = new QuickSightIntegrationStack(app, 'QuickSightIntegrationStack', {
    env: { 
      account: '891377270638', 
      region: 'ap-southeast-1',    
    }
  });

  const template = Template.fromStack(stack);
  const authenticatedRoleCapture = new Capture(); // Dynamically capture logical ID ref of Authenticated Role

  test('User Pool Created with Correct Configuration', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'TenantUserPool',
      AdminCreateUserConfig: {
        AllowAdminCreateUserOnly: true, 
      },
      AutoVerifiedAttributes: ['email'], 
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
          RequireLowercase: true,
          RequireNumbers: true,
          RequireSymbols: true,
          RequireUppercase: true,
        },
      },
      Schema: [
        {
          Mutable: true,
          Name: 'email',
          Required: true,
        },
      ],
      AliasAttributes: [
        'email'
      ],
    });
  });

  test('User Pool Client Created with Correct User Pool', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      UserPoolId: { Ref: 'UserPool6BA7E5F2' }, // Check the logical ID from your template
      ClientName: 'NuoaQuicksight',
      //more properties
    });
  });

  test('Identity Pool Authenticated Role Created', () => {
      // Check the IAM role creation
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Federated: 'cognito-identity.amazonaws.com',
              },
              Action: 'sts:AssumeRoleWithWebIdentity',
              Condition: {
                StringEquals: {
                  'cognito-identity.amazonaws.com:aud': {
                    Ref: 'TenantIdentityPool',
                  },
                },
                'ForAnyValue:StringLike': {
                  'cognito-identity.amazonaws.com:amr': 'authenticated',
                },
              },
            },
          ],
        },
        Description: 'Default role for authenticated users',
    });

    // Check the IAM policy attached to the role
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'mobileanalytics:PutEvents',
              'cognito-sync:*',
              'cognito-identity:*',
            ],
            Resource:'*',
          },
          {
            Effect: 'Allow',
            Action: 'sts:AssumeRole',
            Resource: `arn:aws:iam::${stack.account}:role/*TenantRole*`,
          }
        ],
      },
      Roles: [
        authenticatedRoleCapture,
      ],
    });

    const capturedRoleRef = authenticatedRoleCapture.asObject().Ref; // Extract role's logical ID from captured value
    expect(capturedRoleRef).toMatch(/^NuoaAuthRole[A-Za-z0-9]+$/); // Determine that the captured logical ID ref matches expected pattern
  });

  test('Tenant Groups and Roles Created', () => {
    // Premade Tenant Groups
    const tenantGroups = ["TenantA", "TenantB"]; 

    tenantGroups.forEach(tenantName => {
      // Test Cognito Group Creation
      template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
        GroupName: tenantName,
        UserPoolId: { Ref: 'UserPool6BA7E5F2' }, // Check the logical ID
      });
          // Check the tenant IAM role creation
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              AWS: { 'Fn::GetAtt': [authenticatedRoleCapture, 'Arn'] }, // Use captured authenticated role ARN
            },
            Action: 'sts:AssumeRole',
            Condition: {
              StringEquals: {
                'sts:ExternalId': tenantName,
              },
            },
          },
        ],
      },
      Description: `Role for ${tenantName}`,
    });
      // Check the IAM policy attached to the tenant role
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: [
                'quicksight:DescribeDashboard',
                'quicksight:ListDashboards',
                'quicksight:GetDashboardEmbedUrl',
                'quicksight:GenerateEmbedUrlForRegisteredUser',
                'quicksight:RegisterUser',
              ],
              Resource: `arn:aws:quicksight:${stack.region}:${stack.account}:namespace/${tenantName}`,
            },
          ],
        },
        Roles: [
          {
            Ref: Match.stringLikeRegexp(`^${tenantName}TenantRole[A-Za-z0-9]+$`)
          },
        ],
      });      
      // Assert that the captured value is a valid reference to the tenant role
      // const capturedTenantRoleRef = tenantRoleCapture.asObject().Ref;
      // expect(capturedTenantRoleRef).toMatch(new RegExp(`^${tenantName}TenantRole[A-Za-z0-9]+$`));
    });
  });

  test('Lambda Execution Role Created', () => {
    // Check the Lambda execution IAM role creation
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      },
    });

    // Check the IAM policy attached to the Lambda execution role
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'quicksight:*',
              'cognito-idp:AdminCreateUser',
              'cognito-idp:AdminAddUserToGroup',
            ],
            Resource: '*', // Ensure this is a string, not an array
          },
        ],
      },
      Roles: [
        {
          Ref: Match.stringLikeRegexp('NuoaLambdaExecutionRole.*'),
        },
      ],
    });
  });
  // more unit tests added in the future
});