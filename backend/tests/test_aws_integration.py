import gzip
import io
import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
import pytest
from botocore.exceptions import ClientError
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.detection.service import run_detections
from app.correlation.service import run_correlation
from app.integrations.aws.normalizer import CloudTrailParseError, normalize_cloudtrail_record
from app.integrations.aws.s3_reader import S3LogReader, S3ReaderError
from app.integrations.aws.sqs_consumer import SQSConsumer, SQSConsumerError
from app.integrations.aws.worker import CloudTrailIngestionWorker
from app.schemas.alert import DetectionRunRequest
from app.schemas.incident import CorrelationRunRequest
from app.services.event_service import list_events


@pytest.fixture
def sample_cloudtrail_iam_record() -> dict:
    return {
        "eventVersion": "1.08",
        "userIdentity": {
            "type": "IAMUser",
            "principalId": "AIDAEXAMPLEUSER",
            "arn": "arn:aws:iam::112233445566:user/compromised-contractor",
            "accountId": "112233445566",
            "userName": "compromised-contractor",
        },
        "eventTime": "2026-10-12T17:05:00Z",
        "eventSource": "iam.amazonaws.com",
        "eventName": "AttachUserPolicy",
        "awsRegion": "us-east-1",
        "sourceIPAddress": "198.51.100.88",
        "userAgent": "aws-cli/2.15.0 Python/3.11.6 Linux/5.15.0",
        "requestParameters": {
            "userName": "compromised-contractor",
            "policyArn": "arn:aws:iam::aws:policy/AdministratorAccess",
        },
        "responseElements": None,
        "eventID": "ct-iam-test-uuid-001",
        "readOnly": False,
        "eventType": "AwsApiCall",
        "recipientAccountId": "112233445566",
    }


@pytest.fixture
def sample_cloudtrail_storage_record() -> dict:
    return {
        "eventVersion": "1.08",
        "userIdentity": {
            "type": "IAMUser",
            "arn": "arn:aws:iam::112233445566:user/devops-lead",
            "accountId": "112233445566",
        },
        "eventTime": "2026-10-12T17:10:00Z",
        "eventSource": "s3.amazonaws.com",
        "eventName": "DeletePublicAccessBlock",
        "awsRegion": "us-west-2",
        "sourceIPAddress": "198.51.100.12",
        "requestParameters": {
            "bucketName": "cloudsentinel-customer-pii-vault",
        },
        "eventID": "ct-s3-test-uuid-002",
        "eventType": "AwsApiCall",
        "recipientAccountId": "112233445566",
    }


@pytest.fixture
def sample_cloudtrail_auth_failure_record() -> dict:
    return {
        "eventVersion": "1.08",
        "userIdentity": {
            "type": "IAMUser",
            "arn": "arn:aws:iam::112233445566:user/analyst-bob",
            "accountId": "112233445566",
            "userName": "analyst-bob",
        },
        "eventTime": "2026-10-12T17:15:00Z",
        "eventSource": "signin.amazonaws.com",
        "eventName": "ConsoleLogin",
        "awsRegion": "us-east-1",
        "sourceIPAddress": "203.0.113.195",
        "errorMessage": "Failed authentication",
        "responseElements": {
            "ConsoleLogin": "Failure",
        },
        "eventID": "ct-auth-test-uuid-003",
        "eventType": "AwsConsoleSignIn",
        "recipientAccountId": "112233445566",
    }


# ==========================================
# 1. Normalization Tests
# ==========================================

def test_normalize_valid_iam_record(sample_cloudtrail_iam_record):
    event = normalize_cloudtrail_record(sample_cloudtrail_iam_record)
    assert event.event_id == "ct-iam-test-uuid-001"
    assert event.source == "aws.cloudtrail"
    assert event.event_type == "IAMPolicyChange"
    assert event.outcome == "SUCCESS"
    assert event.actor == "arn:aws:iam::112233445566:user/compromised-contractor"
    assert event.resource == "arn:aws:iam::aws:policy/AdministratorAccess"
    assert event.account_id == "112233445566"
    assert event.region == "us-east-1"
    assert event.source_ip == "198.51.100.88"
    assert event.metadata["api_action"] == "AttachUserPolicy"
    assert event.metadata["policy_arn"] == "arn:aws:iam::aws:policy/AdministratorAccess"
    assert event.metadata["target_user"] == "compromised-contractor"
    assert event.timestamp == datetime(2026, 10, 12, 17, 5, 0, tzinfo=timezone.utc)


