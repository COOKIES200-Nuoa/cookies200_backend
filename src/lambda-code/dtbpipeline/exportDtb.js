const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const s3Client = new S3Client();

// Mapping
const tableIdMapping = {
  ActivityTable: 'tenantActivityKey',
  EntityTable: 'tenantEntityKey',
  EntityStructure: 'tenantId'
};

exports.exportDtb = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const newItem = record.dynamodb.NewImage;
      if (!newItem) {
        console.log('No new image found for record:', JSON.stringify(record, null, 2));
        continue;
      }

      // Extract table name from event source ARN
      const eventSourceARN = record.eventSourceARN;
      const tableName = eventSourceARN.split('/')[1];

      // Get the correct ID attribute name for the table
      const idAttributeName = tableIdMapping[tableName];
      if (!idAttributeName) {
        console.log(`No ID attribute mapping found for table: ${tableName}`);
        continue;
      }

      const itemId = newItem[idAttributeName] ? newItem[idAttributeName].S : null;
      if (!itemId) {
        console.log(`No ${idAttributeName} found in new image for record:`, JSON.stringify(newItem, null, 2));
        continue;
      }

      // Create unique S3 object key => can change later to whatver we like :)
      const s3Key = `dynamodb/${tableName}/${itemId}-${new Date().toISOString()}.json`;

      const data = {
        newItem: unmarshall(newItem),
      };

      // Save data to S3
      const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: s3Key,
        Body: JSON.stringify(data),
        ContentType: 'application/json',
      };

      await s3Client.send(new PutObjectCommand(params));

      console.log(`Successfully saved record to ${s3Key}`);
    } catch (err) {
      console.error(`Error processing record: ${JSON.stringify(record, null, 2)}`, err);
    }
  }
};


// SAMPLE TEST EVENT
/*
{
  "Records": [
    {
      "eventID": "1",
      "eventName": "INSERT",
      "eventVersion": "1.0",
      "eventSource": "aws:dynamodb",
      "awsRegion": "us-west-2",
      "dynamodb": {
        "Keys": {
          "tenantActivityKey": {
            "S": "b977950a7ba011ee8397d2fe9d095d03:949c0307-"
          },
          "activityId": {
            "S": "949c0307-e12b-4b5e-b99a-f79b69dfc8e1"
          }
        },
        "NewImage": {
          "tenantActivityKey": {
            "S": "b977950a7ba011ee8397d2fe9d095d03:949c0307-"
          },
          "activityId": {
            "S": "949c0307-e12b-4b5e-b99a-f79b69dfc8e1"
          },
          "createdAt": {
            "S": "2023-12-24T07:55:57.210990Z"
          },
          "createdBy": {
            "S": "b977950a7ba011ee8397d2fe9d095d03.d82c6961-"
          },
          "data": {
            "M": {
              "businessTravelType": {
                "S": "transportation"
              },
              "category": {
                "S": "businessTravel"
              },
              "destinationCountry": {
                "S": "australia"
              },
              "flightClass": {
                "S": "average"
              },
              "monetaryAmount": {
                "S": "0"
              },
              "originCountry": {
                "S": "vietnam"
              },
              "period": {
                "S": "2023/Q2"
              },
              "roundTrip": {
                "S": "true"
              },
              "scope": {
                "N": "3"
              },
              "totalDistance": {
                "N": "10400"
              },
              "travelDate": {
                "S": "10/2023"
              },
              "travelMode": {
                "S": "air"
              }
            }
          },
          "entityId": {
            "S": "08d1b956-aed1-49a8-85b9-b4b187895e3a"
          },
          "formId": {
            "S": "businessTravelTransportationAirForm"
          },
          "lastUpdatedAt": {
            "S": "2023-12-24T07:55:57.2110362"
          },
          "lastUpdatedBy": {
            "S": "b977950a7ba011ee8397d2fe9d095d03.d82c6961-"
          },
          "stateId": {
            "S": "approved"
          },
          "tenantId": {
            "S": "b977950a7ba011ee8397d2fe9d095d03"
          },
          "versionId": {
            "N": "3"
          }
        },
        "SequenceNumber": "111",
        "SizeBytes": 26,
        "StreamViewType": "NEW_IMAGE"
      },
      "eventSourceARN": "arn:aws:dynamodb:us-west-2:123456789012:table/ActivityTable/stream/2024-07-17T09:15:31.289"
    }
  ]
}
*/