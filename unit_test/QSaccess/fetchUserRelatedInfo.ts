const jwt = require('jsonwebtoken');
const { mockClient } = require('aws-sdk-client-mock');
const { QuickSightClient, GenerateEmbedUrlForRegisteredUserCommand } = require('@aws-sdk/client-quicksight');
const { getCognitoUserGroups, generateQuickSightURL } = require('../../src/lambda-code/QSaccess/fetchUserRelatedInfo');

describe('fetchUserRelatedInfo', () => {
  const quicksightMock = mockClient(QuickSightClient);
  const validToken = jwt.sign({ 'cognito:groups': ['testGroup'] }, 'secret');
  const invalidToken = 'invalidToken';

  beforeEach(() => {
    quicksightMock.reset();
  });

  describe('getCognitoUserGroups', () => {
    it('should return the user group from a valid token', () => {
      const group = getCognitoUserGroups(validToken);
      expect(group).toBe('testGroup');
    });

    it('should throw an error for an invalid token', () => {
      expect(() => getCognitoUserGroups(invalidToken)).toThrow('Invalid token');
    });

    it('should throw an error if no groups are found in the token', () => {
      const tokenWithoutGroups = jwt.sign({}, 'secret');
      expect(() => getCognitoUserGroups(tokenWithoutGroups)).toThrow('No group found in the access token');
    });
  });

  describe('generateQuickSightURL', () => {
    it('should generate a QuickSight URL successfully', async () => {
      const mockUrl = 'https://quicksight.aws.amazon.com/mockUrl';
      quicksightMock.on(GenerateEmbedUrlForRegisteredUserCommand).resolves({
        EmbedUrl: mockUrl
      });

      const url = await generateQuickSightURL(validToken);
      expect(url).toBe(mockUrl);
    });

    it('should throw an error when failing to generate a QuickSight URL', async () => {
      const mockError = new Error('QuickSight error');
      quicksightMock.on(GenerateEmbedUrlForRegisteredUserCommand).rejects(mockError);

      await expect(generateQuickSightURL(validToken)).rejects.toThrow('QuickSight error');
    });
  });
});
