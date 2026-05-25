# CI/CD on AWS — CodePipeline & CodeBuild Guide

This guide shows how to implement the same CI/CD pipelines that this project uses (via GitHub Actions) using **native AWS services**: CodePipeline, CodeBuild, and Amplify. Use this if you want to keep your deployment infrastructure entirely within AWS.

> **GitHub Actions vs AWS-native CI/CD:** Both approaches are valid. GitHub Actions is simpler to set up (no AWS Console configuration for the pipeline itself) and the workflows live in the repository. AWS-native CI/CD is better if you already use AWS heavily, need tighter IAM integration, or want everything billed and monitored in one place.

---

## Comparison

| | GitHub Actions | AWS CodePipeline + CodeBuild |
|---|---|---|
| Config location | `.github/workflows/*.yml` in repo | AWS Console / CloudFormation |
| Cost | Free for public repos; 2,000 min/month free for private | CodeBuild: first 100 min/month free; CodePipeline: $1/pipeline/month |
| AWS credential storage | GitHub Secrets | IAM Role (no static credentials needed) |
| Visibility | GitHub Actions tab | AWS Console → CodePipeline |
| Best for | Any GitHub project | Projects fully within AWS ecosystem |

---

## Option A — AWS Amplify (Easiest for Frontend)

AWS Amplify Hosting is the fastest way to add CI/CD for a static frontend from GitHub. It handles the build, S3 upload, and CDN invalidation automatically.

### Steps

1. Go to **AWS Amplify → New app → Host web app**.
2. Select **GitHub** as the source provider and authorize Amplify.
3. Select your repository and `main` branch.
4. Amplify will auto-detect the Vite app. Confirm the build settings:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - cd frontend && npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: frontend/dist
       files:
         - "**/*"
     cache:
       paths:
         - frontend/node_modules/**/*
   ```
5. Under **Environment variables**, add:
   - `VITE_API_URL` = your API Gateway invoke URL
6. Click **Save and deploy**.

From now on, every push to `main` triggers an automatic build and deploy. Amplify also gives you a free `*.amplifyapp.com` URL with HTTPS.

**Trade-off vs GitHub Actions:** Amplify manages its own CDN (not your existing CloudFront distribution). If you need the same CloudFront distribution (e.g., for a custom domain already set up), use CodePipeline instead.

---

## Option B — CodePipeline + CodeBuild (Full Control)

This replicates the GitHub Actions approach using native AWS services.

### Architecture

```
GitHub Push
  └─► CodePipeline (Source stage: CodeStar Connection)
        └─► CodeBuild (Build stage: npm ci + npm run build)
              └─► S3 Deploy (Deploy stage: sync dist/ to bucket)
                    └─► Lambda (post-deploy: CloudFront invalidation)
```

---

### Step 1 — Create a CodeStar Connection to GitHub

1. Go to **CodePipeline → Settings → Connections → Create connection**.
2. Select **GitHub** as the provider, name it `github-finance-tracker`.
3. Click **Connect to GitHub** and authorize the AWS Connector for GitHub app.
4. Note the **Connection ARN** — you'll need it for the pipeline.

---

### Step 2 — Create the CodeBuild Project (Frontend)

1. Go to **CodeBuild → Create build project**.
2. **Project name:** `finance-tracker-frontend-build`
3. **Source:** No source (CodePipeline will provide it).
4. **Environment:**
   - Managed image: **Amazon Linux 2023**
   - Runtime: **Standard**
   - Image: latest
   - Service role: Create a new role (name it `finance-tracker-codebuild-role`)
5. **Buildspec:** Insert buildspec content (see below).
6. **Environment variables** (add these):
   - `VITE_API_URL` — your API Gateway invoke URL
   - `S3_BUCKET_NAME` — your frontend S3 bucket name
   - `CLOUDFRONT_DISTRIBUTION_ID` — your CloudFront distribution ID

**Buildspec (`buildspec.yml` or inline):**
```yaml
version: 0.2

phases:
  install:
    runtime-versions:
      nodejs: 20
    commands:
      - cd frontend && npm ci

  build:
    commands:
      - npm run build

  post_build:
    commands:
      # Upload hashed assets with long-lived cache
      - |
        aws s3 sync frontend/dist/ s3://$S3_BUCKET_NAME \
          --delete \
          --exclude "index.html" \
          --cache-control "public,max-age=31536000,immutable"

      # Upload index.html with no-cache (always fetch fresh)
      - |
        aws s3 cp frontend/dist/index.html \
          s3://$S3_BUCKET_NAME/index.html \
          --cache-control "no-cache,no-store,must-revalidate" \
          --content-type "text/html"

      # Invalidate CloudFront so users see the new version immediately
      - |
        aws cloudfront create-invalidation \
          --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
          --paths "/*"

artifacts:
  files:
    - "**/*"
  base-directory: frontend/dist
```

---

### Step 3 — IAM Permissions for CodeBuild

The CodeBuild service role needs permissions to access S3 and CloudFront. Add this inline policy to `finance-tracker-codebuild-role`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR-BUCKET-NAME",
        "arn:aws:s3:::YOUR-BUCKET-NAME/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::YOUR-ACCOUNT-ID:distribution/YOUR-DISTRIBUTION-ID"
    }
  ]
}
```

---

### Step 4 — Create the CodePipeline

