# Security Model

This document describes the security design decisions in this project — what protections are in place, what trade-offs were made, and what would need to change for a production multi-user deployment.

---

## Credentials and Secrets

**Rule: no credentials in source code.**

| Layer | Mechanism |
|---|---|
| Backend (Lambda) | All sensitive values via `os.environ` — table names, SNS ARN, SES addresses |
| Frontend (Vite) | API base URL via `import.meta.env.VITE_API_URL`, injected at build time |
| `.gitignore` | `.env`, `.env.local`, `.aws/`, `*.zip` — never committed |

No ARNs, account IDs, API keys, or region-specific identifiers appear in the codebase.

---

## IAM — Least Privilege

A single IAM role (`finance-tracker-lambda-role`) is used for all Lambda functions. This is a pragmatic simplification for a single-user project. The permissions granted:

### DynamoDB

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:PutItem",
    "dynamodb:GetItem",
    "dynamodb:UpdateItem",
    "dynamodb:DeleteItem",
    "dynamodb:Query"
  ],
  "Resource": [
    "arn:aws:dynamodb:<region>:<account-id>:table/finance-tracker-transactions",
    "arn:aws:dynamodb:<region>:<account-id>:table/finance-tracker-savings",
    "arn:aws:dynamodb:<region>:<account-id>:table/finance-tracker-budgets"
  ]
}
```

Note: `dynamodb:Scan` is intentionally omitted. All queries use `Query` with a `userId` partition key — full table scans are never needed.

### SNS (weekly-analyzer only)

```json
{
  "Effect": "Allow",
  "Action": "sns:Publish",
  "Resource": "arn:aws:sns:<region>:<account-id>:finance-tracker-budget-alerts"
}
```

### SES (alert-notifier only)

```json
{
  "Effect": "Allow",
  "Action": "ses:SendEmail",
  "Resource": "*"
}
```

The `Resource: *` for SES is a current simplification. In a hardened setup, this would be restricted to specific verified SES identity ARNs.

---

## API Gateway

- **No authentication** — the API is unauthenticated by design. This is a single-user personal tool deployed under a private CloudFront distribution. No API keys, JWT, or Cognito are used.
- **CORS headers** — `Access-Control-Allow-Origin: *` is set in both the Lambda response headers and the API Gateway OPTIONS Mock integration. For stricter deployments, replace `*` with the specific CloudFront domain.
- **HTTPS only** — API Gateway enforces HTTPS on all invoke URLs.

---

## S3 and CloudFront

- The S3 bucket has **all public access blocked**. There is no public bucket policy.
- CloudFront accesses S3 via **Origin Access Control (OAC)** — a signed request mechanism that proves the request originates from the CloudFront distribution. The S3 bucket policy explicitly allows only the specific OAC.
- The frontend JavaScript bundle does not contain any secrets. `VITE_API_URL` is not sensitive — it's a public API Gateway invoke URL already exposed in browser network requests.

---

## DynamoDB Data Isolation

All items in every DynamoDB table include a `userId` partition key (`"user#001"`). This is currently hardcoded — there is only one user and no authentication layer.

In a multi-user scenario, this key would be derived from the authenticated user's identity (e.g., a Cognito sub), and each Lambda would validate the token and use the verified sub as the partition key. The data model is already structured to support this — no schema changes would be needed, only authentication middleware.

---

## What Would Need to Change for Multi-User Production

| Concern | Current state | Production approach |
|---|---|---|
| Authentication | None — single user | Amazon Cognito User Pool + API Gateway Cognito Authorizer |
| userId | Hardcoded `"user#001"` | Derived from JWT `sub` claim |
| CORS | `Allow-Origin: *` | Restrict to specific frontend domain |
| SES Resource | `*` | Restrict to verified identity ARNs |
| IAM Role | Shared across all Lambdas | Separate role per function, minimum permissions |
| DynamoDB | On-demand | Evaluate provisioned capacity for predictable workloads |
| API rate limiting | None | API Gateway usage plans + throttling |

---

## Dependency Security

The frontend has minimal dependencies: React 18, Vite 5, and `@vitejs/plugin-react`. No third-party UI libraries, charting libraries, or auth SDKs are used — this minimizes the npm supply chain attack surface.

The backend has zero third-party Python dependencies beyond `boto3` (AWS SDK, pre-installed in Lambda runtime) and the Python standard library.
