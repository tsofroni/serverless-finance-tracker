# Contributing

Thanks for your interest in contributing. This document covers how to set up the project locally, make changes, and open a pull request.

---

## Prerequisites

- Node.js 20+
- Python 3.12
- AWS CLI configured (`aws configure`) — needed only if you want to test against a live AWS deployment
- A deployed instance of the backend (see [docs/setup-guide.md](docs/setup-guide.md)) or a `.env.local` pointing to someone else's API

---

## Local Development

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```
VITE_API_URL=https://<your-api-id>.execute-api.<region>.amazonaws.com/prod
```

Start the dev server:
```bash
npm run dev
```

The app runs at `http://localhost:5173` and hot-reloads on save. All API calls go to your deployed API Gateway — there is no local backend emulator.

### Backend

Lambda handlers have no local server to run. To validate a handler without deploying:

```bash
cd backend/expenses
# Copy shared/ into the function directory (mirrors what the ZIP contains)
cp -r ../shared .
python -c "import handler; print('Import OK')"
rm -rf shared
```

To invoke a handler with a mock event:
```python
# test_local.py (don't commit this)
import json, sys
sys.path.insert(0, "backend/shared")
import handler

event = {
    "httpMethod": "GET",
    "body": None,
    "queryStringParameters": None,
}
result = handler.handler(event, {})
print(json.dumps(json.loads(result["body"]), indent=2))
```

---

## Project Structure

```
backend/
  shared/          # Bundled into every Lambda ZIP — shared utilities
  expenses/        # One handler.py per Lambda function
  income/
  savings/
  budget/
  summary/
  weekly-analyzer/
  alert-notifier/
frontend/
  src/
    constants/     # Category icons and lists
    context/       # React context (Toast)
    components/    # One .jsx + .module.css per component
    services/      # api.js — single source of truth for all API calls
.github/
  workflows/       # GitHub Actions: deploy-frontend.yml, deploy-backend.yml
docs/              # Setup guide, API docs, CI/CD guide, DynamoDB schema
```

---

## Making Changes

### Frontend changes
Edit files under `frontend/src/`. The dev server hot-reloads. When pushed to `main`, the CI workflow rebuilds and deploys to S3+CloudFront automatically.

### Backend changes
Edit `backend/<function>/handler.py` or files in `backend/shared/`. When pushed to `main`, the CI workflow detects which functions changed (including any that depend on `shared/`) and redeploys only those.

> A change to `backend/shared/` triggers a redeploy of all 7 Lambda functions because `shared/` is bundled into every ZIP.

### Adding a new expense/income category
1. Add the category string and emoji to `frontend/src/constants/categories.js`
2. Add the same string to `EXPENSE_CATEGORIES` or `INCOME_CATEGORIES` in `backend/shared/constants.py`
3. If it needs a budget limit, it will appear automatically in Budget Settings (the frontend reads from the constant list)

### Adding a new Lambda function
1. Create `backend/<name>/handler.py` — import from `shared/response_helper` and `shared/dynamodb_client`
2. Add a resource and method in API Gateway and deploy to `prod`
3. Add the function to the `deploy_function` list in `.github/workflows/deploy-backend.yml`
4. Add a path filter for it in the `detect-changes` job

---

## Branch Naming

| Type | Pattern | Example |
|---|---|---|
| Feature | `feat/<short-description>` | `feat/export-pdf` |
| Bug fix | `fix/<short-description>` | `fix/savings-deposit-nan` |
| Documentation | `docs/<short-description>` | `docs/update-setup-guide` |
| Chore | `chore/<short-description>` | `chore/bump-node-version` |

---

## Opening a Pull Request

1. Push your branch to GitHub
2. Open a PR against `main` — the PR template will guide you through the checklist
3. The CI workflows run automatically on the PR branch (dry-run: the build runs but deploy only triggers on merge to `main`)
4. Once the build passes and you've verified the checklist, merge

---

## Security

- Never commit `.env`, `.env.local`, AWS credentials, ARNs, or account IDs
- All sensitive values belong in environment variables (`os.environ` for Lambda, GitHub Secrets for CI)
- The `.gitignore` already excludes `.env*` and `.aws/`

See [SECURITY.md](SECURITY.md) for the full security model.