1. Go to **CodePipeline → Create pipeline**.
2. **Pipeline name:** `finance-tracker-frontend`
3. **Service role:** Create new role.

**Source stage:**
- Provider: **GitHub (via GitHub App)** — use the CodeStar Connection from Step 1
- Repository: `tsofroni/serverless-finance-tracker`
- Branch: `main`
- Change detection: **GitHub webhooks** (recommended over polling)
- Output artifact: `SourceArtifact`

**Build stage:**
- Provider: **AWS CodeBuild**
- Project: `finance-tracker-frontend-build`
- Input: `SourceArtifact`

**Deploy stage:** Skip (CodeBuild handles the S3 sync directly in its `post_build` phase).

4. Review and click **Create pipeline**.

The pipeline now triggers automatically on every push to `main`.

---

### Step 5 — Add Path Filtering (Optional)

CodePipeline doesn't natively support path-based triggers (unlike GitHub Actions `paths:` filter). The pipeline will run on every push to `main`, regardless of which files changed.

**Workaround using EventBridge:**
1. Create an EventBridge rule that listens to CodeStar connection events.
2. Add a condition filter on `detail.changes` to check if any `frontend/**` path was modified.
3. Only invoke the pipeline if the filter matches.

This is complex to set up. For most projects, running the pipeline on every push is acceptable — a full frontend build takes ~60 seconds and costs fractions of a cent.

---

## Option C — Lambda CI/CD with CodeBuild

The same approach works for Lambda deployments. Create a separate CodeBuild project for each Lambda, or one project that deploys all of them.

### Single CodeBuild Project (Deploy All Lambdas)

**Buildspec:**
```yaml
version: 0.2

phases:
  install:
    commands:
      - apt-get install -y zip

  build:
    commands:
      - |
        deploy_lambda() {
          local func_dir="$1"
          local lambda_name="$2"

          echo "Packaging $lambda_name..."
          local pkg_dir=$(mktemp -d)
          cp "$func_dir/handler.py" "$pkg_dir/"
          cp -r backend/shared "$pkg_dir/"
          (cd "$pkg_dir" && zip -qr "/tmp/${lambda_name}.zip" .)
          rm -rf "$pkg_dir"

          echo "Deploying $lambda_name..."
          aws lambda update-function-code \
            --function-name "$lambda_name" \
            --zip-file "fileb:///tmp/${lambda_name}.zip" \
            --output text --query 'FunctionName'
        }

        deploy_lambda backend/expenses        finance-tracker-expenses
        deploy_lambda backend/income          finance-tracker-income
        deploy_lambda backend/savings         finance-tracker-savings
        deploy_lambda backend/budget          finance-tracker-budget
        deploy_lambda backend/summary         finance-tracker-summary
        deploy_lambda backend/weekly-analyzer finance-tracker-weekly-analyzer
        deploy_lambda backend/alert-notifier  finance-tracker-alert-notifier
```

**Required IAM permission for CodeBuild role:**
```json
{
  "Effect": "Allow",
  "Action": "lambda:UpdateFunctionCode",
  "Resource": "arn:aws:lambda:REGION:ACCOUNT_ID:function:finance-tracker-*"
}
```

---

## IAM User for GitHub Actions

If you use the GitHub Actions approach, you need an IAM user with static credentials that GitHub stores as repository secrets.

### Create the IAM User

1. Go to **IAM → Users → Create user**.
2. Name: `github-actions-finance-tracker`
3. Select **Programmatic access** only (no Console access).
4. Attach this inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Frontend",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR-BUCKET-NAME",
        "arn:aws:s3:::YOUR-BUCKET-NAME/*"
      ]
    },
    {
      "Sid": "CloudFrontInvalidation",
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::YOUR-ACCOUNT-ID:distribution/YOUR-DISTRIBUTION-ID"
    },
    {
      "Sid": "LambdaDeploy",
      "Effect": "Allow",
      "Action": "lambda:UpdateFunctionCode",
      "Resource": "arn:aws:lambda:YOUR-REGION:YOUR-ACCOUNT-ID:function:finance-tracker-*"
    }
  ]
}
```

5. After creation, generate an **Access key** (type: Application running outside AWS).
6. Save the **Access Key ID** and **Secret Access Key** — you'll need them for GitHub Secrets.

### Add GitHub Secrets

Go to your GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret Name | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | From the IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | From the IAM user secret key |
| `AWS_REGION` | e.g., `eu-central-1` |
| `S3_BUCKET_NAME` | Your frontend S3 bucket name |
| `CLOUDFRONT_DISTRIBUTION_ID` | From CloudFront console (e.g., `E1ABCD2EFGH3IJ`) |
| `VITE_API_URL` | Your API Gateway invoke URL + `/prod` |

Once all secrets are set, push any change to `frontend/` and the workflow runs automatically.

---

## Summary

| Method | Best for | Effort |
|---|---|---|
| **AWS Amplify** | Quickest frontend CI/CD, don't need existing CloudFront | Low |
| **GitHub Actions** (this project) | GitHub-first workflow, path-based triggers, free | Low–Medium |
| **CodePipeline + CodeBuild** | AWS-native, no GitHub credentials in AWS | Medium |
| **CodeBuild only** | Triggered manually or by EventBridge, no pipeline overhead | Medium |
