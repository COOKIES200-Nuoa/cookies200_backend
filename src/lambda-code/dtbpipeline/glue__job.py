import sys
from datetime import datetime
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job

# Initialize Glue context and job
args = getResolvedOptions(sys.argv, ['JOB_NAME', 'output_path'])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

# Current date in YYYY-MM-DD format
current_date = datetime.now().strftime("%Y-%m-%d")

# Read data from DynamoDB or other sources
activity_table = glueContext.create_dynamic_frame.from_catalog(database="activity", table_name="activity_table")
entity_table = glueContext.create_dynamic_frame.from_catalog(database="entity", table_name="entity_table")

# Perform your join operation
joined_data = Join.apply(activity_table, entity_table, 'entityId', 'entityId')

# Output path with date
output_path = args['output_path'] + f"{current_date}/"

# Write the result as a parquet file to the output path
glueContext.write_dynamic_frame.from_options(
    frame=joined_data,
    connection_type="s3",
    connection_options={"path": output_path},
    format="parquet"
)

job.commit()
