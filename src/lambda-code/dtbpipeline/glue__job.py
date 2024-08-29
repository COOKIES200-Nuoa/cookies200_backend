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

# Read data from activity table
activity_table = glueContext.create_dynamic_frame.from_catalog(
database="dynamodb_db", 
table_name="activitytable_dev", 
transformation_ctx="activity_table",
)

# Read data from entity table
entity_table = glueContext.create_dynamic_frame.from_catalog(
database="dynamodb_db", 
table_name="entitytable_dev", 
transformation_ctx="entity_table",
)

# Flatten and select the necessary fields from the activity table
activity_table_flattened = activity_table.apply_mapping([
    ('tenantactivitykey', 'string', 'tenantactivitykey', 'string'),
    ('activityid', 'string', 'activityid', 'string'),
    ('lastupdatedat', 'string', 'lastupdateat', 'string'),
    ('data.businessTravelType', 'string', 'businesstraveltype', 'string'),
    ('data.category', 'string', 'category', 'string'),
    ('data.destinationCountry', 'string', 'destinationcountry', 'string'),
    ('data.flightClass', 'string', 'flightclass', 'string'),
    ('data.originCountry', 'string', 'origincountry', 'string'),
    ('data.period', 'string', 'period', 'string'),
    ('data.roundTrip', 'string', 'roundtrip', 'string'),
    ('data.scope', 'string', 'scope', 'string'),
    ('data.totalDistance', 'string', 'totaldistance', 'int'),
    ('data.travelDate', 'string', 'traveldate', 'string'),
    ('data.travelMode', 'string', 'travelmode', 'string'),
    ('formid', 'string', 'formid', 'string'),
    ('stateid', 'string', 'stateid', 'string'),
    ('emissioninkgco2', 'bigint', 'emissioninkgco2', 'bigint'),
    ('emissioninkgco2_forlocationbased', 'bigint', 'emissioninkgco2_forlocationbased', 'bigint'),
    ('emissioninkgco2_formarketbased', 'bigint', 'emissioninkgco2_formarketbased', 'bigint'),
    ('entityid', 'string', 'entityid', 'string'),
    ('tenantid', 'string', 'tenantid', 'string')
], transformation_ctx = "activity_table_flattened")

# Flatten and select the necessary fields from the entity table
entity_table_flattened = entity_table.apply_mapping([
    ('tenantentitykey', 'string', 'tenantentitykey', 'string'),
    ('entityid', 'string', 'entity_id', 'string'),
    ('tenantid', 'string', 'tenant_id', 'string'),
    ('parentid', 'string', 'parentid', 'string'),
    ('data.baseline', 'string', 'baseline', 'string'),
    ('data.code', 'string', 'code', 'string'),
    ('data.country', 'string', 'country', 'string'),
    ('data.industry', 'string', 'industry', 'string'),
    ('data.manager', 'string', 'manager', 'string'),
    ('data.operatingType', 'string', 'operatingtype', 'string'),
    ('data.province', 'string', 'province', 'string'),
    ('name', 'string', 'name', 'string'),
    ('parentcontributionpercentage', 'string', 'parentcontributionpercentage', 'int')
], transformation_ctx = "entity_table_flattened")

# Perform the join on 'entityid' field
# joined_data = Join.apply(activity_table_flattened, entity_table_flattened, 'entityid', 'entityid')

# Perform the join on 'entityid' and 'tenantid' field
joined_data = activity_table_flattened.join(
    paths1=["entityid", "tenantid"], 
    paths2=["entity_id", "tenant_id"], 
    frame2=entity_table_flattened, 
    transformation_ctx = "joined_data"
).drop_fields(["entity_id", "tenant_id"])

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
