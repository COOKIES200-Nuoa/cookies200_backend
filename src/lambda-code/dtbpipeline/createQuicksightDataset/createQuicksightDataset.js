const {
    CreateDataSourceCommand,
    CreateDataSetCommand,
    PutDataSetRefreshPropertiesCommand,
    QuickSightClient,
} = require('@aws-sdk/client-quicksight');

const { createQuickSightResource } = require('./helper/createResource')

const createDataSource = createQuickSightResource('DataSource', CreateDataSourceCommand);
const createDataSet = createQuickSightResource('Dataset', CreateDataSetCommand);

exports.createQuicksightDataset = async (event) => {
    const quicksightClient = new QuickSightClient({});

    const awsAccountId = process.env.AWS_ACC_ID;
    const region = process.env.REGION;
    const adminId = process.env.ADMIN_ID;
    const dataSourceId = process.env.DATASOURCE_ID;
    const dataSourceName = process.env.DATASOURCE_NAME;
    const datasetId = process.env.DATASET_ID;
    const datasetName = process.env.DATASET_NAME;

    const catalogName = process.env.CATALOG_NAME;
    const databaseName = process.env.DATABASE_NAME;
    const latest_partition_table_name = process.env.LATEST_PARTITION_TABLE_NAME;

    const createDataSourceParams = {
        AwsAccountId: awsAccountId,
        DataSourceId: dataSourceId,
        Name: dataSourceName,
        Type: 'ATHENA',
        DataSourceParameters: {
            AthenaParameters: {
                WorkGroup: 'primary'
            }
        },
        Permissions: [
            {
                Principal: `arn:aws:quicksight:${region}:${awsAccountId}:user/default/${adminId}`,
                Actions: [
                    "quicksight:UpdateDataSourcePermissions", 
                    "quicksight:DescribeDataSourcePermissions", 
                    "quicksight:PassDataSource", 
                    "quicksight:DescribeDataSource", 
                    "quicksight:DeleteDataSource", 
                    "quicksight:UpdateDataSource"
                ]
            }
        ]
    };

    const createDatasetParams = {
        AwsAccountId: awsAccountId,
        DataSetId: datasetId,
        Name: datasetName,
        PhysicalTableMap: {
            'nuoa-data-physical-table': {
                CustomSql: {
                    SqlQuery: `
                    WITH RECURSIVE C(id, Amount_LocationBased, Amount_MarketBased, RootID, tenantid, percentage, level) AS (
                        SELECT
                            entityid AS id,
                            COALESCE(emissioninkgco2, emissioninkgco2_forlocationbased, 0) AS Amount_LocationBased,
                            COALESCE(emissioninkgco2, emissioninkgco2_formarketbased, 0) AS Amount_MarketBased,
                            entityid AS RootID,
                            tenantid,
                            parentcontributionpercentage AS percentage,
                            0 AS level
                        FROM ${catalogName}.${databaseName}.${latest_partition_table_name}

                        UNION ALL

                        SELECT 
                            T.parententityid AS id,
                            CAST((C.Amount_LocationBased * C.percentage) AS DECIMAL(20,10))  AS Amount_LocationBased,
                            CAST((C.Amount_MarketBased * C.percentage) AS DECIMAL(20,10)) AS Amount_MarketBased,
                            C.RootID,
                            C.tenantid,
                            C.percentage,
                            C.level + 1 AS level
                        FROM ${catalogName}.${databaseName}.${latest_partition_table_name} AS T
                        INNER JOIN C ON T.entityid = C.id AND T.tenantid = C.tenantid
                    )
                    SELECT 
                        T.entityid AS entityid,
                        T.parententityid,
                        T.emissioninkgco2,
                        T.emissioninkgco2_forlocationbased,
                        T.emissioninkgco2_formarketbased,
                        S.Cumulative_MarketBased AS total_emissions_marketbased,
                        S.Cumulative_LocationBased AS total_emissions_locationbased,
                        T.parentcontributionpercentage,
                        T.scope,
                        T.date,
                        T.country,
                        T.province,
                        T.fuelsource,
                        T.fueltype,
                        T.fuelunit,
                        T.tenantid,
                        T.baseline,
                        T.activityamount,
                        T.manager,
                        T.formid,
                        T.ownershippercentage,
                        T.ownershipconsolidatepercentage,
                        T.consolidateapproach,
                        T.category,
                        T.name,
                        T.code,
                        T.operatingtype,
                        T.industry,
                        T.period,
                        T.activityid
                    FROM ${catalogName}.${databaseName}.${latest_partition_table_name} AS T
                    INNER JOIN (
                                SELECT 
                                    id, 
                                    SUM(Amount_LocationBased) AS Cumulative_LocationBased,
                                    SUM(Amount_MarketBased) AS Cumulative_MarketBased
                                FROM C
                                GROUP BY id
                                ) AS S ON T.entityId = S.id
                    ORDER BY T.entityId, T.parententityid
                    `,
                    DataSourceArn: `arn:aws:quicksight:ap-southeast-1:203903977784:datasource/${dataSourceId}`,
                    Name: datasetName,
                    Columns: [
                        
                        {
                            Name: "entityid",
                            Type: "STRING"
                        },
                        {
                            Name: "parententityid",
                            Type: "STRING"
                        },
                        {
                            Name: "emissioninkgco2",
                            Type: "DECIMAL",
                            SubType: "FIXED"
                        },
                        {
                            Name: "emissioninkgco2_forlocationbased",
                            Type: "DECIMAL",
                            SubType: "FIXED"
                        },
                        {
                            Name: "emissioninkgco2_formarketbased",
                            Type: "DECIMAL",
                            SubType: "FIXED"
                        },
                        {
                            Name: "total_emissions_marketbased",
                            Type: "DECIMAL",
                            SubType: "FIXED"
                        },
                        {
                            Name: "total_emissions_locationbased",
                            Type: "DECIMAL",
                            SubType: "FIXED"
                        },
                        {
                            Name: "parentcontributionpercentage",
                            Type: "DECIMAL",
                            SubType: "FIXED"
                        },
                        {
                            Name: "scope",
                            Type: "STRING"
                        },
                        {
                            Name: "date",
                            Type: "STRING"
                        },
                        {
                            Name: "country",
                            Type: "STRING"
                        },
                        {
                            Name: "province",
                            Type: "STRING"
                        },
                        {
                            Name: "fuelsource",
                            Type: "STRING"
                        },
                        {
                            Name: "fueltype",
                            Type: "STRING"
                        },
                        {
                            Name: "fuelunit",
                            Type: "STRING"
                        },
                        {
                            Name: "tenantid",
                            Type: "STRING"
                        },
                        {
                            Name: "baseline",
                            Type: "STRING"
                        },
                        {
                            Name: "activityamount",
                            Type: "STRING"
                        },
                        {
                            Name: "manager",
                            Type: "STRING"
                        },
                        {
                            Name: "formid",
                            Type: "STRING"
                        },
                        {
                            Name: "ownershippercentage",
                            Type: "STRING"
                        },
                        {
                            Name: "ownershipconsolidatepercentage",
                            Type: "STRING"
                        },
                        {
                            Name: "consolidateapproach",
                            Type: "STRING"
                        },
                        {
                            Name: "category",
                            Type: "STRING"
                        },
                        {
                            Name: "name",
                            Type: "STRING"
                        },
                        {
                            Name: "code",
                            Type: "STRING"
                        },
                        {
                            Name: "operatingtype",
                            Type: "STRING"
                        },
                        {
                            Name: "industry",
                            Type: "STRING"
                        },
                        {
                            Name: "period",
                            Type: "STRING"
                        },
                        {
                            Name: "activityid",
                            Type: "STRING"
                        }
                    ]
                }
            }
        },
        LogicalTableMap: {
            'nuoa-data-logical-table': {
                Alias: 'Nuoa Logical Table',
                DataTransforms: [
                    {
                        CastColumnTypeOperation: {
                            ColumnName: "date",
                            NewColumnType: "DATETIME",
                            Format: "yyy/MM/dd"
                        }
                    },
                    {
                        TagColumnOperation: {
                            ColumnName: "country",
                            Tags: [
                                {
                                    ColumnGeographicRole: "COUNTRY"
                                }
                            ]
                        }
                    },
                    {
                        TagColumnOperation: {
                            ColumnName: "province",
                            Tags: [
                                {
                                    ColumnGeographicRole: "STATE"
                                }
                            ]
                        }
                    },
                    {
                        ProjectOperation: {
                            ProjectedColumns: [
                                "entityid",
                                "parententityid",
                                "emissioninkgco2",
                                "emissioninkgco2_forlocationbased",
                                "emissioninkgco2_formarketbased",
                                "total_emissions_marketbased",
                                "total_emissions_locationbased",
                                "parentcontributionpercentage",
                                "scope",
                                "date",
                                "country",
                                "province",
                                "fuelsource",
                                "fueltype",
                                "fuelunit",
                                "tenantid",
                                "baseline",
                                "activityamount",
                                "manager",
                                "formid",
                                "ownershippercentage",
                                "ownershipconsolidatepercentage",
                                "consolidateapproach",
                                "category",
                                "name",
                                "code",
                                "operatingtype",
                                "industry",
                                "period",
                                "activityid"
                            ]
                        }
                    }
                ],
                Source: {
                    PhysicalTableId: 'nuoa-data-physical-table'
                }
            }
        },
        "OutputColumns": [
            {
                Name: "entityid",
                Type: "STRING"
            },
            {
                Name: "parententityid",
                Type: "STRING"
            },
            {
                Name: "emissioninkgco2",
                Type: "DECIMAL",
                SubType: "FIXED"
            },
            {
                Name: "emissioninkgco2_forlocationbased",
                Type: "DECIMAL",
                SubType: "FIXED"
            },
            {
                Name: "emissioninkgco2_formarketbased",
                Type: "DECIMAL",
                SubType: "FIXED"
            },
            {
                Name: "total_emissions_marketbased",
                Type: "DECIMAL",
                SubType: "FIXED"
            },
            {
                Name: "total_emissions_locationbased",
                Type: "DECIMAL",
                SubType: "FIXED"
            },
            {
                Name: "parentcontributionpercentage",
                Type: "DECIMAL",
                SubType: "FIXED"
            },
            {
                Name: "scope",
                Type: "STRING"
            },
            {
                Name: "date",
                Type: "DATETIME"
            },
            {
                Name: "country",
                Type: "STRING"
            },
            {
                Name: "province",
                Type: "STRING"
            },
            {
                Name: "fuelsource",
                Type: "STRING"
            },
            {
                Name: "fueltype",
                Type: "STRING"
            },
            {
                Name: "fuelunit",
                Type: "STRING"
            },
            {
                Name: "tenantid",
                Type: "STRING"
            },
            {
                Name: "baseline",
                Type: "STRING"
            },
            {
                Name: "activityamount",
                Type: "STRING"
            },
            {
                Name: "manager",
                Type: "STRING"
            },
            {
                Name: "formid",
                Type: "STRING"
            },
            {
                Name: "ownershippercentage",
                Type: "STRING"
            },
            {
                Name: "ownershipconsolidatepercentage",
                Type: "STRING"
            },
            {
                Name: "consolidateapproach",
                Type: "STRING"
            },
            {
                Name: "category",
                Type: "STRING"
            },
            {
                Name: "name",
                Type: "STRING"
            },
            {
                Name: "code",
                Type: "STRING"
            },
            {
                Name: "operatingtype",
                Type: "STRING"
            },
            {
                Name: "industry",
                Type: "STRING"
            },
            {
                Name: "period",
                Type: "STRING"
            },
            {
                Name: "activityid",
                Type: "STRING"
            }
        ],
        ImportMode: 'SPICE',
        Permissions: [
            {
                Principal: `arn:aws:quicksight:${region}:${awsAccountId}:user/default/${adminId}`,
                Actions: [
                "quicksight:DeleteDataSet",
                "quicksight:UpdateDataSetPermissions",
                "quicksight:PutDataSetRefreshProperties",
                "quicksight:CreateRefreshSchedule",
                "quicksight:CancelIngestion",
                "quicksight:UpdateRefreshSchedule",
                "quicksight:DeleteRefreshSchedule",
                "quicksight:PassDataSet",
                "quicksight:ListRefreshSchedules",
                "quicksight:DescribeDataSetRefreshProperties",
                "quicksight:DescribeDataSet",
                "quicksight:CreateIngestion",
                "quicksight:DescribeRefreshSchedule",
                "quicksight:ListIngestions",
                "quicksight:DescribeDataSetPermissions",
                "quicksight:UpdateDataSet",
                "quicksight:DeleteDataSetRefreshProperties",
                "quicksight:DescribeIngestion"
                ]
            }
        ]

    };

    const refreshConfigCommand = new PutDataSetRefreshPropertiesCommand({
        AwsAccountId: awsAccountId,
        DataSetId: datasetId,
        DataSetRefreshProperties: {
            RefreshConfiguration: {
                IncrementalRefresh: {
                    LookbackWindow: {
                        ColumnName: 'date',
                        Size: 1,
                        SizeUnit: "DAY",
                    },
                },
            },
        },
    });

    try {
        await createDataSource(createDataSourceParams);
        await createDataSet(createDatasetParams);
        await quicksightClient.send(refreshConfigCommand);
    } catch (error) {
        console.error('Error creating Quicksight Data Source/Dataset: ', error);
    }
}