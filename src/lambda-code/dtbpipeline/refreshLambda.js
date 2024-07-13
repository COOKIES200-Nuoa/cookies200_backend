const AWS = require('aws-sdk');
const quicksight = new AWS.QuickSight();

exports.handler = async (event) => {
  const params = {
    DataSetId: process.env.DATASET_ID,
    AwsAccountId: process.env.AWS_ACCOUNT_ID,
  };

  try {
    await quicksight.createIngestion(params).promise();
    console.log('Successfully refreshed QuickSight dataset');
  } catch (err) {
    console.error(`Error refreshing QuickSight dataset: ${err}`);
  }
};
