# Setup Guide — AWS Console

This guide walks through provisioning all AWS infrastructure manually via the AWS Console.

> All steps assume the **eu-central-1** (Frankfurt) region. Adjust as needed.

---

## Step 1 — DynamoDB Tables

Create three tables. For each table, use **On-demand** capacity mode.

### Table: `finance-tracker-transactions`
- **Partition key:** `userId` (String)
- **Sort key:** `transactionId` (String)

### Table: `finance-tracker-savings`
- **Partition key:** `userId` (String)
- **Sort key:** `goalId` (String)

### Table: `finance-tracker-budgets`
- **Partition key:** `userId` (String)
- **Sort key:** `category` (String)

---

## Step 2 — IAM Role for Lambda

Create a single IAM role named **`finance-tracker-lambda-role`** with the following permissions:

**AWS managed policies to attach:**
- `AWSLambdaBasicExecutionRole` — CloudWatch Logs access

**Inline policy — DynamoDB access:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/finance-tracker-transactions",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/finance-tracker-savings",
        "arn:aws:dynamodb:eu-central-1:<account-id>:table/finance-tracker-budgets"
      ]
    }
  ]
}
```

**Inline policy — SNS publish (for weekly-analyzer only):**
```json
{
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "arn:aws:sns:eu-central-1:<account-id>:finance-tracker-budget-alerts"
    }
  ]
}
```

**Inline policy — SES send (for alert-notifier only):**
```json
{
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ses:SendEmail",
      "Resource": "*"
    }
  ]
}
```

> For production, split the SNS and SES permissions into separate roles.

**Trust relationship** (already set when selecting "Lambda" as trusted entity):
```json
{
  "Principal": { "Service": "lambda.amazonaws.com" }
}
```

---

## Step 3 — Lambda Functions

Create **7 Lambda functions**. For each:
- **Runtime:** Python 3.12
- **Architecture:** x86_64
- **Execution role:** `finance-tracker-lambda-role`
- **Timeout:** 30 seconds

### Packaging each function

Each function's ZIP must contain:
```
handler.py
shared/
  constants.py
  dynamodb_client.py
  response_helper.py
