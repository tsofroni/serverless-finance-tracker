# Serverless Finance Tracker

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-FF9900?logo=awslambda&logoColor=white)
![DynamoDB](https://img.shields.io/badge/AWS-DynamoDB-4053D6?logo=amazondynamodb&logoColor=white)
![API Gateway](https://img.shields.io/badge/AWS-API_Gateway-FF4F8B?logo=amazonapigateway&logoColor=white)

A cloud-native personal finance tracker built entirely on AWS serverless infrastructure — no servers to manage, near-zero idle cost, and infinite scale. Track income and expenses, manage savings goals, configure category budgets, and receive automated weekly spending alerts via email.

Built as an AWS portfolio project demonstrating a real-world event-driven architecture across **8 AWS services**: Lambda, DynamoDB, API Gateway, S3, CloudFront, SNS, SES, and EventBridge Scheduler.

---

## Architecture

```
                          ┌─────────────────────────────────────────┐
                          │           Browser (React SPA)            │
                          └───────────────────┬─────────────────────┘
                                              │ HTTPS
                          ┌───────────────────▼─────────────────────┐
                          │   CloudFront CDN  ←→  S3 (static build) │
                          └───────────────────┬─────────────────────┘
                                              │
                          ┌───────────────────▼─────────────────────┐
                          │         API Gateway REST API             │
                          │  /expenses  /income  /savings  /budget   │
                          │  /summary                                │
                          └──┬──────┬────────┬──────────┬───────────┘
                             │      │        │          │
               ┌─────────────▼─┐ ┌──▼──┐ ┌──▼──┐ ┌────▼────┐ ┌────────┐
               │   expenses    │ │inco-│ │savi-│ │ budget  │ │summary │
               │    Lambda     │ │ me  │ │ ngs │ │ Lambda  │ │ Lambda │
               └───────┬───────┘ └──┬──┘ └──┬──┘ └────┬────┘ └────┬───┘
                       │            │        │          │           │
                       └────────────┴────────┴──────────┴───────────┘
                                              │
                          ┌───────────────────▼─────────────────────┐
                          │                DynamoDB                   │
                          │  transactions │ savings_goals │ budgets   │
                          └──────────────────────────────────────────┘

EventBridge Scheduler (weekly cron)
  └─► weekly-analyzer Lambda
        └─► SNS Topic: budget-alerts
              └─► alert-notifier Lambda
                    └─► SES ─► Email
```

---

## AWS Services

| Service | Role in this project |
|---|---|
| **AWS Lambda** | 7 independent functions — 5 HTTP handlers + 2 async pipeline stages |
| **Amazon DynamoDB** | NoSQL storage with `userId + transactionId` composite key; on-demand billing |
| **Amazon API Gateway** | REST API (Lambda proxy integration); single `prod` stage |
| **Amazon S3** | Static hosting for the Vite build output |
| **Amazon CloudFront** | Global CDN with Origin Access Control (OAC) — S3 bucket stays private |
| **Amazon SNS** | Decoupled pub/sub between the analyzer and the email notifier |
| **Amazon SES** | Transactional HTML + plain-text budget alert emails |
| **Amazon EventBridge Scheduler** | Weekly cron (`cron(0 8 ? * MON *)`) for the spending analyzer |

---

## Why Serverless?

This project was deliberately built serverless-first to explore and demonstrate the trade-offs of the model:

- **Zero idle cost** — Lambda and DynamoDB on-demand mode charge only for what you use. A personal finance tool has low, irregular traffic — a traditional EC2 instance would waste money sitting idle.
- **No server management** — no OS patches, no capacity planning, no uptime monitoring. The focus stays on application logic.
- **Event-driven by default** — the notification pipeline (EventBridge → SNS → SES) composes AWS services like building blocks, each doing one job and handing off to the next.
- **Honest trade-offs** — cold starts, CORS complexity, DynamoDB data modeling constraints, and Lambda packaging friction are all real. See [LESSONS_LEARNED.md](LESSONS_LEARNED.md) for the full picture.

---

## Project Structure

```
serverless-finance-tracker/
├── backend/
│   ├── shared/                    # Bundled into every Lambda ZIP
│   │   ├── response_helper.py     # CORS headers, JSON serialization
│   │   ├── dynamodb_client.py     # Boto3 singleton
│   │   └── constants.py           # Expense/income category lists
│   ├── expenses/handler.py        # CRUD for expenses
│   ├── income/handler.py          # CRUD for income
│   ├── savings/handler.py         # CRUD + deposit for savings goals
│   ├── budget/handler.py          # Category budget limits
│   ├── summary/handler.py         # Monthly aggregation
│   ├── weekly-analyzer/handler.py # EventBridge → SNS alert trigger
│   └── alert-notifier/handler.py  # SNS → SES email sender
├── frontend/
│   └── src/
│       ├── App.jsx                # Tab navigation shell
│       ├── services/api.js        # All API calls (single source of truth)
│       └── components/            # Dashboard, ExpenseForm, IncomeForm,
│                                  # SavingsGoals, BudgetSettings, MonthlySummary
└── docs/
    ├── setup-guide.md             # Step-by-step AWS Console deployment
    ├── api-documentation.md       # All endpoints with request/response schemas
    └── dynamodb-schema.md         # Table definitions and example items
```

---

## Key Technical Decisions

### Action-based POST dispatch (no DELETE/PUT in API Gateway)
All mutating operations (`create`, `update`, `delete`, `deposit`) go through a single `POST` endpoint with an `action` field in the JSON body, rather than using HTTP `DELETE`/`PUT` methods. This completely avoids browser CORS preflight complexity with API Gateway — a lesson learned the hard way. See [LESSONS_LEARNED.md](LESSONS_LEARNED.md#cors-and-api-gateway) for the full story.

### DynamoDB Decimal handling
DynamoDB's Python SDK uses `Decimal` for all numeric types to avoid float precision loss. Every handler writes `Decimal(str(amount))` and the shared `response_helper.py` provides a `_DecimalEncoder` that serializes `Decimal` → `float` for JSON responses.

### transactionId as sortable key
Transaction IDs are formatted as `{iso-timestamp}#{uuid4()}`, e.g. `2025-11-14T10:32:01.123456+00:00#a1b2c3...`. This makes them naturally sortable by creation time without a secondary index.

### No Lambda Layers
The `shared/` package is bundled into each function's ZIP at deploy time. This avoids Layer versioning complexity for a project of this scale, at the cost of slightly larger ZIPs.

---

## Local Development

**Prerequisites:** Node 18+, Python 3.12, AWS account

```bash
# Frontend dev server
cd frontend
npm install
```

Create `frontend/.env.local`:
```
VITE_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod
```

```bash
npm run dev
```

The app runs at `http://localhost:5173`. All API calls proxy to your deployed API Gateway.

---

## Deployment

All infrastructure is provisioned manually via the AWS Console — no IaC required for this project.

Follow the step-by-step guide: **[docs/setup-guide.md](docs/setup-guide.md)**

Estimated setup time: ~45 minutes for a first deployment.

---

## Documentation

| Document | Contents |
|---|---|
| [docs/setup-guide.md](docs/setup-guide.md) | Full 10-step AWS Console deployment walkthrough |
| [docs/api-documentation.md](docs/api-documentation.md) | All API endpoints, request/response schemas |
| [docs/dynamodb-schema.md](docs/dynamodb-schema.md) | DynamoDB table definitions and example items |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Component breakdown, data flow, security model |
| [LESSONS_LEARNED.md](LESSONS_LEARNED.md) | Real challenges encountered and how they were solved |
| [SECURITY.md](SECURITY.md) | Security model, IAM policy design, and hardening notes |

---

## Cost Estimate

For personal use (low traffic), this project runs at **effectively $0/month**:

| Service | Free Tier | Expected Usage |
|---|---|---|
| Lambda | 1M requests + 400K GB-s/month | ~100–200 requests/month |
| DynamoDB | 25 GB + 25 WCU/RCU (on-demand: pay per request) | < 1,000 requests/month |
| API Gateway | 1M REST calls/month | ~100–200 calls/month |
| S3 | 5 GB storage + 20K GET requests | < 1 MB, < 100 GET/month |
| CloudFront | 1 TB transfer + 10M requests/month | Minimal |
| SNS | 1M publishes/month | 4 publishes/month (weekly) |
| SES | 62,000 emails/month (if sent from EC2/Lambda) | 4 emails/month |
| EventBridge Scheduler | 14M invocations/month free | 4 invocations/month |

See [ARCHITECTURE.md#cost-model](ARCHITECTURE.md#cost-model) for a detailed breakdown.

---

## Security

- No credentials or ARNs in source code — all configuration via `os.environ` (backend) and `import.meta.env` (frontend)
- IAM roles follow least-privilege — each Lambda only accesses its own table(s)
- S3 bucket is private — CloudFront accesses it via Origin Access Control (OAC), not a public bucket policy
- CORS headers are set both in Lambda responses and in API Gateway's OPTIONS Mock integration

See [SECURITY.md](SECURITY.md) for the full security model.
