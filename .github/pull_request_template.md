## Description

<!-- What does this PR do and why? Link to an issue if relevant. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behavior change)
- [ ] Documentation update
- [ ] CI/CD change

## Layer(s) affected

- [ ] Frontend (`frontend/`)
- [ ] Backend — Lambda function(s): <!-- list which ones, e.g. expenses, shared -->
- [ ] Infrastructure / CI (`.github/workflows/`)
- [ ] Documentation only

## Checklist

- [ ] Tested locally before opening this PR
- [ ] No credentials, ARNs, or account IDs committed
- [ ] If backend: `handler.py` imports correctly with `shared/` present

## Deployment notes

<!-- Delete sections that don't apply -->

**Frontend:** CI will rebuild and deploy automatically on merge. No action needed.

**Backend:** CI will repackage and redeploy only the changed Lambda function(s) on merge.
Changed functions in this PR: <!-- list them or write "none" -->

**Manual steps required (if any):**
<!-- e.g. new environment variable added to Lambda, new DynamoDB table, API Gateway change -->