def test_normalize_valid_storage_record(sample_cloudtrail_storage_record):
    event = normalize_cloudtrail_record(sample_cloudtrail_storage_record)
    assert event.event_id == "ct-s3-test-uuid-002"
    assert event.source == "aws.cloudtrail"
    assert event.event_type == "StorageConfiguration"
    assert event.outcome == "SUCCESS"
    assert event.actor == "arn:aws:iam::112233445566:user/devops-lead"
    assert event.resource == "arn:aws:s3:::cloudsentinel-customer-pii-vault"
    assert event.metadata["api_action"] == "DeletePublicAccessBlock"
    assert event.metadata["new_state"] == "BlocksDisabled"
    assert event.metadata["bucket_name"] == "cloudsentinel-customer-pii-vault"


def test_normalize_valid_auth_failure_record(sample_cloudtrail_auth_failure_record):
    event = normalize_cloudtrail_record(sample_cloudtrail_auth_failure_record)
    assert event.event_id == "ct-auth-test-uuid-003"
    assert event.source == "aws.cloudtrail"
    assert event.event_type == "Authentication"
    assert event.outcome == "FAILURE"
    assert event.metadata["api_action"] == "ConsoleLogin"
    assert event.metadata["error_message"] == "Failed authentication"


def test_normalize_missing_event_id_generates_deterministic_id(sample_cloudtrail_iam_record):
    del sample_cloudtrail_iam_record["eventID"]
    event1 = normalize_cloudtrail_record(sample_cloudtrail_iam_record)
    event2 = normalize_cloudtrail_record(sample_cloudtrail_iam_record)
    assert event1.event_id.startswith("ct-")
    assert event1.event_id == event2.event_id


def test_normalize_malformed_records():
    # Missing eventTime
    with pytest.raises(CloudTrailParseError):
        normalize_cloudtrail_record({"eventName": "AttachUserPolicy", "eventSource": "iam.amazonaws.com"})

    # Invalid timestamp
    with pytest.raises(CloudTrailParseError):
        normalize_cloudtrail_record({
            "eventTime": "not-a-date",
            "eventName": "AttachUserPolicy",
            "eventSource": "iam.amazonaws.com",
        })

    # Missing eventName
    with pytest.raises(CloudTrailParseError):
        normalize_cloudtrail_record({
            "eventTime": "2026-10-12T17:00:00Z",
            "eventSource": "iam.amazonaws.com",
        })

    # Invalid non-dict input
    with pytest.raises(CloudTrailParseError):
        normalize_cloudtrail_record(12345)  # type: ignore

    # Malformed JSON string
    with pytest.raises(CloudTrailParseError):
        normalize_cloudtrail_record("{not valid json")


# ==========================================
# 2. S3 Reader Tests
# ==========================================

def test_s3_log_reader_parse_uncompressed_content():
    content = json.dumps({
        "Records": [
            {"eventName": "TestEvent1", "eventSource": "test.amazonaws.com"},
            {"eventName": "TestEvent2", "eventSource": "test.amazonaws.com"},
        ]
    }).encode("utf-8")

    records = S3LogReader.parse_log_content(content)
    assert len(records) == 2
    assert records[0]["eventName"] == "TestEvent1"


def test_s3_log_reader_parse_gzip_content():
    raw_json = json.dumps({
        "Records": [
            {"eventName": "GzipEvent", "eventSource": "s3.amazonaws.com"}
        ]
    }).encode("utf-8")

    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb") as gz:
        gz.write(raw_json)
    compressed = buf.getvalue()

    records = S3LogReader.parse_log_content(compressed, key="log.json.gz")
    assert len(records) == 1
    assert records[0]["eventName"] == "GzipEvent"


def test_s3_log_reader_mock_boto3_get_object():
    mock_s3 = MagicMock()
    log_json = json.dumps({"Records": [{"eventName": "MockEvent", "eventSource": "iam.amazonaws.com"}]}).encode("utf-8")
    mock_s3.get_object.return_value = {"Body": io.BytesIO(log_json)}

    reader = S3LogReader(s3_client=mock_s3)
    records = reader.read_log_records("test-bucket", "test-key.json")
    assert len(records) == 1
    assert records[0]["eventName"] == "MockEvent"
    mock_s3.get_object.assert_called_once_with(Bucket="test-bucket", Key="test-key.json")


def test_s3_log_reader_client_error():
    mock_s3 = MagicMock()
    mock_s3.get_object.side_effect = ClientError(
        {"Error": {"Code": "NoSuchKey", "Message": "Key not found"}},
        "GetObject"
    )

    reader = S3LogReader(s3_client=mock_s3)
    with pytest.raises(S3ReaderError) as exc_info:
        reader.read_log_records("test-bucket", "missing-key.json")
    assert "NoSuchKey" in str(exc_info.value)


# ==========================================
# 3. SQS Consumer Tests
# ==========================================

