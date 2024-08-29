import {
    Duration,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_quicksight as quicksight
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Stack, StackProps, CfnOutput} from 'aws-cdk-lib';
import { CfnTemplate } from 'aws-cdk-lib/aws-quicksight';

export class QuickSightDataStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const dataSourceCatalog = this.node.tryGetContext('catalogName');
        const dataSourceDatabase = this.node.tryGetContext('databaseName');
        const dataSourceTable = this.node.tryGetContext('tableName');
        const databaseName = this.node.tryGetContext('databaseName');
        const adminId = this.node.tryGetContext('adminId');

        // Creating lambda role
        const lambdaRole = new iam.Role(this, "NuoaLambdaExecutionRole", {
            assumedBy: new iam.CompositePrincipal( // Use CompositePrincipal to combine principals
              new iam.ServicePrincipal("lambda.amazonaws.com"),
              new iam.ServicePrincipal("quicksight.amazonaws.com")
            ),
        });

        // Add AWS managed Lambda Execution Policy
        lambdaRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AWSLambdaBasicExecutionRole"
            )
        );

        // Policies for creating Datasource and Dataset
        lambdaRole.addToPolicy(
            new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'quicksight:CreateDataSource',
                'quicksight:CreateDataset'
            ],
            resources: ['*'],
            })
        );

        const quicksight_dataSource_dataset_dunction = new lambda.Function(this, 'Quicksight_Datasource_Dataset_Function', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: '',
            code: lambda.Code.fromAsset(''),
            role: lambdaRole,
            environment: {},
            timeout: Duration.minutes(1),
        })

        // Create the QuickSight data source (Athena)
        const dataSource = new quicksight.CfnDataSource(this, 'NuoaDataSource', {
            awsAccountId: this.account,
            dataSourceId: 'NuoaEmissionDataSource',
            name: 'Nuoa Emission Data Source',
            type: 'ATHENA', 
            dataSourceParameters: { 
                athenaParameters: {
                    workGroup: 'primary' 
                }
            },
        });

        // Create the QuickSight data set
        const dataset = new quicksight.CfnDataSet(this, 'NuoaJoinedDataset', {
            awsAccountId: this.account,
            dataSetId: 'nuoa-joined-dataset',
            name: 'Nuoa Joined Dataset',
            physicalTableMap: { 
                'nuoa-data-physical-table': { 
                  customSql: {
                    sqlQuery:`
                    SELECT * FROM ${dataSourceCatalog}.${databaseName}.${dataSourceTable}
                    WHERE partition_0 = (SELECT partition_0 FROM ${dataSourceCatalog}.${databaseName}."${dataSourceTable}$partitions" ORDER BY partition_0 DESC LIMIT 1) 
                    `,
                    dataSourceArn: dataSource.attrArn,
                    name: dataSourceTable,
                    columns: [
                      {
                        "name": "parentid",
                        "type": "STRING"
                      },
                      {
                          "name": "baseline",
                          "type": "STRING"
                      },
                      {
                          "name": "manager",
                          "type": "STRING"
                      },
                      {
                          "name": "tenantid",
                          "type": "STRING"
                      },
                      {
                          "name": "country",
                          "type": "STRING"
                      },
                      {
                          "name": "formid",
                          "type": "STRING"
                      },
                      {
                          "name": "emissioninkgco2",
                          "type": "INTEGER"
                      },
                      {
                          "name": "province",
                          "type": "STRING"
                      },
                      {
                          "name": "entityid",
                          "type": "STRING"
                      },
                      {
                          "name": "category",
                          "type": "STRING"
                      },
                      {
                          "name": "parentcontributionpercentage",
                          "type": "INTEGER"
                      },
                      {
                          "name": "name",
                          "type": "STRING"
                      },
                      {
                          "name": "operatingtype",
                          "type": "STRING"
                      },
                      {
                          "name": "code",
                          "type": "STRING"
                      },
                      {
                          "name": "stateid",
                          "type": "STRING"
                      },
                      {
                          "name": "scope",
                          "type": "STRING"
                      },
                      {
                          "name": "tenantentitykey",
                          "type": "STRING"
                      },
                      {
                          "name": "industry",
                          "type": "STRING"
                      },
                      {
                          "name": "period",
                          "type": "STRING"
                      },
                      {
                          "name": "lastupdateat",
                          "type": "STRING"
                      },
                      {
                          "name": "activityid",
                          "type": "STRING"
                      },
                      {
                          "name": "tenantactivitykey",
                          "type": "STRING"
                      },
                      {
                          "name": "emissioninkgco2_forlocationbased",
                          "type": "INTEGER"
                      },
                      {
                          "name": "emissioninkgco2_formarketbased",
                          "type": "INTEGER"
                      },
                      {
                          "name": "totaldistance",
                          "type": "INTEGER"
                      },
                      {
                          "name": "destinationcountry",
                          "type": "STRING"
                      },
                      {
                          "name": "travelmode",
                          "type": "STRING"
                      },
                      {
                          "name": "businesstraveltype",
                          "type": "STRING"
                      },
                      {
                          "name": "flightclass",
                          "type": "STRING"
                      },
                      {
                          "name": "origincountry",
                          "type": "STRING"
                      },
                      {
                          "name": "roundtrip",
                          "type": "STRING"
                      },
                      {
                          "name": "traveldate",
                          "type": "STRING"
                      },
                      {
                          "name": "partition_0",
                          "type": "STRING"
                      }
                    ]
                  }
                }
            },
            logicalTableMap: {
              'nuoa-data-physical-table': {
                alias: 'nuoa-joined-table',
                dataTransforms: [

                  {
                    renameColumnOperation: {
                        columnName: "baseline",
                        newColumnName: "Baseline"
                    }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "manager",
                          newColumnName: "Manager"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "tenantid",
                          newColumnName: "Tenant ID"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "country",
                          newColumnName: "Country"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "formid",
                          newColumnName: "Form ID"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "emissioninkgco2",
                          newColumnName: "Emission In KgCO2"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "province",
                          newColumnName: "Province"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "entityid",
                          newColumnName: "Entity ID"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "category",
                          newColumnName: "Category"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "parentcontributionpercentage",
                          newColumnName: "Parent Contribution Percentage"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "name",
                          newColumnName: "Name"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "operatingtype",
                          newColumnName: "Operating Type"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "code",
                          newColumnName: "Code"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "stateid",
                          newColumnName: "State ID"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "scope",
                          newColumnName: "Scope"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "industry",
                          newColumnName: "Industry"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "period",
                          newColumnName: "Period"
                      }
                  },
                  {
                      castColumnTypeOperation: {
                          columnName: "lastupdateat",
                          newColumnType: "DATETIME",
                          format: "yyyy-MM-dd'T'HH:mm:ss.SSSSSSZ"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "activityid",
                          newColumnName: "Activity ID"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "emissioninkgco2_forlocationbased",
                          newColumnName: "Emission in KgCO2 for Location-based"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "emissioninkgco2_formarketbased",
                          newColumnName: "Emission in KgCO2 for Market-based"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "totaldistance",
                          newColumnName: "Total Distance"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "destinationcountry",
                          newColumnName: "Destination Country"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "travelmode",
                          newColumnName: "Travel Mode"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "businesstraveltype",
                          newColumnName: "Business Travel Type"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "flightclass",
                          newColumnName: "Flight Class"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "origincountry",
                          newColumnName: "Origin Country"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "roundtrip",
                          newColumnName: "Round Trip"
                      }
                  },
                  {
                      renameColumnOperation: {
                          columnName: "traveldate",
                          newColumnName: "Travel Date"
                      }
                  },
                  {
                      tagColumnOperation: {
                          columnName: "Country",
                          tags: [
                              {
                                  columnGeographicRole: "COUNTRY"
                              }
                          ]
                      }
                  },
                  {
                    tagColumnOperation: {
                        columnName: "Province",
                        tags: [
                            {
                                columnGeographicRole: "STATE"
                            }
                        ]
                      }
                  },
                  {
                    projectOperation: {
                      projectedColumns: [
                        "parentid",
                        "Baseline",
                        "Manager",
                        "Tenant ID",
                        "Country",
                        "Form ID",
                        "Emission In KgCO2",
                        "Province",
                        "Entity ID",
                        "Category",
                        "Parent Contribution Percentage",
                        "Name",
                        "Operating Type",
                        "Code",
                        "State ID",
                        "Scope",
                        "tenantentitykey",
                        "Industry",
                        "Period",
                        "lastupdateat",
                        "Activity ID",
                        "tenantactivitykey",
                        "Emission in KgCO2 for Location-based",
                        "Emission in KgCO2 for Market-based",
                        "Total Distance",
                        "Destination Country",
                        "Travel Mode",
                        "Business Travel Type",
                        "Flight Class",
                        "Origin Country",
                        "Round Trip",
                        "Travel Date",
                        "partition_0"
                      ]
                    }
                  }
                ],
                source: {
                  physicalTableId: 'nuoa-data-physical-table'
                }
              }
            },
            dataSetRefreshProperties: {
                refreshConfiguration: {
                    incrementalRefresh: {
                        lookbackWindow: {
                            columnName: "lastupdateat",
                            size: 1,
                            sizeUnit: 'DAY'
                        }
                    }
                }
            },
            importMode: 'SPICE', 
            permissions: [
              {
                principal: `arn:aws:quicksight:${this.region}:${this.account}:user/default/${adminId}`,
                actions: [
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
        });
        // Dataset depends on Data Source
        dataset.addDependency(dataSource);

        const template = new CfnTemplate(this, 'NuoaTemplate', {
            awsAccountId: this.account,
            name: 'Nuoa template',
            templateId: 'nuoa-template',
            sourceEntity: {
                sourceAnalysis: {
                    arn: 'arn:aws:quicksight:ap-southeast-1:203903977784:analysis/Tenant-A-analysis',
                    dataSetReferences: [
                        {
                            dataSetArn: 'arn:aws:quicksight:ap-southeast-1:203903977784:dataset/36480a14-da66-4ee6-b6fe-e7181e104428',
                            dataSetPlaceholder: 'data'
                        },
                        {
                            dataSetArn: 'arn:aws:quicksight:ap-southeast-1:203903977784:dataset/6e102090-e86f-4852-9c1d-d3ccde7075e8',
                            dataSetPlaceholder: 'hierarchy'
                        }
                    ]
                }
            }
        });

        // Output API Gateway Endpoint
        new CfnOutput(this, "DatasetArn", {
            value: dataset.attrArn,
            description:
            "The dataset's ARN",
        });
    }
};