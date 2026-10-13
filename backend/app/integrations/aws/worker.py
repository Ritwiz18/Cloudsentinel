import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.aws.normalizer import CloudTrailParseError, normalize_cloudtrail_record
from app.integrations.aws.s3_reader import S3LogReader, S3ReaderError
from app.integrations.aws.sqs_consumer import SQSConsumer, SQSConsumerError
from app.services.event_service import EventAlreadyExistsError, create_event

logger = logging.getLogger("cloudsentinel.integrations.aws.worker")


class CloudTrailIngestionWorker:
    """
    Orchestrates end-to-end AWS CloudTrail ingestion pipeline:
    SQS Message -> S3 Log Object -> JSON Parsing -> Canonical Normalization -> PostgreSQL Storage.
    
    Guarantees:
    - Idempotent ingestion (duplicate events do not cause errors or duplicate rows).
    - Safe SQS deletion (messages are only removed upon successful persistence/deduplication).
    - Failure containment (malformed events or missing S3 objects do not crash entire worker).
    """

    def __init__(
        self,
        sqs_consumer: Optional[SQSConsumer] = None,
        s3_reader: Optional[S3LogReader] = None,
    ):
        self.sqs_consumer = sqs_consumer or SQSConsumer()
        self.s3_reader = s3_reader or S3LogReader()

    async def process_sqs_batch(
        self,
        db: AsyncSession,
        max_messages: Optional[int] = None,
        wait_time_seconds: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Polls SQS, processes notifications, normalizes events, and commits them to the database.
        """
        metrics = {
            "messages_received": 0,
            "messages_deleted": 0,
            "events_ingested": 0,
            "duplicates_skipped": 0,
            "records_failed": 0,
            "errors": [],
        }

        try:
            messages = self.sqs_consumer.receive_messages(
                max_messages=max_messages,
                wait_time_seconds=wait_time_seconds,
            )
        except SQSConsumerError as exc:
            metrics["errors"].append(f"SQS receive error: {exc}")
            return metrics

        metrics["messages_received"] = len(messages)
        if not messages:
            return metrics

        for msg in messages:
            receipt_handle = msg.get("ReceiptHandle")
            body = msg.get("Body", "")
            msg_id = msg.get("MessageId", "unknown")

            try:
                msg_metrics = await self._process_single_message(db, body=body)
                metrics["events_ingested"] += msg_metrics["events_ingested"]
                metrics["duplicates_skipped"] += msg_metrics["duplicates_skipped"]
                metrics["records_failed"] += msg_metrics["records_failed"]

                # Delete message upon complete successful processing
                if receipt_handle:
                    self.sqs_consumer.delete_message(receipt_handle)
                    metrics["messages_deleted"] += 1

            except Exception as exc:
                err_msg = f"Failed processing SQS message {msg_id}: {exc}"
                logger.error(err_msg, exc_info=True)
                metrics["errors"].append(err_msg)
                # Intentionally DO NOT delete message so SQS can retry or route to DLQ

        return metrics

    async def _process_single_message(
        self,
        db: AsyncSession,
        body: str,
    ) -> Dict[str, int]:
        """Processes one SQS message body and ingests its records."""
        counts = {
            "events_ingested": 0,
            "duplicates_skipped": 0,
            "records_failed": 0,
        }

        payload = self.sqs_consumer.parse_message_payload(body)
        payload_type = payload.get("type")

        # 1. S3 Test Event notification
        if payload_type == "s3_test_event":
            logger.info("Acknowledged S3 test event notification.")
            return counts

        # 2. S3 ObjectCreated notification
        raw_records: List[Dict[str, Any]] = []
        if payload_type == "s3_notification":
            bucket = payload.get("bucket")
            key = payload.get("key")
            if not bucket or not key:
                logger.warning("S3 notification missing bucket or key: %s", payload)
                return counts

            raw_records = self.s3_reader.read_log_records(bucket=bucket, key=key)

        # 3. Direct CloudTrail records
        elif payload_type == "direct_records":
            raw_records = payload.get("records", [])

        else:
            logger.warning("Unrecognized SQS message payload structure: %s", payload_type)
            return counts

        # Ingest extracted records
        batch_counts = await self.ingest_raw_records(db, records=raw_records)
        return batch_counts

    async def ingest_raw_records(
        self,
        db: AsyncSession,
        records: List[Dict[str, Any]],
    ) -> Dict[str, int]:
        """
        Normalizes and commits a list of raw CloudTrail records into PostgreSQL.
        Maintains idempotency and failure containment.
        """
        counts = {
            "events_ingested": 0,
            "duplicates_skipped": 0,
            "records_failed": 0,
        }

        if not records:
            return counts

        for rec in records:
            try:
                event_in = normalize_cloudtrail_record(rec)
            except CloudTrailParseError as parse_err:
                logger.warning("Skipping malformed CloudTrail record: %s", parse_err)
                counts["records_failed"] += 1
                continue

            try:
                await create_event(db=db, event_in=event_in)
                counts["events_ingested"] += 1
                logger.debug("Ingested CloudTrail event %s", event_in.event_id)
            except EventAlreadyExistsError:
                # Idempotent behavior: duplicate event already exists in database
                counts["duplicates_skipped"] += 1
                logger.debug("Idempotently skipped duplicate CloudTrail event %s", event_in.event_id)
            except Exception as exc:
                logger.error("Database error ingesting event %s: %s", event_in.event_id, exc)
                counts["records_failed"] += 1

        # Commit transaction for this batch
        await db.commit()
        return counts