def test_sqs_consumer_parse_s3_notification():
    s3_event_body = json.dumps({
        "Records": [
            {
                "eventSource": "aws:s3",
                "eventName": "ObjectCreated:Put",
                "s3": {
                    "bucket": {"name": "cloudtrail-bucket"},
                    "object": {"key": "AWSLogs/112233445566/CloudTrail/test%2Bfile.json.gz"},
                },
            }
        ]
    })

    parsed = SQSConsumer.parse_message_payload(s3_event_body)
    assert parsed["type"] == "s3_notification"
    assert parsed["bucket"] == "cloudtrail-bucket"
    assert parsed["key"] == "AWSLogs/112233445566/CloudTrail/test+file.json.gz"


def test_sqs_consumer_parse_sns_wrapped_notification():
    inner_s3 = json.dumps({
        "Records": [
            {
                "eventSource": "aws:s3",
                "s3": {
                    "bucket": {"name": "sns-bucket"},
                    "object": {"key": "file.json"},
                },
            }
        ]
    })
    sns_wrapper = json.dumps({
        "Type": "Notification",
        "Message": inner_s3,
    })

    parsed = SQSConsumer.parse_message_payload(sns_wrapper)
    assert parsed["type"] == "s3_notification"
    assert parsed["bucket"] == "sns-bucket"
    assert parsed["key"] == "file.json"


def test_sqs_consumer_parse_direct_records(sample_cloudtrail_iam_record):
    direct_body = json.dumps({"Records": [sample_cloudtrail_iam_record]})
    parsed = SQSConsumer.parse_message_payload(direct_body)
    assert parsed["type"] == "direct_records"
    assert len(parsed["records"]) == 1


def test_sqs_consumer_receive_and_delete_mock():
    mock_sqs = MagicMock()
    mock_sqs.receive_message.return_value = {
        "Messages": [
            {"MessageId": "msg-1", "ReceiptHandle": "receipt-1", "Body": "{}"}
        ]
    }

    consumer = SQSConsumer(queue_url="https://sqs.us-east-1.amazonaws.com/123/queue", sqs_client=mock_sqs)
    msgs = consumer.receive_messages(max_messages=1)
    assert len(msgs) == 1

    consumer.delete_message("receipt-1")
    mock_sqs.delete_message.assert_called_once_with(
        QueueUrl="https://sqs.us-east-1.amazonaws.com/123/queue",
        ReceiptHandle="receipt-1",
    )


# ==========================================
# 4. Worker Integration & Idempotency Tests
# ==========================================

@pytest.mark.asyncio
async def test_worker_processes_s3_notification_pipeline(
    db_session: AsyncSession,
    sample_cloudtrail_iam_record,
    sample_cloudtrail_storage_record,
):
    # Mock SQS returning an S3 notification
    mock_sqs = MagicMock()
    s3_body = json.dumps({
        "Records": [
            {
                "eventSource": "aws:s3",
                "s3": {
                    "bucket": {"name": "audit-bucket"},
                    "object": {"key": "AWSLogs/log.json.gz"},
                },
            }
        ]
    })
    mock_sqs.receive_message.return_value = {
        "Messages": [{"MessageId": "msg-100", "ReceiptHandle": "rcpt-100", "Body": s3_body}]
    }

    # Mock S3 returning the 2 records gzipped
    mock_s3 = MagicMock()
    raw_json = json.dumps({"Records": [sample_cloudtrail_iam_record, sample_cloudtrail_storage_record]}).encode("utf-8")
    gz_buf = io.BytesIO()
    with gzip.GzipFile(fileobj=gz_buf, mode="wb") as gz:
        gz.write(raw_json)
    mock_s3.get_object.return_value = {"Body": io.BytesIO(gz_buf.getvalue())}

    consumer = SQSConsumer(queue_url="https://sqs.us-east-1.amazonaws.com/123/queue", sqs_client=mock_sqs)
    reader = S3LogReader(s3_client=mock_s3)
    worker = CloudTrailIngestionWorker(sqs_consumer=consumer, s3_reader=reader)

    metrics = await worker.process_sqs_batch(db=db_session)

    assert metrics["messages_received"] == 1
    assert metrics["messages_deleted"] == 1
    assert metrics["events_ingested"] == 2
    assert metrics["duplicates_skipped"] == 0
    assert metrics["records_failed"] == 0
    assert len(metrics["errors"]) == 0
    mock_sqs.delete_message.assert_called_once()

    # Verify persisted in database
    items, total = await list_events(db=db_session)
    assert total == 2
    event_ids = [e.event_id for e in items]
    assert "ct-iam-test-uuid-001" in event_ids
    assert "ct-s3-test-uuid-002" in event_ids


