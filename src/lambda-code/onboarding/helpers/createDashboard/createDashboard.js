const {  
    CreateNamespaceCommand,
    CreateTemplateCommand,
    CreateAnalysisCommand,
    CreateDashboardCommand,
    RegisterUserCommand,
} = require('@aws-sdk/client-quicksight');
const { getEnv } = require('../../getEnv');

const { createQuickSightResource } = require('./createResource');

// const region = process.env.REGION;
// const awsAccountId = process.env.AWS_ACC_ID;
// const datasetId = process.env.DATASET;
// const adminId = process.env.QUICKSIGHT_ADMIN_ID;

const createNamespace = createQuickSightResource('Namespace', CreateNamespaceCommand);
const createTemplate = createQuickSightResource('Template', CreateTemplateCommand);
const createAnalysis = createQuickSightResource('Analysis', CreateAnalysisCommand);
const createDashboard = createQuickSightResource('Dashboard', CreateDashboardCommand);
const registerUser = createQuickSightResource('User', RegisterUserCommand);

async function createQSDashboard(tenant, email, tenantRoleArn) {
    console.log('Tenant in createDashboard: ', tenant);

    const dashboardId = `${tenant}-dashboard`;
    const dashboardName = `${tenant}'s Dashboard`;

    const analysisId = `${tenant}-analysis`;
    const analysisName = `${tenant}'s Analysis`;

    // Move to CDK Stack later
    const baseTemplate = `minimal-template`;
    const baseTemplateName = `Minimal Template`;

// ========= Create Namespace Params =========
    const createNameSpaceParams = {
        AwsAccountId: getEnv().awsAccountId,
        IdentityStore: "QUICKSIGHT",
        Namespace: tenant,
    };

// ========= Minimal Template Definition =========
    // Move to CDK Stack later
    const minimalTemplateDefinition = {
        DataSetConfigurations: [
            {
                Placeholder: "Placeholder_dataset", 
                DataSetSchema: {
                    ColumnSchemaList: [] 
                }
            }
        ],
        Sheets: [
            {
                SheetId: "sheet1",
                Name: "Sheet 1",
                FilterControls: [],
                Visuals: [],
            }
        ]
    };


// ========= Create Template Params =========
    const createTemplateParams = {
        AwsAccountId: getEnv().awsAccountId,
        TemplateId: baseTemplate,
        Name: baseTemplateName,
        Definition: minimalTemplateDefinition,
        Permissions: [
            {
                Principal: `arn:aws:quicksight:${getEnv().region}:${getEnv().awsAccountId}:user/default/${getEnv().adminId}`,
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
        AwsAccountId: getEnv().awsAccountId,
        AnalysisId: analysisId, 
        Name: analysisName,
        SourceEntity: {
            SourceTemplate: {
                Arn: `arn:aws:quicksight:${getEnv().region}:${getEnv().awsAccountId}:template/${baseTemplate}`,
                DataSetReferences: [
                    {
                        DataSetPlaceholder: 'Placeholder_dataset',
                        DataSetArn: `arn:aws:quicksight:${getEnv().region}:${getEnv().awsAccountId}:dataset/${getEnv().datasetId}`
                    }
                ]
            }
        },
        Permissions: [
            {
                Principal: `arn:aws:quicksight:${getEnv().region}:${getEnv().awsAccountId}:user/default/${getEnv().adminId}`,
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
        AwsAccountId: getEnv().awsAccountId,
        DashboardId: dashboardId,
        Name: dashboardName,
        LinkEntities:[
            `arn:aws:quicksight:${getEnv().region}:${getEnv().awsAccountId}:analysis/${analysisId}`
        ],
        SourceEntity: {
            SourceTemplate: {
                Arn: `arn:aws:quicksight:${getEnv().region}:${getEnv().awsAccountId}:template/${baseTemplate}`,
                DataSetReferences: [
                    {
                        DataSetPlaceholder: 'Placeholder_dataset',
                        DataSetArn: `arn:aws:quicksight:${getEnv().region}:${getEnv().awsAccountId}:dataset/${getEnv().datasetId}`
                    }
                ]
            }
        },
        Permissions: [
            {
                // Grant permissions to admin
                Principal: `arn:aws:quicksight:${getEnv().region}:${getEnv().awsAccountId}:user/default/${getEnv().adminId}`,
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
                Principal: `arn:aws:quicksight:${getEnv().region}:${getEnv().awsAccountId}:namespace/${tenant}`,
                Actions: [
                    "quicksight:QueryAnalysis", 
                    "quicksight:DescribeAnalysis", 
                ]
            },
        ]
    };

// ========= Register User Params =========
    const registerUserParams = {
        AwsAccountId: getEnv().awsAccountId,
        Email: email,
        IdentityType: 'IAM',
        Namespace: tenant,
        UserRole: 'READER',
        SessionName: tenant,
        IamArn: tenantRoleArn,
    }

    try {
        await createNamespace(createNameSpaceParams);
        await createTemplate(createTemplateParams);
        await createAnalysis(createAnalysisParams);
        await createDashboard(createDashboardParams);
        await registerUser(registerUserParams);

    } catch (error) {
        console.log('Error creating Quicksight Resource: ', error);
    }
};
module.exports = { createQSDashboard };