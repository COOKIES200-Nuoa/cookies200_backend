import { App, Resource, Stack } from "aws-cdk-lib";
import { QuickSightOnboardingStack } from "../../src/lib/onboarding_stack";
import { Template, Match } from "aws-cdk-lib/assertions";
import { CognitoStack } from "../../src/lib/cognito_stack";
import { Effect, PolicyDocument } from "aws-cdk-lib/aws-iam";

jest.mock("../../src/lib/cognito_stack", () => {
  const mockUserPool = { userPoolId: "mockedUserPoolId" };

  return {
    CognitoStack: jest.fn().mockImplementation(() => ({
      userPool: mockUserPool, // Pass the object directly
      userPoolClientId: "mockedUserPoolClientId",
      nuoaAuthRoleARN: "mockedNuoaAuthRoleArn",
      identityPoolId: "mockedIdentityPoolId",
    })),
  };
});

describe("OnboardingStack", () => {
  let app: App;
  let onboardingStack: QuickSightOnboardingStack;

  beforeAll(() => {
    app = new App();
    const cognitoStack = new CognitoStack(app, "TestCognitoStack", {
      env: {
        account: "891377270638",
        region: "ap-southeast-1",
      },
    });

    onboardingStack = new QuickSightOnboardingStack(
      app,
      "TestOnboardingStack",
      cognitoStack.userPool,
      cognitoStack.userPoolClientId,
      cognitoStack.nuoaAuthRoleARN,
      cognitoStack.identityPoolId,
      {
        env: {
          account: "891377270638",
          region: "ap-southeast-1",
        },
      }
    );
  });

  test("creates a Lambda function", () => {
    const template = Template.fromStack(onboardingStack);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "quicksightOnboarding.quicksightOnboarding",
      Runtime: "nodejs18.x",
      Environment: {
        Variables: {
          REGION: "ap-southeast-1",
          AWS_ACC_ID: "891377270638",
          USER_POOL_ID: "mockedUserPoolId",
          IDPOOL_ID: "mockedIdentityPoolId",
          USER_POOL_CLIENT_ID: "mockedUserPoolClientId",
          AUTH_ROLE_ARN: "mockedNuoaAuthRoleArn",
        },
      },
      Timeout: 60, // Check timeout value
    });
  });

  test("Lambda role has necessary permissions", () => {
    // Use `template.findResources()` to find the IAM policy
    const template = Template.fromStack(onboardingStack);
    
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              "quicksight:CreateNamespace",
              "quicksight:CreateTemplate",
              "quicksight:CreateAnalysis",
              "quicksight:CreateDashboard",
              "quicksight:PassDataSet",
              "quicksight:UpdateAnalysisPermissions",
              "quicksight:UpdateDashboardPermissions",
              "quicksight:DescribeNamespace",
              "quicksight:DescribeTemplate",
              "quicksight:DescribeAnalysis",
              "quicksight:DescribeDashboard",
              "quicksight:RegisterUser",
            ],
            Effect: "Allow",
            Resource: "*",
          },    
          {
            Action: "cognito-idp:CreateGroup",
            Effect: "Allow",
            Resource: "*",
          },
          {
            Action: [
              "iam:CreateRole",
              "iam:PutRolePolicy",
              "iam:GetRole",
              "iam:CreateServiceLinkedRole",
              "iam:DeleteRole",
              "iam:AttachRolePolicy",
              "iam:DeleteRolePolicy",
              "iam:ListRolePolicies",
              "iam:ListAttachedRolePolicies",
              "iam:DetachRolePolicy",
            ],
            Effect: "Allow",
            Resource: "*",
          },
          {
            Action: [
              "ds:CreateIdentityPoolDirectory",
              "ds:DescribeDirectories",
              "ds:AuthorizeApplication",
            ],
            Effect: "Allow",
            Resource: "*",
          },
          {
            Action: "iam:PassRole",
            Effect: "Allow",
            Resource: [
              "arn:aws:iam::891377270638:role/*TenantRole",
              "mockedNuoaAuthRoleArn", 
            ],
          },
          {
            Action: [
              "cognito-identity:SetIdentityPoolRoles",
              "cognito-identity:GetIdentityPoolRoles",
            ],
            Effect: "Allow",
            Resource:
              "arn:aws:cognito-identity:ap-southeast-1:891377270638:identitypool/*",
          },
          {
            Action: "lambda:InvokeFunction",
            Effect: "Allow",
            Resource:{
              "Fn::ImportValue": "RLSTableFuncARN"
            }
          }
        ]
      }
    });
  });
});
