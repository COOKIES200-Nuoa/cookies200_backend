const aws = require('aws-sdk');

async function userOnboarding(userName, password) {
    const userName = "test-user-2";
    const password = "P@ssw0rd12366";
    const tenant = "ExampleCompany";
    const dashboardId = "lambda-created-dashboard-3";
    const dashboardName = "Lambda created Dashboard 3";
    const templateId = "test-template";

    var email = '';
    var userRegistered
}