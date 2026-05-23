# Serverless Finance Tracker

A cloud-native personal finance tracker built entirely on AWS serverless infrastructure. Track income and expenses, manage savings goals, configure category budgets, and receive automated weekly spending alerts via email — without managing a single server.

This project is built as an AWS portfolio project demonstrating Lambda, DynamoDB, API Gateway, SNS, SES, EventBridge Scheduler, S3, and CloudFront.

## Architecture

```
React (S3+CloudFront) → API Gateway → Lambda Functions → DynamoDB
                                                    ↓
                              EventBridge Scheduler → Lambda (Analyzer)
                                                    ↓
                                               SNS → SES → E-Mail
```

## AWS Services

| Service | Purpose |
|---|---|
| **AWS Lambda** | Serverless backend logic (7 functions) |
| **Amazon DynamoDB** | NoSQL storage for transactions, savings goals, and budgets |
| **Amazon API Gateway** | REST API routing to Lambda functions |
| **Amazon S3** | Static hosting for the React build |
| **Amazon CloudFront** | Global CDN for frontend delivery |
| **Amazon SNS** | Message broker for budget alert events |
| **Amazon SES** | Transactional email for budget alerts |
| **Amazon EventBridge Scheduler** | Weekly cron trigger for the spending analyzer |

## Local Development (Frontend)

```bash
cd frontend
npm install
```

Create `.env.local` in the `frontend/` directory:

```
VITE_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod
```

Start the development server:

```bash
npm run dev
```

## Deployment

All AWS infrastructure is set up manually via the AWS Console. Follow the step-by-step guide: [docs/setup-guide.md](docs/setup-guide.md)

> **Note:** Infrastructure is provisioned manually — no IaC tooling required. Each Lambda function is deployed as an independent ZIP package containing the handler and the `shared/` directory.
