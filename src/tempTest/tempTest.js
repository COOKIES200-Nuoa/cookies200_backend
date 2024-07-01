const { handler } = require('../lambda-code/QSaccess/generateDashboardUrl');

const event = require('./event.json');

handler(event)
  .then(response => console.log('Lambda response:', response))
  .catch(err => console.error('Lambda error:', err));