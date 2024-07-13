const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  for (const record of event.Records) {
    const data = Buffer.from(record.kinesis.data, 'base64').toString('ascii');
    const parsedData = JSON.parse(data);

    const params = {
      TableName: process.env.ACTIVITY_TABLE,
      Item: parsedData,
    };

    try {
      await dynamoDB.put(params).promise();
      console.log(`Successfully processed record ${record.sequenceNumber}`);
    } catch (err) {
      console.error(`Error processing record ${record.sequenceNumber}: ${err}`);
    }
  }
};
