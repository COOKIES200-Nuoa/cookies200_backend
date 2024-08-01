# ================== sample glue script to run update on single Parquet file ========================

import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job

# Initialize the Glue job
args = getResolvedOptions(sys.argv, ['JOB_NAME', 'processed_bucket'])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

# Define the S3 paths for the existing Parquet files and the new data
s3_existing_path_activity = f"s3://{args['processed_bucket']}/dynamodb/ActivityTable.parquet"
s3_existing_path_entity = f"s3://{args['processed_bucket']}/dynamodb/EntityTable.parquet"
s3_existing_path_entity_structure = f"s3://{args['processed_bucket']}/dynamodb/EntityStructureTable.parquet"
s3_new_data_path = "s3://nuoadatabase/dynamodb/"

# Read the existing Parquet files
existing_activity_df = spark.read.parquet(s3_existing_path_activity)
existing_entity_df = spark.read.parquet(s3_existing_path_entity)
existing_entity_structure_df = spark.read.parquet(s3_existing_path_entity_structure)

# Read the new data from the JSON files
new_data_df = glueContext.create_dynamic_frame.from_options(
    connection_type="s3",
    connection_options={"paths": [s3_new_data_path], "recurse": True},
    format="json"
).toDF()

# Merge new data with existing DataFrames
# Assuming each table has a unique 'id' column 
updated_activity_df = existing_activity_df.union(new_data_df).dropDuplicates(["id"])
updated_entity_df = existing_entity_df.union(new_data_df).dropDuplicates(["id"])
updated_entity_structure_df = existing_entity_structure_df.union(new_data_df).dropDuplicates(["id"])

# Write the updated DataFrames back to S3 in Parquet format
updated_activity_df.write.mode("overwrite").parquet(s3_existing_path_activity)
updated_entity_df.write.mode("overwrite").parquet(s3_existing_path_entity)
updated_entity_structure_df.write.mode("overwrite").parquet(s3_existing_path_entity_structure)

job.commit()