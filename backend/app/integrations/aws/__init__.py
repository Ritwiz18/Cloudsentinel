"""AWS integration package for CloudTrail ingestion via S3 and SQS."""

from .normalizer import CloudTrailParseError, normalize_cloudtrail_record
from .s3_reader import S3LogReader
from .sqs_consumer import SQSConsumer
from .worker import CloudTrailIngestionWorker

__all__ = [
    "CloudTrailParseError",
    "normalize_cloudtrail_record",
    "S3LogReader",
    "SQSConsumer",
    "CloudTrailIngestionWorker",
]
