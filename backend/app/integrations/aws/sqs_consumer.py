import json
import logging
import urllib.parse
from typing import Any, Dict, List, Optional
import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings

logger = logging.getLogger("cloudsentinel.integrations.aws.sqs_consumer")


class SQSConsumerError(Exception):
    """Base exception for SQS consumer failures."""
    pass


class SQSConsumer:
    """
    Consumes event notifications and payloads from Amazon SQS.
    Parses S3 event notifications, SNS-wrapped payloads, and direct event records.
    """

    def __init__(
        self,
        queue_url: Optional[str] = None,
        region_name: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        sqs_client: Optional[Any] = None,
    ):
        self.queue_url = queue_url or settings.AWS_CLOUDTRAIL_SQS_QUEUE_URL
        self.region_name = region_name or settings.AWS_REGION
        self.endpoint_url = endpoint_url or (settings.AWS_ENDPOINT_URL if settings.AWS_ENDPOINT_URL else None)
        self._sqs_client = sqs_client

    @property
    def client(self) -> Any:
        if self._sqs_client is None:
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
            self._sqs_client = boto3.client("sqs", **kwargs)
        return self._sqs_client

    def receive_messages(
        self,
        max_messages: Optional[int] = None,
        wait_time_seconds: Optional[int] = None,
        visibility_timeout: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Polls SQS for incoming messages.
        """
        if not self.queue_url:
            logger.debug("No AWS SQS queue URL configured. Skipping poll.")
            return []

        max_msgs = min(max_messages or settings.AWS_MAX_MESSAGES_PER_POLL, 10)
        wait_time = wait_time_seconds if wait_time_seconds is not None else settings.AWS_WAIT_TIME_SECONDS
        visibility = visibility_timeout or settings.AWS_VISIBILITY_TIMEOUT

        try:
            response = self.client.receive_message(
                QueueUrl=self.queue_url,
                MaxNumberOfMessages=max_msgs,
                WaitTimeSeconds=wait_time,
                VisibilityTimeout=visibility,
                AttributeNames=["All"],
            )
            return response.get("Messages", [])
        except ClientError as exc:
            err_code = exc.response.get("Error", {}).get("Code", "Unknown")
            logger.error("SQS ClientError polling %s: %s (%s)", self.queue_url, err_code, exc)
            raise SQSConsumerError(f"Failed to receive messages from SQS: {err_code}") from exc
        except (BotoCoreError, Exception) as exc:
            logger.error("Unexpected error polling SQS %s: %s", self.queue_url, exc)
            raise SQSConsumerError(f"Unexpected error receiving from SQS: {exc}") from exc

    def delete_message(self, receipt_handle: str) -> None:
        """
        Deletes a successfully processed message from SQS.
        """
        if not self.queue_url or not receipt_handle:
            return

        try:
            self.client.delete_message(
                QueueUrl=self.queue_url,
                ReceiptHandle=receipt_handle,
            )
            logger.debug("Deleted message from queue %s", self.queue_url)
        except ClientError as exc:
            err_code = exc.response.get("Error", {}).get("Code", "Unknown")
            logger.error("Failed to delete message from SQS (%s): %s", err_code, exc)
            raise SQSConsumerError(f"Failed to delete SQS message: {err_code}") from exc
        except Exception as exc:
            logger.error("Unexpected error deleting message from SQS: %s", exc)
            raise SQSConsumerError(f"Unexpected error deleting SQS message: {exc}") from exc

    @staticmethod
    def parse_message_payload(body: str) -> Dict[str, Any]:
        """
        Inspects and extracts operational payload from SQS message body.
        Handles:
        1. S3 Event Notifications (ObjectCreated)
        2. SNS-wrapped S3 Notifications
        3. Direct CloudTrail JSON records (Records: [...])
        4. S3 Test Notifications (s3:TestEvent)
        """
        try:
            parsed = json.loads(body)
        except (TypeError, json.JSONDecodeError) as exc:
            return {
                "type": "malformed_json",
                "raw": body,
                "error": str(exc),
            }

        # Handle SNS-wrapped message
        if isinstance(parsed, dict) and parsed.get("Type") == "Notification" and "Message" in parsed:
            inner_msg = parsed.get("Message", "")
            try:
                parsed = json.loads(inner_msg)
            except Exception:
                # If message is raw string
                pass

        if not isinstance(parsed, dict):
            return {"type": "unknown", "raw": parsed}

        # Check for S3 Test Event
        if parsed.get("Event") == "s3:TestEvent":
            return {"type": "s3_test_event", "details": parsed}

        records = parsed.get("Records")
        if isinstance(records, list) and records:
            first_rec = records[0]
            if isinstance(first_rec, dict):
                # 1. S3 Event Notification
                if "s3" in first_rec:
                    s3_info = first_rec.get("s3", {})
                    bucket_name = s3_info.get("bucket", {}).get("name")
                    raw_key = s3_info.get("object", {}).get("key")
                    unquoted_key = urllib.parse.unquote_plus(raw_key) if raw_key else None
                    return {
                        "type": "s3_notification",
                        "bucket": bucket_name,
                        "key": unquoted_key,
                        "raw_key": raw_key,
                        "event_name": first_rec.get("eventName"),
                    }

                # 2. Direct CloudTrail log records
                if "eventName" in first_rec and "eventSource" in first_rec:
                    return {
                        "type": "direct_records",
                        "records": records,
                    }

        # Single direct CloudTrail record
        if "eventName" in parsed and "eventSource" in parsed:
            return {
                "type": "direct_records",
                "records": [parsed],
            }

        return {"type": "unrecognized", "payload": parsed}
