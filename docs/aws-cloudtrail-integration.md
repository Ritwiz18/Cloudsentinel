# Phase 5: AWS CloudTrail Ingestion & Integration Guide

## 1. Architecture & Data Flow

CloudSentinel's AWS CloudTrail ingestion pipeline is designed for high reliability, fault tolerance, and security:

```text
┌────────────────┐      ObjectCreated      ┌────────────────┐      SQS Message      ┌─────────────────────────┐
│ AWS CloudTrail │ ──────────────────────> │   Amazon S3    │ ────────────────────> │       Amazon SQS        │
│  (Audit Logs)  │      (.json.gz logs)    │ (Audit Bucket) │      (Notifications)  │  (Dead-Letter Queue)    │
└────────────────┘                         └────────────────┘                       └────────────┬────────────┘
                                                                                                 │
                                                                                           Long-Poll (Boto3)
                                                                                                 │
                                                                                                 ▼
┌─────────────────────────┐      Detection Pipeline     ┌───────────────────────┐   Persist (Idempotent)   ┌─────────────────────────┐
│     Security Alerts     │ <────────────────────────── │   Detection Engine    │ <─────────────────────── │  CloudTrail Normalizer  │
│  & Incident Correlation │                             │ (IAM-001, AUTH-001...)│                          │  & Ingestion Worker     │
└─────────────────────────┘                             └───────────────────────┘                          └─────────────────────────┘
```

### Pipeline Flow:
1. **CloudTrail Delivery**: CloudTrail records account activity across regions and writes batches of events into an S3 bucket as compressed `.json.gz` log objects.
2. **S3 Event Notification**: S3 triggers an `s3:ObjectCreated:*` notification directly to an SQS queue (or via SNS fan-out).
3. **SQS Ingestion Worker (`CloudTrailIngestionWorker`)**:
   - Polls the queue using Boto3 with configurable long-polling (`WaitTimeSeconds`) and batching (`MaxNumberOfMessages`).
   - Parses the S3 notification payload, extracts the bucket and object key, and URL-decodes the path.
4. **S3 Reader (`S3LogReader`)**:
   - Streams the compressed `.json.gz` log file from S3 using Boto3.
   - Transparently decompresses Gzip data in-memory and parses CloudTrail records.
5. **Event Normalizer (`normalize_cloudtrail_record`)**:
   - Converts raw AWS CloudTrail schema fields into CloudSentinel's canonical `EventCreate` format.
   - Extracts principal ARNs, source IPs, target resources, AWS service event types (`IAMPolicyChange`, `StorageConfiguration`, `Authentication`, `EC2Read`, etc.), and execution outcomes (`SUCCESS`/`FAILURE`).
   - Enriches diagnostic metadata (`api_action`, `policy_arn`, `bucket_name`, `acl`, `error_code`, `user_agent`) to power downstream threat detection rules.
6. **Idempotent Storage & Message Deletion**:
   - Persists events to PostgreSQL via `create_event()`.
   - If an event with the same `event_id` already exists, it is idempotently skipped without error.
   - SQS messages are deleted **only after** all records are safely persisted or skipped as duplicates.
   - Temporary failures leave the message in SQS to be retried after the visibility timeout or moved to an SQS Dead-Letter Queue (DLQ).
7. **Downstream Detection & Incident Response**:
   - Stored events feed directly into CloudSentinel's deterministic detection engine (`IAM-001`, `STORAGE-001`, `AUTH-001`, `BENIGN-001`) and correlation pipeline.

---

## 2. Least-Privilege IAM Policy

