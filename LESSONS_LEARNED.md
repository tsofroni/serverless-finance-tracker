# Lessons Learned

This document captures the real technical challenges encountered while building this project — the non-obvious gotchas, wrong assumptions, and the reasoning behind decisions that might otherwise look arbitrary in the code.

These are the things tutorials don't warn you about.

---

## 1. CORS and API Gateway — The Preflight Trap

**The problem:** Browser CORS preflight (`OPTIONS`) requests failed for `DELETE` and `PUT` methods even after enabling CORS in the API Gateway console.

**What happened:** When you click "Enable CORS" in the API Gateway console, it creates an `OPTIONS` method on each resource with a Mock Integration that returns the required headers. The issue is that the auto-generated `Access-Control-Allow-Methods` header in that mock response only includes the methods that existed *at the time CORS was enabled*. If you add `DELETE` or `PUT` later, the OPTIONS response does not update automatically — and re-running "Enable CORS" from the console doesn't always fix it either.

The browser sends a preflight `OPTIONS` request before the actual `DELETE`. If the OPTIONS response doesn't list `DELETE` in `Allow-Methods`, the browser blocks the request before it even reaches Lambda. The error in the browser console reads `Failed to fetch` — not "CORS error", making it hard to diagnose.

**The fix:** Abandon `DELETE`/`PUT` HTTP methods entirely. All mutating operations (`create`, `update`, `delete`, `deposit`) now use `POST` with an `action` field in the JSON body:

```json
{ "action": "delete", "transactionId": "..." }
{ "action": "update", "transactionId": "...", "amount": 42 }
```

`POST` already worked without preflight issues. This approach is battle-tested (Stripe and other major APIs use action-based dispatch), and it means the API Gateway setup only needs GET and POST methods — far less CORS surface area.

**Takeaway:** When debugging CORS in API Gateway, inspect the *OPTIONS response payload* directly in the API Gateway console, not just the method configuration. And when possible, design APIs to avoid non-GET methods that trigger preflights.

---

## 2. DynamoDB Reserved Words in Update Expressions

**The problem:** `update_item` calls for expenses and income raised `ClientError: Invalid UpdateExpression: Attribute name is a reserved word; reserved word: date`.

**What happened:** DynamoDB has a [list of reserved words](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html) that cannot be used directly in expressions. `date`, `name`, `status`, `type`, `value`, `month`, and `year` are all reserved. The `date` field used to store transaction dates, and the `name` field on savings goals, both hit this.

**The fix:** Use `ExpressionAttributeNames` to alias the reserved words:

```python
_get_table().update_item(
    Key={"userId": USER_ID, "transactionId": transaction_id},
    UpdateExpression="SET amount = :amt, #dt = :date",
    ExpressionAttributeNames={"#dt": "date"},
    ExpressionAttributeValues={":amt": Decimal("42"), ":date": "2025-11-14"},
)
```

**Takeaway:** Scan your attribute names against the DynamoDB reserved word list before finalizing your schema. It's easier to rename `date` to `txDate` upfront than to alias it everywhere.

---

## 3. DynamoDB Decimal vs Python float

**The problem:** `boto3` raises `TypeError: Float types are not supported. Use Decimal types instead` when writing floating-point numbers to DynamoDB.

**Why this happens:** DynamoDB's Python SDK enforces `Decimal` for all numeric types to preserve precision. Python's `float` type cannot represent decimal fractions exactly (e.g., `0.1 + 0.2 != 0.3`), which would silently corrupt financial data.

**The fix — write path:** Convert every numeric input to `Decimal(str(amount))`. The `str()` conversion preserves the decimal representation before `Decimal` parses it. `Decimal(0.1)` gives `Decimal('0.1000000000000000055511...')` — the float's actual binary value. `Decimal(str(0.1))` gives `Decimal('0.1')`.

**The fix — read path:** DynamoDB returns `Decimal` objects in query results. `json.dumps()` doesn't know how to serialize `Decimal`, so every response would crash with `TypeError: Object of type Decimal is not JSON serializable`. The shared `response_helper.py` provides a custom `JSONEncoder`:

```python
class _DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)
```

**Takeaway:** Always use `Decimal(str(value))` for DynamoDB writes and a custom encoder for reads. Consider centralizing this in a shared module from day one.

---

## 4. Lambda Proxy Integration — The Response Contract

**The problem:** Early Lambda responses returned Python dicts directly. API Gateway returned `502 Bad Gateway` with the message `Malformed Lambda proxy response`.

**What happened:** With Lambda Proxy Integration enabled in API Gateway, the Lambda function must return a specific response shape. API Gateway does not convert the response — it passes it through as-is, expecting exactly:

```python
{
    "statusCode": 200,
    "headers": {"Content-Type": "application/json", ...},
    "body": '{"key": "value"}'  # must be a STRING, not a dict
}
```

Note that `body` must be a JSON-encoded **string**, not a Python dict. A common mistake is returning `"body": {"key": "value"}` (a dict), which causes the `502`.

**The fix:** The shared `response_helper.py` centralizes the response contract:

```python
def success(data, status_code=200):
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(data, cls=_DecimalEncoder),
    }
```

**Takeaway:** Use a shared response helper from the start. The `statusCode`/`headers`/`body` contract is easy to get wrong once — and having to fix it across seven handlers is annoying.

---

## 5. EventBridge Scheduler vs EventBridge Rules

**The problem:** Searching for "EventBridge cron" in the AWS console leads to two different places: *EventBridge → Buses → Rules* and *EventBridge → Scheduler*. They are separate services with different pricing and features.

