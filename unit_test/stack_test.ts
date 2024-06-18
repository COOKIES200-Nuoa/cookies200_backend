import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { QuickSightIntegrationStack } from '../src/lib/stack'; 

describe('QuickSightIntegrationStack', () => {
  const app = new App();
  const stack = new QuickSightIntegrationStack(app, 'QuickSightIntegrationStack', {
    env: { 
      account: '123456789012', 
      region: 'us-east-1',    
    }
  });

  const template = Template.fromStack(stack);

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
          AttributeDataType: 'String',
          Mutable: true,
          Name: 'email',
          Required: true,
        },
      ],
      SignInAliases: {
        Email: true,
      },
    });
  });

  test('User Pool Client Created with Correct User Pool', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      UserPoolId: { Ref: 'UserPool81F7975D' }, // Check the logical ID from your template
      ClientName: 'NuoaQuicksight',
      //more properties
    });
  });

  test('Tenant Groups and Roles Created', () => {
    const tenantGroups = ["TenantA", "TenantB"]; 
    tenantGroups.forEach(tenantName => {
      // Test Cognito Group Creation
      template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
        GroupName: tenantName,
        UserPoolId: { Ref: 'UserPool81F7975D' }, // Check the logical ID
      });

      // Test IAM Role Creation
      template.hasResource('AWS::IAM::Role', {
        Properties: {
          AssumeRolePolicyDocument: {
            Statement: [
              {
                Action: 'sts:AssumeRoleWithWebIdentity',
                Condition: {
                  StringEquals: {
                    'cognito-identity.amazonaws.com:aud': {
                      Ref: 'TenantIdentityPoolF966BA6F', // Check logical ID
                    },
                  },
                  "ForAnyValue:StringLike": {
                    "cognito-identity.amazonaws.com:amr": "authenticated",
                  },
                },
                Effect: 'Allow',
                Principal: {
                  Federated: 'cognito-identity.amazonaws.com',
                },
              },
            ],
            Version: '2012-10-17',
          },
          RoleName: `${tenantName}Role`, // Check if the role name matches
        },
      });
    });
  });

  // more unit tests added in the future
});