Attach the following policy to the IAM Role assumed by the CloudSentinel backend (e.g., via EC2 Instance Profile, ECS Task Role, or EKS IRSA). It grants read-only access to CloudTrail S3 logs and read/delete access to the specific SQS ingestion queue.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSQSConsumption",
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:us-east-1:112233445566:cloudsentinel-cloudtrail-queue"
    },
    {
      "Sid": "AllowS3CloudTrailLogRead",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion"
      ],
      "Resource": "arn:aws:s3:::cloudsentinel-cloudtrail-logs-112233445566/*"
    },
    {
      "Sid": "AllowS3BucketMetadataCheck",
      "Effect": "Allow",
      "Action": [
        "s3:GetBucketLocation",
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::cloudsentinel-cloudtrail-logs-112233445566"
    }
  ]
}
```

> **Security Note**: This policy contains **zero destructive permissions** and **no administrative privileges**. It does not allow modifying CloudTrail trails, deleting S3 logs, or mutating cloud configurations.

---

## 3. Required Environment Variables

Configure these variables in your deployment environment or `.env`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `AWS_REGION` | Yes | `us-east-1` | AWS region where the SQS queue and S3 bucket reside. |
| `AWS_CLOUDTRAIL_SQS_QUEUE_URL` | For live AWS | `""` | Full HTTPS URL of the SQS queue receiving S3 notifications. |
| `AWS_S3_BUCKET` | Optional | `""` | S3 bucket name containing CloudTrail logs. |
| `AWS_MAX_MESSAGES_PER_POLL` | No | `10` | Max messages received per poll cycle (1-10). |
| `AWS_WAIT_TIME_SECONDS` | No | `5` | Long-polling wait time in seconds (0-20). |
| `AWS_VISIBILITY_TIMEOUT` | No | `60` | In-flight visibility timeout in seconds before redelivery. |
| `AWS_ENDPOINT_URL` | No | `""` | Optional endpoint override for local testing (e.g. LocalStack). |

---

## 4. AWS Resource Setup Instructions

### Step 1: Create the CloudTrail Destination S3 Bucket
```bash
aws s3api create-bucket \
    --bucket cloudsentinel-cloudtrail-logs-112233445566 \
    --region us-east-1

# Enforce S3 Block Public Access
aws s3api put-public-access-block \
    --bucket cloudsentinel-cloudtrail-logs-112233445566 \
    --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### Step 2: Create the SQS Queue with Dead-Letter Queue
```bash
# 1. Create DLQ
aws sqs create-queue \
    --queue-name cloudsentinel-cloudtrail-dlq \
    --region us-east-1

# 2. Create primary SQS queue
aws sqs create-queue \
    --queue-name cloudsentinel-cloudtrail-queue \
    --attributes VisibilityTimeout=60 \
    --region us-east-1
```

### Step 3: Configure SQS Policy to Allow S3 Event Notifications
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "s3.amazonaws.com"
      },
      "Action": "SQS:SendMessage",
      "Resource": "arn:aws:sqs:us-east-1:112233445566:cloudsentinel-cloudtrail-queue",
      "Condition": {
        "ArnEquals": {
          "aws:SourceArn": "arn:aws:s3:::cloudsentinel-cloudtrail-logs-112233445566"
        }
      }
    }
  ]
}
```

### Step 4: Configure S3 ObjectCreated Notifications to SQS
In S3 bucket properties, add an event notification for `All object create events` (`s3:ObjectCreated:*`) with destination set to the SQS queue ARN and prefix `AWSLogs/`.

---

## 5. Local Testing & Verification (Without AWS Credentials)

CloudSentinel supports offline testing:

### 1. Ingest Raw CloudTrail Record via API
```powershell
$record = @{
    eventVersion = "1.08"
    userIdentity = @{
        type = "IAMUser"
        arn = "arn:aws:iam::112233445566:user/devops-lead"
        accountId = "112233445566"
    }
    eventTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    eventSource = "s3.amazonaws.com"
    eventName = "DeletePublicAccessBlock"
    awsRegion = "us-west-2"
    sourceIPAddress = "198.51.100.12"
    requestParameters = @{
        bucketName = "cloudsentinel-customer-pii-vault"
    }
    eventID = "ct-test-storage-001"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/api/v1/integrations/aws/ingest-raw" `
    -Method Post -ContentType "application/json" -Body $record
```

### 2. Check Idempotency
Submitting the identical request again returns:
```json
{"events_ingested": 0, "duplicates_skipped": 1, "records_failed": 0}
```

### 3. Check Integration Status
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/integrations/aws/status"
```

---

## 6. Live AWS Deployment Validation Checklist

- [ ] S3 Bucket has CloudTrail log delivery active and generating `.json.gz` files.
- [ ] S3 Bucket notification is configured to publish `s3:ObjectCreated:*` to SQS queue.
- [ ] SQS Queue policy allows `s3.amazonaws.com` to call `SQS:SendMessage`.
- [ ] Backend container or EC2/ECS role has the least-privilege IAM policy attached.
- [ ] `AWS_REGION` and `AWS_CLOUDTRAIL_SQS_QUEUE_URL` are set in the environment.
- [ ] Check `GET /api/v1/integrations/aws/status` returns `status: "active"`.
- [ ] Trigger on-demand poll via `POST /api/v1/integrations/aws/poll` and verify `messages_received > 0` and `events_ingested > 0`.
- [ ] Confirm events appear in dashboard Security Events tab with `source: "aws.cloudtrail"`.
- [ ] Run Threat Detection on dashboard and confirm alerts trigger for applicable CloudTrail events.
