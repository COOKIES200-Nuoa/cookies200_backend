const { GlueClient, StartJobRunCommand } = require('@aws-sdk/client-glue');

exports.glueTrigger = async (event) => {
  const jobName = process.env.JOB_NAME;
  const client = new GlueClient();

  try {
    const command = new StartJobRunCommand({ JobName: jobName });
    const response = await client.send(command);

    console.log(`Glue job ${jobName} started successfully: ${response.JobRunId}`);
    return {
      statusCode: 200,
      body: JSON.stringify(`Glue job ${jobName} started successfully: ${response.JobRunId}`)
    };
  } catch (error) {
    console.error(`Error starting Glue job ${jobName}:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify(`Error starting Glue job ${jobName}: ${error.message}`)
    };
  }
};
