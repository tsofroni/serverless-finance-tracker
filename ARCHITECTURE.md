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

---

## Components

### Frontend (React + Vite)

- Served as a static build from S3, distributed globally via CloudFront with Origin Access Control (OAC).
- Single-page app with tab-based navigation (Dashboard, Expenses, Income, Savings, Budget, Summary).
- All API calls are centralized in `src/services/api.js` — a single source of truth for the API contract.
- API base URL is injected via `VITE_API_URL` at build time (Vite environment variable).
- CSS Modules for component-scoped styles. No CSS framework dependency.
- Currency formatted with `Intl.NumberFormat` (locale: `de-DE`, currency: `EUR`).

### API Gateway

- REST API with a single `prod` stage.
- Each resource (`/expenses`, `/income`, `/savings`, `/budget`, `/summary`) maps to one Lambda function via Lambda Proxy Integration.
- Only `GET` and `POST` methods are used — all mutations go through `POST` with an `action` discriminator (`create`, `update`, `delete`, `deposit`). This avoids CORS preflight issues with `DELETE`/`PUT`. See [LESSONS_LEARNED.md](LESSONS_LEARNED.md#1-cors-and-api-gateway--the-preflight-trap).
- CORS headers are set both in the OPTIONS Mock integration and in every Lambda response — belt-and-suspenders approach.
- No authentication — designed as a single-user personal tool.

### Lambda Functions

Seven functions, each independently deployable as a ZIP containing `handler.py` + `shared/`:

| Function | Trigger | Table(s) | Description |
|---|---|---|---|
| `expenses` | API Gateway | `transactions` | CRUD for expense records |
| `income` | API Gateway | `transactions` | CRUD for income records |
| `savings` | API Gateway | `savings_goals` | CRUD + deposit for savings goals |
| `budget` | API Gateway | `budgets` | Upsert + read for per-category budget limits |
| `summary` | API Gateway | `transactions` | Monthly aggregation by category |
| `weekly-analyzer` | EventBridge Scheduler | `transactions` + `budgets` | Compares spending to limits, publishes SNS alerts |
| `alert-notifier` | SNS | — | Formats and sends HTML budget alert emails via SES |

**Shared module** (`backend/shared/`): bundled into every ZIP. Contains:
- `response_helper.py` — `success()`/`error()` with CORS headers and `_DecimalEncoder`
- `dynamodb_client.py` — Boto3 singleton
- `constants.py` — expense and income category lists

No Lambda Layers are used — the shared code is small enough that per-function bundling keeps the deployment model simple.

### DynamoDB

Three tables, all with `userId` as the partition key for single-user scoping. The schema is designed so that adding multi-user support later requires only authentication middleware — no table restructuring.

| Table | PK | SK | Notes |
|---|---|---|---|
| `finance-tracker-transactions` | `userId` (String) | `transactionId` (String) | Stores both expenses and income, distinguished by `type` attribute |
| `finance-tracker-savings` | `userId` (String) | `goalId` (String) | Savings goals; `currentAmount` updated atomically via `ADD` expression |
| `finance-tracker-budgets` | `userId` (String) | `category` (String) | Per-category monthly spending limit + alert threshold |

**transactionId format:** `{iso-timestamp}#{uuid4()}` (e.g. `2025-11-14T10:32:01.123456+00:00#a1b2c3...`). The ISO timestamp prefix makes items naturally sortable by insertion time without a GSI.

**Monetary values:** stored as DynamoDB `Number` (Python `Decimal`). See [LESSONS_LEARNED.md](LESSONS_LEARNED.md#3-dynamodb-decimal-vs-python-float) for why `Decimal(str(amount))` is used on every write.

**Filtering transactions by type:** expenses and income share the `transactions` table. The `summary`, `expenses`, and `income` handlers all use `FilterExpression=Attr("type").eq("expense"|"income")`. Note: `FilterExpression` runs after `Query` reads matching pages — for very large datasets, a `type` Global Secondary Index would reduce read costs.

**Monthly filtering in summary:** the `date` attribute is stored as `YYYY-MM-DD`. The summary handler uses `Attr("date").begins_with("2025-11")` to filter transactions for a given month. This works because `begins_with` is a valid DynamoDB filter condition for string attributes.

### Notification Pipeline

1. **EventBridge Scheduler** fires `weekly-analyzer` on `cron(0 8 ? * MON *)` — every Monday at 08:00 UTC.
2. The analyzer queries all current-month transactions for the current user, groups by category, and queries the budgets table for limits.
3. For each category where `actual_spending >= monthly_limit × alert_threshold`, it publishes a JSON message to SNS: `{ category, monthlyLimit, currentSpending, percentage, month }`.
4. **SNS** invokes `alert-notifier` synchronously for each published message.
5. The notifier calls SES `send_email` with both an HTML body (styled table) and a plain-text body.

> Note: EventBridge Scheduler is a distinct service from EventBridge Rules. See [LESSONS_LEARNED.md](LESSONS_LEARNED.md#5-eventbridge-scheduler-vs-eventbridge-rules).

---

## Data Flow — Request Lifecycle

A typical expense creation request:

```
1. User submits form in React
2. api.js: POST /expenses  { action: "create", amount: 42, category: "food", date: "2025-11-14" }
3. API Gateway: routes to expenses Lambda (proxy integration)
4. Lambda: parses body, validates fields, calls DynamoDB PutItem
5. DynamoDB: stores item { userId, transactionId, type: "expense", amount: Decimal(42), ... }
6. Lambda: returns { statusCode: 201, headers: { CORS... }, body: '{"message":"Expense created","transactionId":"..."}' }
7. API Gateway: passes response through to browser
8. React: updates local state, re-renders list
```

---

## Security

- No credentials in source code. See [SECURITY.md](SECURITY.md).
- IAM least privilege: each Lambda reads only from the tables it needs.
- S3 bucket is private; CloudFront accesses via OAC signed requests.
- CORS open to `*` — acceptable for a personal tool; restrict to the CloudFront domain for stricter deployments.
- `userId` is hardcoded (`"user#001"`) — a multi-user version would derive this from a JWT claim via a Cognito Authorizer.

---

## Cost Model

All services used have a free tier or pay-per-use pricing. For personal use (tens to hundreds of API calls per month), the expected cost is **$0/month**.

| Service | Free Tier | Typical personal usage |
|---|---|---|
| Lambda | 1M requests + 400K GB-seconds/month | ~200 requests/month |
| DynamoDB on-demand | 25 WCU + 25 RCU free (legacy) / pay-per-request | < 1,000 requests/month |
| API Gateway | 1M REST calls/month | ~200 calls/month |
| S3 | 5 GB storage + 20K GETs/month | < 1 MB, < 100 GETs/month |
| CloudFront | 1 TB transfer + 10M requests/month | Minimal |
| SNS | 1M publishes/month | 4/month (weekly) |
| SES | 62K emails/month from Lambda | 4/month |
| EventBridge Scheduler | 14M invocations/month | 4/month |

**Pay-per-use is the key advantage:** a traditional server (even the smallest EC2 `t4g.nano` at ~$3/month) would cost more than this architecture running personal traffic for a year.

The cost model shifts once traffic grows. At scale, DynamoDB on-demand becomes expensive compared to provisioned capacity, and Lambda cold starts become a latency concern. For this use case, those concerns are irrelevant.
