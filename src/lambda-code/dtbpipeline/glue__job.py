import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job

args = getResolvedOptions(sys.argv, ['JOB_NAME'])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

# Read data from S3 using Glue dynamic frame
s3_path = "s3://nuoadatabase/dynamodb/"
datasource0 = glueContext.create_dynamic_frame.from_options(
    connection_type = "s3",
    connection_options = {"paths": [s3_path], "recurse": True},
    format = "json",
    transformation_ctx = "datasource0"
)

# Transform and load data into another S3 bucket
output_path = "s3://nuoadatabase-processed/dynamodb/"
datasink1 = glueContext.write_dynamic_frame.from_options(
    frame = datasource0,
    connection_type = "s3",
    connection_options = {"path": output_path},
    format = "parquet",
    transformation_ctx = "datasink1"
)

job.commit()
