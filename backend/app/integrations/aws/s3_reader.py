import gzip
import io
import json
import logging
from typing import Any, Dict, List, Optional
import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings

logger = logging.getLogger("cloudsentinel.integrations.aws.s3_reader")


class S3ReaderError(Exception):
    """Base exception for S3 log reader failures."""
    pass


class S3LogReader:
    """
    Retrieves and parses CloudTrail audit log archives from Amazon S3.
    Supports gzip-compressed (.json.gz) and uncompressed JSON payloads.
    """

    def __init__(
        self,
        region_name: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        s3_client: Optional[Any] = None,
    ):
        self.region_name = region_name or settings.AWS_REGION
        self.endpoint_url = endpoint_url or (settings.AWS_ENDPOINT_URL if settings.AWS_ENDPOINT_URL else None)
        self._s3_client = s3_client

    @property
    def client(self) -> Any:
        if self._s3_client is None:
            boto_config = Config(
                retries={"max_attempts": 3, "mode": "standard"},
                connect_timeout=5,
                read_timeout=15,
            )
            kwargs: Dict[str, Any] = {
                "region_name": self.region_name,
                "config": boto_config,
            }
            if self.endpoint_url:
                kwargs["endpoint_url"] = self.endpoint_url
            self._s3_client = boto3.client("s3", **kwargs)
        return self._s3_client

    def read_log_records(self, bucket: str, key: str) -> List[Dict[str, Any]]:
        """
        Downloads the log object from S3, decompresses gzip data if needed,
        and parses the CloudTrail JSON structure to extract event records.
        """
        if not bucket or not key:
            raise S3ReaderError("Both bucket and key are required to read an S3 log object.")

        logger.info("Fetching CloudTrail log object s3://%s/%s", bucket, key)
        try:
            response = self.client.get_object(Bucket=bucket, Key=key)
            raw_body = response["Body"].read()
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code", "Unknown")
            logger.error(
                "AWS ClientError reading s3://%s/%s: %s (%s)",
                bucket,
                key,
                error_code,
                exc,
            )
            raise S3ReaderError(f"Failed to fetch S3 object s3://{bucket}/{key}: {error_code}") from exc
        except (BotoCoreError, Exception) as exc:
            logger.error("Unexpected error reading s3://%s/%s: %s", bucket, key, exc)
            raise S3ReaderError(f"Failed to fetch S3 object s3://{bucket}/{key}: {exc}") from exc

        return self.parse_log_content(raw_body, key=key)

    @staticmethod
    def parse_log_content(content: bytes, key: str = "") -> List[Dict[str, Any]]:
        """
        Decompresses and extracts record dictionaries from raw byte content.
        """
        if not content:
            return []

        # Check for GZIP compression magic bytes (0x1f 0x8b) or .gz extension
        if content.startswith(b"\x1f\x8b") or key.endswith(".gz"):
            try:
                with gzip.GzipFile(fileobj=io.BytesIO(content), mode="rb") as gz:
                    decompressed = gz.read()
            except Exception as exc:
                raise S3ReaderError(f"Failed to decompress gzip content for {key}: {exc}") from exc
        else:
            decompressed = content

        try:
            text = decompressed.decode("utf-8")
            data = json.loads(text)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise S3ReaderError(f"Failed to decode or parse JSON from S3 content ({key}): {exc}") from exc

        if isinstance(data, dict):
            records = data.get("Records")
            if isinstance(records, list):
                return [r for r in records if isinstance(r, dict)]
            # If a single record was passed directly
            if "eventName" in data and "eventSource" in data:
                return [data]
            return []
        elif isinstance(data, list):
            return [r for r in data if isinstance(r, dict)]

        return []
