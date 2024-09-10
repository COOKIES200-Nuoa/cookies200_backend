import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { JoinedTableWorkFlowStack } from '../../src/lib/joinedTableWorkflow_stack'; 

test('JoinedTableWorkFlowStack creates resources with correct properties', () => {
  const app = new App();

  // Set context values (replace with appropriate mock values)
  app.node.setContext('activityTableName', 'ActivityTable');
  app.node.setContext('entityTableName', 'EntityTable');
  app.node.setContext('rlsTableName', 'RLSTable');
  app.node.setContext('dataSourceBucket', 'my-data-source-bucket');
  app.node.setContext('tableName', 'my-data-source-table');
  app.node.setContext('databaseName', 'my-glue-database');

  const stack = new JoinedTableWorkFlowStack(app, 'TestJoinedTableWorkFlowStack');
  const template = Template.fromStack(stack);

  // Assert Glue Workflow
  template.hasResourceProperties('AWS::Glue::Workflow', {
    Name: 'glue-workflow',
    Description: 'ETL workflow to convert DynamoDB tables to parquet and then load into Quicksight'
  });

  // Assert Glue Triggers
  template.hasResourceProperties('AWS::Glue::Trigger', {
    Name: {
      'Fn::Join': [
        "",
        [
            "Run-Crawler",
            {"Fn::ImportValue": "DynamoDBCrawlerName"}, 
        ]
      ]
    },
    WorkflowName: 'glue-workflow',
    Actions: [
      {
        CrawlerName: {
          "Fn::ImportValue": "DynamoDBCrawlerName"
        },
        Timeout: 200
      }
    ],
    Type: 'ON_DEMAND'
  });

  template.hasResourceProperties('AWS::Glue::Trigger', {
    Name: {
      'Fn::Join': [
        "",
        [
            "Run-Job",
            {"Fn::ImportValue": "GlueJoinJobName"}, 
        ]
      ]
    },
    WorkflowName: 'glue-workflow',
    Actions: [
      {
        JobName: {
          "Fn::ImportValue": "GlueJoinJobName"
        },
        Timeout: 200
      }
    ],
    Predicate: {
      Conditions: [
        {
          LogicalOperator: 'EQUALS',
          CrawlerName: {
            "Fn::ImportValue": "DynamoDBCrawlerName"
          },
          CrawlState: 'SUCCEEDED'
        }
      ],
      Logical: 'ANY'
    },
    Type: 'CONDITIONAL',
    StartOnCreation: true
  });


  // Parquet Crawler Trigger
  template.hasResourceProperties('AWS::Glue::Trigger', {
    Name: {
      'Fn::Join': [
        "",
        [
            "Run-Crawler-",
            {"Fn::ImportValue": "ParquetCrawlerName"}, 
        ]
      ]
    },
    WorkflowName: 'glue-workflow',
    Actions: [
      {
        CrawlerName: {
          "Fn::ImportValue": "ParquetCrawlerName"
        }
      }
    ],
    Predicate: {
      Conditions: [
        {
          LogicalOperator: 'EQUALS',
          JobName: {
            "Fn::ImportValue": "GlueJoinJobName"
          },
          State: 'SUCCEEDED'
        }
      ],
      Logical: 'ANY'
    },
    Type: 'CONDITIONAL',
    StartOnCreation: true
  });

  // Assert CfnOutputs
  template.hasOutput('WorkflowName', {
    Value: 'glue-workflow',
    Description: 'Name of glue join table workflow',
    Export: {
      Name: 'WorkflowName'
    }
  });

  template.hasOutput('ParquetTableCrawlerName', {
    Value: {
      "Fn::ImportValue": "ParquetCrawlerName"
    },
    Description: 'Name of crawler that crawl the parquet joined table',
    Export: {
      Name: 'ParquetTableCrawlerName'
    }
  });
});