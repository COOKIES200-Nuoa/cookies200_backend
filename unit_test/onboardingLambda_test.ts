const { createTenant } = require('../src/lambda-code/onboarding/helpers/createTenant'); // Replace with your actual file name
const { IAMClient, CreateRoleCommand, PutRolePolicyCommand, GetRoleCommand } = require('@aws-sdk/client-iam');
const { CognitoIdentityClient, SetIdentityPoolRolesCommand, GetIdentityPoolRolesCommand } = require('@aws-sdk/client-cognito-identity');

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-iam', () => {
    const mCreateRoleCommand = jest.fn();
    const mPutRoleCommand = jest.fn();
    const mGetRoleCommand = jest.fn();
    return {
        IAMClient: jest.fn(() => ({
            send: jest.fn((command) => {
                if (command instanceof mCreateRoleCommand) {
                    return Promise.resolve({ Role: { Arn: "arn:aws:iam::123456789012:role/test-role" } });
                }
                if (command instanceof mPutRoleCommand) {
                    return Promise.resolve({});
                }
                if (command instanceof mGetRoleCommand) {
                    return Promise.resolve({});
                }
            }),
        })),
        CreateRoleCommand: mCreateRoleCommand,
        PutRolePolicyCommand: mPutRoleCommand,
        GetRoleCommand: mGetRoleCommand,
    };
});

jest.mock('@aws-sdk/client-cognito-identity', () => {
    const mSetIdentityPoolRolesCommand = jest.fn((input) => ({ input }));
    const mGetIdentityPoolRolesCommand = jest.fn((input) => ({ input }));

    return {
        CognitoIdentityClient: jest.fn(() => ({
            send: jest.fn((command) => {
                if (command instanceof SetIdentityPoolRolesCommand) {
                    if (command.input.IdentityPoolId === 'us-east-1:invalid') {
                        return Promise.reject({ Code: 'InvalidParameterException', message: 'Invalid parameters' });
                    }
                    else if (command.input.IdentityPoolId === 'us-east-1:notfound') {
                        return Promise.reject({ Code: 'ResourceNotFoundException', message: 'Identity pool or role not found' });
                    }
                    else if (command.input.IdentityPoolId === 'us-east-1:notauthorized') {
                        return Promise.reject({ Code: 'NotAuthorizedException', message: 'Not authorized to perform this action' });
                    }
                    else 
                    return Promise.resolve({message: 'Set Role Successful'});
                }
                if (command instanceof GetIdentityPoolRolesCommand) {
                    return Promise.resolve({ RoleMappings: {} });
                }
            }),
        })),
        SetIdentityPoolRolesCommand: mSetIdentityPoolRolesCommand,
        GetIdentityPoolRolesCommand: mGetIdentityPoolRolesCommand,
    };
});

describe('createTenant function', () => { 
    const OLD_ENV = process.env; // Store original env variables

    beforeEach(() => {
      jest.resetModules(); // Ensure fresh module imports for each test
      process.env = { ...OLD_ENV }; // Start with a clean slate
    });
  
    afterEach(() => {
      process.env = OLD_ENV; // Restore original env variables
    });

    it('should create a tenant role and map it correctly', async () => {
        process.env.IDPOOL_ID = 'us-east-1:valid-id';
        const tenantName = 'test';
        const result = await createTenant(tenantName);
        expect(result).toBe('arn:aws:iam::123456789012:role/test-role');
    });
 });


