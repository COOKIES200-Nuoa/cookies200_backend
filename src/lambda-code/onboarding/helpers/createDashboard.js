const {  
    CreateNamespaceCommand,
    CreateTemplateCommand,
    CreateAnalysisCommand,
    CreateDashboardCommand,
} = require('@aws-sdk/client-quicksight');

const { createQuickSightResource } = require('./createResource');

const region = process.env.REGION;
const awsAccountId = process.env.AWS_ACC_ID;
const adminId = process.env.QUICKSIGHT_ADMIN;
const datasetId = process.env.DATASET;

const createNamespace = createQuickSightResource('Namespace', CreateNamespaceCommand);
const createTemplate = createQuickSightResource('Template ', CreateTemplateCommand);
const createAnalysis = createQuickSightResource('Analysis', CreateAnalysisCommand);
const createDashboard = createQuickSightResource('Dashboard', CreateDashboardCommand);

async function createQSDashboard(tenant) {
    console.log('Tenant in createDashboard: ', tenant);

    const dashboardId = `${tenant}-dashboard`;
    const dashboardName = `${tenant}'s Dashboard`;

    const analysisId = `${tenant}-analysis`;
    const analysisName = `${tenant}'s Analysis`;

    // Move to CDK Stack later
    const baseTemplate = `minimal-template`;
    const baseTemplateName = `Minimal Template`;

// ========= Create Namespace Params =========
    // Move to CDK Stack later
    const createNameSpaceParams = {
        AwsAccountId: awsAccountId,
        IdentityStore: "QUICKSIGHT",
        Namespace: tenant,
    };

// ========= Minimal Template Definition =========
    // Move to CDK Stack later
    const minimalTemplateDefinition = {
        DataSetConfigurations: [
            {
                Placeholder: "Placeholder_dataset", // Replace with your placeholder name
                DataSetSchema: {
                    ColumnSchemaList: [] // Leave this empty for now, you'll add columns later
                }
            }
        ],
        Sheets: [
            {
                SheetId: "sheet1",
                Name: "Sheet 1",
                FilterControls: [],
                Visuals: [], // No visuals on this initial sheet
            }
        ]
    };


// ========= Create Template Params =========
    const createTemplateParams = {
        AwsAccountId: awsAccountId,
        TemplateId: baseTemplate,
        Name: baseTemplateName,
        Definition: minimalTemplateDefinition,
        Permissions: [
            {
                Principal: `arn:aws:quicksight:${region}:${awsAccountId}:namespace/default`,
                Actions: [
                    "quicksight:DescribeTemplate", 
                    "quicksight:DescribeTemplateAlias", 
                    "quicksight:ListTemplateAliases", 
                    "quicksight:ListTemplateVersions",
                ],
            },
        ],
    };

// ========= Create Analysis Params =========
    const createAnalysisParams = {
        AwsAccountId: awsAccountId,
        AnalysisId: analysisId, 
        Name: analysisName,
        SourceEntity: {
            SourceTemplate: {
                Arn: `arn:aws:quicksight:${region}:${awsAccountId}:template/${baseTemplate}`,
                DataSetReferences: [
                    {
                        DataSetPlaceholder: 'Placeholder_dataset',
                        DataSetArn: `arn:aws:quicksight:${region}:${awsAccountId}:dataset/${datasetId}`
                    }
                ]
            }
        },
        Permissions: [
            {
                Principal: `arn:aws:quicksight:${region}:${awsAccountId}:user/default/${adminId}`,
                Actions: [
                    "quicksight:RestoreAnalysis", 
                    "quicksight:UpdateAnalysisPermissions", 
                    "quicksight:DeleteAnalysis", 
                    "quicksight:QueryAnalysis", 
                    "quicksight:DescribeAnalysisPermissions", 
                    "quicksight:DescribeAnalysis", 
                    "quicksight:UpdateAnalysis"
                ],
            }
        ]
    };

    // ========= Create Dashboard Params =========
    const createDashboardParams = {
        AwsAccountId: awsAccountId,
        DashboardId: dashboardId,
        Name: dashboardName,
        LinkEntities:[
            `arn:aws:quicksight:${region}:${awsAccountId}:analysis/${analysisId}`
        ],
        SourceEntity: {
            SourceTemplate: {
                Arn: `arn:aws:quicksight:${region}:${awsAccountId}:template/${baseTemplate}`,
                DataSetReferences: [
                    {
                        DataSetPlaceholder: 'Placeholder_dataset',
                        DataSetArn: `arn:aws:quicksight:${region}:${awsAccountId}:dataset/${datasetId}`
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
        await createDashboard(createDashboardParams);

    } catch (error) {
        console.log('Error creating Quicksight Resource: ', error);
    }
};

module.exports = { createQSDashboard };