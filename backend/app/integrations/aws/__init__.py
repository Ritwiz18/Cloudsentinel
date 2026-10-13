"""AWS integration package for CloudTrail ingestion via S3 and SQS."""

from app.integrations.aws.normalizer import CloudTrailParseError, normalize_cloudtrail_record
from app.integrations.aws.s3_reader import S3LogReader
from app.integrations.aws.sqs_consumer import SQSConsumer
from app.integrations.aws.worker import CloudTrailIngestionWorker

__all__ = [
    "CloudTrailParseError",
    "normalize_cloudtrail_record",
    "S3LogReader",
    "SQSConsumer",
    "CloudTrailIngestionWorker",
]