@pytest.mark.asyncio
async def test_worker_idempotency_prevents_duplicate_records(
    db_session: AsyncSession,
    sample_cloudtrail_iam_record,
):
    worker = CloudTrailIngestionWorker()

    # Pass 1: Ingest records
    counts1 = await worker.ingest_raw_records(db=db_session, records=[sample_cloudtrail_iam_record])
    assert counts1["events_ingested"] == 1
    assert counts1["duplicates_skipped"] == 0

    # Pass 2: Ingest same records again
    counts2 = await worker.ingest_raw_records(db=db_session, records=[sample_cloudtrail_iam_record])
    assert counts2["events_ingested"] == 0
    assert counts2["duplicates_skipped"] == 1

    # Verify database still has exactly 1 record
    items, total = await list_events(db=db_session)
    assert total == 1


@pytest.mark.asyncio
async def test_worker_error_containment_on_malformed_records(
    db_session: AsyncSession,
    sample_cloudtrail_iam_record,
):
    malformed_record = {"invalid": "missing essential fields"}
    worker = CloudTrailIngestionWorker()

    counts = await worker.ingest_raw_records(
        db=db_session,
        records=[sample_cloudtrail_iam_record, malformed_record],
    )
    assert counts["events_ingested"] == 1
    assert counts["records_failed"] == 1

    items, total = await list_events(db=db_session)
    assert total == 1


@pytest.mark.asyncio
async def test_worker_s3_error_preserves_sqs_message(db_session: AsyncSession):
    mock_sqs = MagicMock()
    s3_body = json.dumps({
        "Records": [{"eventSource": "aws:s3", "s3": {"bucket": {"name": "b"}, "object": {"key": "missing.json"}}}]
    })
    mock_sqs.receive_message.return_value = {
        "Messages": [{"MessageId": "msg-err", "ReceiptHandle": "rcpt-err", "Body": s3_body}]
    }

    mock_s3 = MagicMock()
    mock_s3.get_object.side_effect = ClientError({"Error": {"Code": "AccessDenied"}}, "GetObject")

    consumer = SQSConsumer(queue_url="https://sqs.us-east-1.amazonaws.com/123/queue", sqs_client=mock_sqs)
    reader = S3LogReader(s3_client=mock_s3)
    worker = CloudTrailIngestionWorker(sqs_consumer=consumer, s3_reader=reader)

    metrics = await worker.process_sqs_batch(db=db_session)

    assert metrics["messages_received"] == 1
    assert metrics["messages_deleted"] == 0  # Preserved!
    assert len(metrics["errors"]) == 1
    mock_sqs.delete_message.assert_not_called()


# ==========================================
# 5. Full Security Workflow Integration
# ==========================================

@pytest.mark.asyncio
async def test_cloudtrail_ingestion_triggers_detection_and_incident(
    db_session: AsyncSession,
    sample_cloudtrail_iam_record,
):
    """
    Validates end-to-end integration:
    CloudTrail Ingestion -> Detection Engine -> Alert Creation -> Correlation -> Incident Cluster.
    """
    worker = CloudTrailIngestionWorker()
    await worker.ingest_raw_records(db=db_session, records=[sample_cloudtrail_iam_record])

    # Trigger detection engine
    det_resp = await run_detections(db=db_session, request=DetectionRunRequest(lookback_minutes=120))
    assert det_resp.events_evaluated == 1
    assert det_resp.alerts_created == 1

    # Trigger incident correlation
    corr_resp = await run_correlation(db=db_session, request=CorrelationRunRequest(lookback_minutes=120, window_minutes=60))
    assert corr_resp.incidents_created == 1
    assert corr_resp.alerts_evaluated == 1


# ==========================================
# 6. AWS API Endpoints Tests
# ==========================================

@pytest.mark.asyncio
async def test_aws_status_endpoint(async_client: AsyncClient):
    resp = await async_client.get("/api/v1/integrations/aws/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "region" in data
    assert "sqs_configured" in data


@pytest.mark.asyncio
async def test_aws_ingest_raw_endpoint(async_client: AsyncClient, sample_cloudtrail_iam_record):
    payload = {"Records": [sample_cloudtrail_iam_record]}
    resp = await async_client.post("/api/v1/integrations/aws/ingest-raw", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["events_ingested"] == 1
    assert data["duplicates_skipped"] == 0

    # Ingest again -> idempotency check via API
    resp2 = await async_client.post("/api/v1/integrations/aws/ingest-raw", json=payload)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["events_ingested"] == 0
    assert data2["duplicates_skipped"] == 1


@pytest.mark.asyncio
async def test_aws_poll_endpoint_unconfigured_skips_gracefully(async_client: AsyncClient):
    resp = await async_client.post("/api/v1/integrations/aws/poll", json={"max_messages": 5})
    assert resp.status_code == 200
    data = resp.json()
    assert data["messages_received"] == 0
    assert data["events_ingested"] == 0
