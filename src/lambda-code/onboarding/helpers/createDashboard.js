const AWS = require('aws-sdk')
const { createQuickSightResource } = require('./createQsResources');

const region = process.env.REGION;
const awsAccountId = process.env.AWS_ACC_ID;
const adminId = process.env.QUICKSIGHT_ADMIN;
const adminId2 = process.env.QUICKSIGHT_ADMIN_2;
const namespace = process.env.NAMESPACE;

const quicksight = new AWS.QuickSight({ region: region });

const createNamespace = createQuickSightResource('Namespace', quicksight.createNamespace);
const createAnalysis = createQuickSightResource('Analysis', quicksight.createAnalysis);
const createDashboard = createQuickSightResource('Dashboard', quicksight.createDashboard);
const createTemplate = createQuickSightResource('Template ', quicksight.createTemplate);

async function createQSDashboard(tenant) {
    const dashboardId = `${tenant}-dashboard`;
    const dashboardName = `${tenant}'s Dashboard`;

    const analysisId = `${tenant}-analysis`;
    const analysisName = `${tenant}'s Analysis`;

    const userTemplateId = `${tenant}-template`;
    const userTemplateName = `${tenant} Template`;

// ========= Create Namespace Params =========
    const createNameSpaceParams = {
        AwsAccountId: awsAccountId,
        IdentityStore: "QUICKSIGHT",
        Namespace: tenant,
    };

// ========= Empty Template Definition =========
    const templateDefinition = {
        "Version": "1.0",
        "Parameters": {
            "DataSource": {
                "Type": "RELATIONAL" // Placeholder data source type (can be adjusted based on your needs)
            }
        },
        "Sheets": [
            {
                "Name": "Sheet1",
                "Layout": {
                    "Rows": 1,
                    "Columns": 1
                },
                "Embeds": [{
                    "Type": "EMPTY" // Placeholder for your visualization
                }]
            }
        ]
    };

// ========= Create Template Params =========
    const createTemplateParams = {
        AwsAccountId: awsAccountId,
        TemplateId: userTemplateId,
        Name: userTemplateName,
        Definition: templateDefinition,
    };

// ========= Create Analysis Params =========
    const createAnalysisParams = {
        AwsAccountId: awsAccountId,
        AnalysisId: analysisId, 
        Name: analysisName,
        SourceEntity: {
            SourceTemplate: {
                Arn: `arn:aws:quicksight:ap-southeast-1:203903977784:template/${templateId}`,
                DataSetReferences: [
                    {
                        DataSetPlaceholder: 'nuoa-test-dataset',
                        DataSetArn: 'arn:aws:quicksight:ap-southeast-1:203903977784:dataset/766f8d90-4db1-46d6-9d7e-b15ced551259'
                    }
                ]
            }
        }
    };

// ========= Update Analysis Permissions =========
    const updateAnalysisPermissionsParams = {
        AwsAccountId: awsAccountId,
        AnalysisId: `${dashboardId}-analysis`, 
        GrantPermissions: [ 
            {
                // Grant permissions to admin
                Actions: [
                "quicksight:RestoreAnalysis", 
                "quicksight:UpdateAnalysisPermissions", 
                "quicksight:DeleteAnalysis", 
                "quicksight:QueryAnalysis", 
                "quicksight:DescribeAnalysisPermissions", 
                "quicksight:DescribeAnalysis", 
                "quicksight:UpdateAnalysis"
                ],
                Principal: `arn:aws:quicksight:${region}:${awsAccountId}:user/default/${adminId}`
            }
        ]
    };

// ========= Create Dashboard Params =========
    const createDashboardParams = {
        AwsAccountId: awsAccountId,
        DashboardId: dashboardId,
        Name: dashboardName,
        LinkEntities:[
            `arn:aws:quicksight:ap-southeast-1:203903977784:analysis/${analysisId}`
        ],
        SourceEntity: {
            SourceTemplate: {
                Arn: `arn:aws:quicksight:ap-southeast-1:203903977784:template/${userTemplateId}`,
                DataSetReferences: [
                    {
                        DataSetPlaceholder: 'nuoa-test-dataset',
                        DataSetArn: 'arn:aws:quicksight:ap-southeast-1:203903977784:dataset/766f8d90-4db1-46d6-9d7e-b15ced551259'
                    }
                ]
            }
        },
        Permissions: [
            {
                // Grant permissions to admin
                Principal: `arn:aws:quicksight:${region}:${awsAccountId}:user/default/${adminId}`,
                Actions: [
                    "quicksight:DescribeDashboard", 
                    "quicksight:ListDashboardVersions", 
                    "quicksight:UpdateDashboardPermissions", 
                    "quicksight:QueryDashboard", 
                    "quicksight:UpdateDashboard", 
                    "quicksight:DeleteDashboard", 
                    "quicksight:UpdateDashboardPublishedVersion", 
                    "quicksight:DescribeDashboardPermissions"
                ]
            },
            {
                // Grant permissions to tenant's namespace
                Principal: `arn:aws:quicksight:${region}:${awsAccountId}:namespace/${tenant}`,
                Actions: [
                    'quicksight:DescribeDashboard',
                    'quicksight:ListDashboardVersions',
                    'quicksight:QueryDashboard',
                ] 
            }
        ]
    };

    try {
        await createNamespace(createNameSpaceParams);
        await createTemplate(createTemplateParams);
        await createAnalysis(createAnalysisParams);
        await quicksight.updateAnalysisPermissions(updateAnalysisPermissionsParams).promise();
        await createDashboard(createDashboardParams);

    } catch (error) {
        console.log('Error creating Quicksight Resource: ', error);
    }

};

module.exports = { createQSDashboard };