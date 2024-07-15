const { IAMClient, CreateRoleCommand, PutRolePolicyCommand, GetRoleCommand } = require('@aws-sdk/client-iam');
const { createTenantRole } = require('../src/lambda-code/onboarding/helpers/createTenant/createTenantRole');
// const { waitForRoleCreation } = requrire('../src/lambda-code/onboarding/helpers/createTenant/waitForRoleCreation');
const { getEnv } = require('../src/lambda-code/onboarding/getEnv');
const { mockClient } = require('aws-sdk-client-mock');

import { EntityAlreadyExistsException, NoSuchEntityException } from '@aws-sdk/client-iam';
import 'aws-sdk-client-mock-jest';

// Mock the IAMClient and its methods
const mockIamClient = mockClient(IAMClient);

jest.mock('../src/lambda-code/onboarding/getEnv', () => ({
    getEnv: jest.fn(() => ({
        region: 'ap-southeast-1',
        awsAccountId: '123456789012',
        nuoaAuthRoleArn: 'arn:aws:iam::123456789012:role/nuoa-auth-role',
    })),
}));

describe('createTenantRole', () => {
    it('should create a new role and policy when the role does not exist', async () => {
        const tenantName = 'test';
        const roleTenantName = `${tenantName}TenantRole`;
        const rolePolicyName = `${roleTenantName}Policy`;
        // Mock CreateRoleCommand response
        mockIamClient
            .on(CreateRoleCommand)
            .resolves({ Role: {
                Arn: `arn:aws:iam::123456789012:role/${roleTenantName}`,
                Path: "/",                 // Add the missing Path property
                RoleName: roleTenantName, // Add the missing RoleName property
                RoleId: "AROAX5EXAMPLE",   // Add a mock RoleId
                CreateDate: new Date(),   // Add a mock CreateDate
            }});
        mockIamClient.on(PutRolePolicyCommand).resolves({}); // Mock PutRolePolicyCommand response
        mockIamClient.on(GetRoleCommand).resolves({}); // Mock GetRoleCommand response
        const roleArn = await createTenantRole(tenantName); // Call createTenantRole
        // Assertion for CreateRoleCommand 
        expect(mockIamClient).toHaveReceivedCommandWith(CreateRoleCommand, { 
            RoleName: roleTenantName,
            AssumeRolePolicyDocument: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Principal: {
                            AWS: getEnv().nuoaAuthRoleArn,
                        },
                        Action: 'sts:AssumeRole',
                        Condition: {
                            StringEquals: {
                                'sts:ExternalId': tenantName,
                            },
                        },
                    },
                ],
            }),
            Description: `Role for ${tenantName}`,
        });
        // Assertion for PutRolePolicyCommand 
        expect(mockIamClient).toHaveReceivedCommandWith(PutRolePolicyCommand, {
            RoleName: roleTenantName,
            PolicyName:rolePolicyName,
            PolicyDocument: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: [
                            "quicksight:DescribeDashboard",
                            "quicksight:ListDashboards",
                            "quicksight:GetDashboardEmbedUrl",
                            "quicksight:GenerateEmbedUrlForRegisteredUser",
                            "quicksight:RegisterUser",
                        ],
                        Resource: [`arn:aws:quicksight:${getEnv().region}:${getEnv().awsAccountId}:namespace/${tenantName}`],
                    },
                ],
            }),
        });
        // Assertion for roleARN
        expect(roleArn).toBe(`arn:aws:iam::123456789012:role/${roleTenantName}`);
    });

    it('should handle EntityAlreadyExistsException gracefully', async () => {
        const tenantName = 'existingTenant';
        const existingRoleArn = `arn:aws:iam::${getEnv().awsAccountId}:role/${tenantName}TenantRole`;
        const errorMessage = 'Role already exists.'
        // Create mock reject response
        mockIamClient.on(CreateRoleCommand).rejects(new EntityAlreadyExistsException({  
            message: errorMessage, 
            $metadata: {},
        }));
        const consoleErrorSpy = jest.spyOn(console, 'error'); // Spy on console.error
        // Call the createTenantRole function
        const result = await createTenantRole(tenantName);
        // Assertions
        expect(consoleErrorSpy).toHaveBeenCalledWith(errorMessage);
        expect(result).toBe(existingRoleArn);
        consoleErrorSpy.mockRestore();
    });
});
