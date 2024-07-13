const AWS = require('aws-sdk');
const kinesis = new AWS.Kinesis();

exports.handler = async (event) => {
  for (const record of event.Records) {
    const params = {
      StreamName: process.env.KINESIS_STREAM_NAME,
      Data: JSON.stringify(record.s3),
      PartitionKey: 'partitionKey',
    };

    try {
      await kinesis.putRecord(params).promise();
      console.log('Successfully put record to Kinesis stream');
    } catch (err) {
      console.error(`Error putting record to Kinesis stream: ${err}`);
    }
  }
};
