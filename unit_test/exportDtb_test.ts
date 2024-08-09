const { exportDtb } = require('../src/lambda-code/dtbpipeline/exportDtb');
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { unmarshall } from "@aws-sdk/util-dynamodb";

const mockS3Client = mockClient(S3Client);

describe('exportDtb', () => {
    let logSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        mockS3Client.reset();
        process.env.BUCKET_NAME = 'test-bucket';

        logSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
    });

    it('should correctly process DynamoDB events and upload to S3', async () => {
        const sampleEvent = {
            Records: [
                {
                    eventSourceARN: "arn:aws:dynamodb:us-west-2:123456789012:table/ActivityTable/stream/2024-07-17T09:15:31.289",
                    dynamodb: {
                        NewImage: {
                            tenantActivityKey: { S: "b977950a7ba011ee8397d2fe9d095d03:949c0307-" },
                            activityId: { S: "949c0307-e12b-4b5e-b99a-f79b69dfc8e1" },
                            createdAt: { S: "2023-12-24T07:55:57.210990Z" },
                        },
                    },
                },
            ],
        };

        mockS3Client.on(PutObjectCommand).resolves({});

        await exportDtb(sampleEvent);

        const putObjectCommand = mockS3Client.commandCalls(PutObjectCommand)[0].args[0].input;

        expect(putObjectCommand).toHaveProperty('Bucket', 'test-bucket');
        expect(putObjectCommand).toHaveProperty('ContentType', 'application/json');
        expect(putObjectCommand).toHaveProperty('Body', JSON.stringify({
            newItem: unmarshall({
                tenantActivityKey: { S: "b977950a7ba011ee8397d2fe9d095d03:949c0307-" },
                activityId: { S: "949c0307-e12b-4b5e-b99a-f79b69dfc8e1" },
                createdAt: { S: "2023-12-24T07:55:57.210990Z" },
            }),
        }));
    });

    it('should log and skip records with no NewImage', async () => {
        const sampleEvent = {
            Records: [
                {
                    eventSourceARN: "arn:aws:dynamodb:us-west-2:123456789012:table/ActivityTable/stream/2024-07-17T09:15:31.289",
                    dynamodb: {}, // No NewImage here
                },
            ],
        };
    
        await exportDtb(sampleEvent);
    
        // Ensure that no S3 PutObjectCommand was attempted
        expect(mockS3Client.commandCalls(PutObjectCommand)).toHaveLength(0);
    
        // Validate that the log was called with the correct message about missing NewImage
        expect(logSpy).toHaveBeenNthCalledWith(2, 
          expect.stringContaining('No new image found for record:'),
          JSON.stringify(sampleEvent.Records[0], null, 2)
        );
    });
    

    it('should log and skip records with missing ID attribute', async () => {
        const sampleEvent = {
            Records: [
                {
                    eventSourceARN: "arn:aws:dynamodb:us-west-2:123456789012:table/ActivityTable/stream/2024-07-17T09:15:31.289",
                    dynamodb: {
                        NewImage: {
                            activityId: { S: "949c0307-e12b-4b5e-b99a-f79b69dfc8e1" }, // Missing 'tenantActivityKey'
                            createdAt: { S: "2023-12-24T07:55:57.210990Z" },
                        },
                    },
                },
            ],
        };

        await expect(exportDtb(sampleEvent)).resolves.not.toThrow();

        // Validate the first log call: should log the received event
        expect(console.log).toHaveBeenNthCalledWith(1,
            expect.stringContaining('Received event:'),
            JSON.stringify(sampleEvent, null, 2)
        );

        // Validate the second log call: should log the missing ID attribute warning
        expect(console.log).toHaveBeenNthCalledWith(2,
            expect.stringContaining('No tenantActivityKey found in new image for record:'),
            JSON.stringify(sampleEvent.Records[0].dynamodb.NewImage, null, 2)
        );
    });

    it('should handle S3 errors gracefully', async () => {
        const sampleEvent = {
            Records: [
                {
                    eventSourceARN: "arn:aws:dynamodb:us-west-2:123456789012:table/ActivityTable/stream/2024-07-17T09:15:31.289",
                    dynamodb: {
                        NewImage: {
                            tenantActivityKey: { S: "b977950a7ba011ee8397d2fe9d095d03:949c0307-" },
                            activityId: { S: "949c0307-e12b-4b5e-b99a-f79b69dfc8e1" },
                            createdAt: { S: "2023-12-24T07:55:57.210990Z" },
                        },
                    },
                },
            ],
        };

        mockS3Client.on(PutObjectCommand).rejects(new Error('S3 Error'));

        await expect(exportDtb(sampleEvent)).resolves.not.toThrow();

        // Log include "Error processing record" along with the event details and an error object
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Error processing record'),
            expect.any(Error)
        );
    });
});