**The difference:**
- **EventBridge Rules** — triggers based on events on an event bus (e.g., "when an S3 object is uploaded"). Also supports scheduled rules, but the scheduler is not the primary use case.
- **EventBridge Scheduler** — purpose-built for scheduled invocations. Supports one-time, rate-based, and cron-based schedules. Can invoke Lambda, SQS, Step Functions, and 200+ other targets directly. Has its own IAM execution role.

For this project, EventBridge Scheduler is the right tool — it's a dedicated cron that fires Lambda on a weekly schedule, with no event bus involved.

**Takeaway:** When you need a cron job, go to **EventBridge → Scheduler**, not EventBridge Rules.

---

## 6. SES Sandbox Restrictions

**The problem:** The `alert-notifier` Lambda returned `MessageRejected: Email address is not verified` even though the sender email was verified.

**What happened:** New AWS accounts start with SES in **sandbox mode**. In sandbox mode, you can only send emails *to* verified addresses — not just *from* them. Any unverified recipient address is rejected.

**The fix:** Verify both the sender and recipient email addresses in SES, or submit a production access request to exit the sandbox.

**Takeaway:** Plan for SES sandbox restrictions early in development. For a personal tool, verifying both addresses is fine. For a production app serving real users, the SES production access request should be part of the launch checklist.

---

## 7. Frontend Build-Time Environment Variables

**The problem:** The React app made API calls to `undefinedundefined/expenses` — the base URL was literally `"undefined"`.

**What happened:** Vite injects environment variables at *build time*, not runtime. Variables must be prefixed with `VITE_` to be exposed to client-side code. A variable named `API_URL` (no `VITE_` prefix) is silently undefined in the bundle — Vite strips it for security reasons.

Additionally, `import.meta.env.VITE_API_URL` is replaced with its literal value during the build. If you build the app and then change the `.env` file, the change has no effect — you must rebuild.

**The fix:**
- Use `VITE_API_URL` as the variable name.
- Add a `isApiConfigured()` check in `api.js` that reads `import.meta.env.VITE_API_URL`, and show a warning banner in the app when it's missing — this makes the misconfiguration visible immediately instead of surfacing as cryptic network errors.

**Takeaway:** Understand the distinction between build-time and runtime environment variables. Vite's `.env` handling is well-documented but easy to get wrong on first use.

---

## 8. API Gateway Changes Require a Re-Deployment

**The problem:** CORS changes and new methods added in the API Gateway console had no effect in the browser.

**What happened:** API Gateway has a concept of *stages* (e.g., `prod`). Changes made to resources, methods, and integrations are staged — they exist in the console but are not live until you explicitly deploy to the stage. Enabling CORS, adding a method, or changing an integration all require a manual "Deploy API" action afterward.

**The fix:** After any API Gateway change, go to **Actions → Deploy API → prod stage** and confirm. The URL does not change between deployments.

**Takeaway:** Every API Gateway change is a two-step process: make the change, then deploy. Build this into muscle memory.

---

## 9. CloudFront OAC vs OAI

**The problem:** The older guides and Stack Overflow answers reference **Origin Access Identity (OAI)** for securing S3 origins. The current AWS console uses **Origin Access Control (OAC)** instead.

**The difference:** OAC is the successor to OAI. It supports all S3 regions, works with SSE-KMS encrypted buckets, and uses a signing protocol that AWS considers more secure. OAI is still functional but is considered legacy.

**Practical impact:** When creating a CloudFront distribution with an S3 origin, the console now prompts you to create an OAC. After creation, CloudFront shows you the S3 bucket policy to copy — do this before hitting save, or you'll need to find it again later.

**Takeaway:** Use OAC. Ignore guides that tell you to enable public S3 access — that's the wrong approach for production distributions.

---

## 10. Vite `npm run build` Requires the API URL at Build Time

**The problem:** After deploying the CloudFront distribution, the app loaded but all API calls returned network errors. The URL being called was the one from when the frontend was first built — before the CloudFront URL was known.

**What happened:** The workflow has a chicken-and-egg ordering issue:
1. You need the API Gateway invoke URL to build the frontend.
2. You need the frontend build to upload to S3.
3. You need S3 contents to create the CloudFront distribution.
4. You need the CloudFront domain to optionally restrict CORS.

The practical solution: build the frontend with the API Gateway URL, deploy to S3, create CloudFront. If you later want to restrict CORS to the CloudFront domain, rebuild and redeploy. For a personal tool with `Access-Control-Allow-Origin: *`, this is a non-issue.

**Takeaway:** For serverless frontends, document the build-then-deploy order explicitly. In a CI/CD pipeline, the API URL would be an output of the infrastructure stage, automatically injected as an environment variable into the build stage.

---

## Summary Table

| # | Challenge | Category | Lesson |
|---|---|---|---|
| 1 | CORS preflight failures for DELETE/PUT | API Gateway | Use POST+action; inspect OPTIONS payload directly |
| 2 | DynamoDB reserved words in expressions | DynamoDB | Alias reserved words with ExpressionAttributeNames |
| 3 | Decimal vs float for monetary values | DynamoDB / Python | Always `Decimal(str(x))`; use custom JSONEncoder |
| 4 | Lambda Proxy Integration response format | Lambda | body must be a JSON string; use shared response helper |
| 5 | EventBridge Scheduler vs Rules | EventBridge | Scheduler = cron jobs; Rules = event-based |
| 6 | SES sandbox recipient restriction | SES | Verify both sender AND recipient; plan for production access |
| 7 | Vite VITE_ prefix for env vars | Vite / React | Build-time injection; missing prefix = silent undefined |
| 8 | API Gateway changes need re-deployment | API Gateway | Every change → Deploy API → stage |
| 9 | OAC replaces OAI for S3 origins | CloudFront | Use OAC; ignore OAI guides |
| 10 | Build-time API URL dependency | Deployment | Document the build-deploy order; API URL → build → S3 → CF |
