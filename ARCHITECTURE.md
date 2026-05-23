# Architecture

## Overview

The Serverless Finance Tracker follows an event-driven, serverless architecture on AWS. There are no persistent servers — all compute runs on AWS Lambda, data is stored in DynamoDB, and the frontend is served as a static site from S3 via CloudFront.

```
Browser
  └─ CloudFront → S3 (React SPA)
       │
       └─ API Gateway (REST)
            ├─ /expenses    → Lambda: expenses
            ├─ /income      → Lambda: income
            ├─ /savings     → Lambda: savings
            ├─ /budget      → Lambda: budget
            └─ /summary     → Lambda: summary
                                  │
                             DynamoDB
                          ┌───────────────────┐
                          │ transactions       │
                          │ savings_goals      │
                          │ budgets            │
                          └───────────────────┘

EventBridge Scheduler (weekly cron)
  └─ Lambda: weekly-analyzer
       └─ SNS Topic: budget-alerts
            └─ Lambda: alert-notifier
                 └─ SES → Email
```

## Components

### Frontend (React + Vite)
- Served as a static build from S3, distributed via CloudFront.
- Single-page app with tab-based navigation (no React Router).
- All API calls are centralized in `src/services/api.js`.
- API base URL is injected via `VITE_API_URL` environment variable at build time.
- Uses CSS Modules for scoped component styling.

### API Gateway
- REST API with a single stage (`prod`).
- Each resource maps to one Lambda function (Lambda proxy integration).
- CORS is enabled on all resources.
- No authentication — designed as a single-user personal tool.

### Lambda Functions
Seven functions, each independently deployable as a ZIP:

| Function | Trigger | Description |
|---|---|---|
| `expenses` | API Gateway | CRUD for expense transactions |
| `income` | API Gateway | CRUD for income transactions |
| `savings` | API Gateway | CRUD + deposit update for savings goals |
| `budget` | API Gateway | Upsert + read for per-category budgets |
| `summary` | API Gateway | Monthly aggregation by category |
| `weekly-analyzer` | EventBridge Scheduler | Checks spending vs. budget limits, fires alerts |
| `alert-notifier` | SNS | Formats and sends budget alert emails via SES |

Each handler imports from a local `shared/` package (bundled in the ZIP). No Lambda Layers are used.

### DynamoDB
Three tables, all using `userId` as the partition key for single-user scoping:

| Table | PK | SK | Purpose |
|---|---|---|---|
| `transactions` | `userId` | `transactionId` (`{iso-timestamp}#{uuid}`) | Expenses and income |
| `savings_goals` | `userId` | `goalId` (uuid) | Savings goals with progress |
| `budgets` | `userId` | `category` (string) | Per-category monthly limits |

All monetary amounts are stored as DynamoDB `Number` (Python `Decimal`).

### Notification Pipeline
1. **EventBridge Scheduler** fires `weekly-analyzer` on a weekly cron (`cron(0 8 ? * MON *)`).
2. The analyzer queries DynamoDB for current-month expenses and compares them to budget limits.
3. For every category where `actual >= limit × alertThreshold`, it publishes a JSON message to the SNS topic.
4. **SNS** invokes `alert-notifier` synchronously for each message.
5. The notifier calls SES `send_email` with an HTML and plain-text body.

## Security

- No API keys or credentials in source code — all secrets via environment variables (`os.environ`).
- IAM roles follow least-privilege: each Lambda only has access to the tables it needs.
- SES sender must be a verified identity (domain or address).
- CORS is open (`*`) — acceptable for a single-user personal tool; restrict to the CloudFront domain for stricter deployments.

## Cost Model

All services used have a free tier or pay-per-use pricing that results in near-zero cost for personal use:
- Lambda: first 1M requests/month free.
- DynamoDB: 25 GB storage + 25 WCU/RCU free tier (on-demand mode keeps costs proportional to traffic).
- API Gateway: first 1M calls/month free.
- S3 + CloudFront: minimal storage + transfer costs for a static SPA.
- SNS + SES: cents per thousand messages.
