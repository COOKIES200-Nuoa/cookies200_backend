const AWS = require('aws-sdk');
const glue = new AWS.Glue();

exports.glueTrigger = async (event) => {
  const params = {
    JobName: process.env.GLUE_JOB,
  };

  try {
    const result = await glue.startJobRun(params).promise();
    console.log('Glue job started successfully:', result);
  } catch (error) {
    console.error('Error starting Glue job:', error);
  }
};