```

Copy the relevant `handler.py` from `backend/<function-name>/` and include the entire `backend/shared/` directory. Upload the ZIP when creating each function.

### Function names and handlers

| Function name | Handler | Environment Variables |
|---|---|---|
| `finance-tracker-expenses` | `handler.handler` | `TRANSACTIONS_TABLE=finance-tracker-transactions` |
| `finance-tracker-income` | `handler.handler` | `TRANSACTIONS_TABLE=finance-tracker-transactions` |
| `finance-tracker-savings` | `handler.handler` | `SAVINGS_TABLE=finance-tracker-savings` |
| `finance-tracker-budget` | `handler.handler` | `BUDGETS_TABLE=finance-tracker-budgets` |
| `finance-tracker-summary` | `handler.handler` | `TRANSACTIONS_TABLE=finance-tracker-transactions` |
| `finance-tracker-weekly-analyzer` | `handler.handler` | `TRANSACTIONS_TABLE=finance-tracker-transactions`, `BUDGETS_TABLE=finance-tracker-budgets`, `SNS_TOPIC_ARN=<arn>` |
| `finance-tracker-alert-notifier` | `handler.handler` | `SES_SENDER_EMAIL=<verified-email>`, `SES_RECIPIENT_EMAIL=<your-email>` |

---

## Step 4 — API Gateway REST API

1. Go to **API Gateway → Create API → REST API**.
2. Name: `finance-tracker-api`, Endpoint type: **Regional**.
3. Create the following resources and methods. For each method, use **Lambda Proxy Integration** and select the corresponding function.

| Resource | Method | Lambda Function |
|---|---|---|
| `/expenses` | GET, POST | `finance-tracker-expenses` |
| `/expenses/{transactionId}` | DELETE | `finance-tracker-expenses` |
| `/income` | GET, POST | `finance-tracker-income` |
| `/income/{transactionId}` | DELETE | `finance-tracker-income` |
| `/savings` | GET, POST | `finance-tracker-savings` |
| `/savings/{goalId}` | PUT, DELETE | `finance-tracker-savings` |
| `/budget` | GET, POST | `finance-tracker-budget` |
| `/summary` | GET | `finance-tracker-summary` |

4. **Deploy** the API to a new stage named `prod`.
5. Note the **Invoke URL** — you will need it for the frontend `.env.local`.

---

## Step 5 — CORS in API Gateway

For every resource, enable CORS:

1. Select the resource (e.g., `/expenses`).
2. **Actions → Enable CORS**.
3. Set **Access-Control-Allow-Origin** to `*` (or your CloudFront domain).
4. Click **Enable CORS and replace existing CORS headers**.
5. Re-deploy to `prod`.

> The Lambda handlers also return CORS headers directly, which ensures CORS works correctly with Lambda Proxy Integration.

---

## Step 6 — SNS Topic

1. Go to **SNS → Create topic**.
2. **Type:** Standard
3. **Name:** `finance-tracker-budget-alerts`
4. After creation, note the **Topic ARN** and set it as `SNS_TOPIC_ARN` in `finance-tracker-weekly-analyzer`.
5. Create a **subscription**: Protocol = **AWS Lambda**, Endpoint = ARN of `finance-tracker-alert-notifier`.
6. In `finance-tracker-alert-notifier`, add a **trigger**: SNS → select `finance-tracker-budget-alerts`.

---

## Step 7 — SES Email Verification

1. Go to **SES → Verified Identities → Create Identity**.
2. **Identity type:** Email address.
3. Enter the email you will send alerts from (`SES_SENDER_EMAIL`).
4. Open the verification email and click the link.
5. Repeat for the recipient email if your account is still in the **SES sandbox** (sandbox restricts sending to verified addresses only).

> To send to any address, submit a production access request in SES.

---

## Step 8 — EventBridge Scheduler

1. Go to **EventBridge Scheduler → Create schedule**.
2. **Name:** `finance-tracker-weekly-analysis`
3. **Schedule pattern:** Recurring schedule → Cron-based
4. **Cron expression:** `cron(0 8 ? * MON *)` — every Monday at 08:00 UTC
5. **Target:** AWS Lambda → `finance-tracker-weekly-analyzer`
6. **Execution role:** Create a new role (EventBridge will auto-create one with Lambda invoke permissions).

---

## Step 9 — S3 Bucket for Frontend

1. Go to **S3 → Create bucket**.
2. **Name:** `finance-tracker-frontend-<your-account-id>` (must be globally unique).
3. **Region:** Same as the rest.
4. **Block Public Access:** Leave all checkboxes enabled (CloudFront will access via OAC).
5. Build the frontend:
   ```bash
   cd frontend
   VITE_API_URL=https://<invoke-url>/prod npm run build
   ```
6. Upload the contents of `frontend/dist/` to the bucket root.

---

## Step 10 — CloudFront Distribution

1. Go to **CloudFront → Create distribution**.
2. **Origin domain:** Select the S3 bucket created in Step 9.
3. **Origin access:** Create a new **Origin Access Control (OAC)** and grant S3 the required bucket policy (CloudFront will show you the policy — apply it to the S3 bucket).
4. **Default root object:** `index.html`
5. **Custom error responses:** Add a rule — HTTP 403 → `/index.html`, Response code 200. This enables React client-side routing.
6. After creation, note the **CloudFront domain** (e.g., `https://d1234abcd.cloudfront.net`).
7. Update `VITE_API_URL` in your build if needed and re-upload `dist/`.

---

## Summary of Environment Variables

| Lambda | Variable | Value |
|---|---|---|
| expenses, income, summary | `TRANSACTIONS_TABLE` | `finance-tracker-transactions` |
| savings | `SAVINGS_TABLE` | `finance-tracker-savings` |
| budget | `BUDGETS_TABLE` | `finance-tracker-budgets` |
| weekly-analyzer | `TRANSACTIONS_TABLE` | `finance-tracker-transactions` |
| weekly-analyzer | `BUDGETS_TABLE` | `finance-tracker-budgets` |
| weekly-analyzer | `SNS_TOPIC_ARN` | `arn:aws:sns:eu-central-1:<account-id>:finance-tracker-budget-alerts` |
| alert-notifier | `SES_SENDER_EMAIL` | Your verified sender address |
| alert-notifier | `SES_RECIPIENT_EMAIL` | Your alert recipient address |
