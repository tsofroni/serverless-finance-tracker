# DynamoDB Schema

## Table: `transactions`

Stores both expenses and income as a single table with a `type` discriminator.

| Attribute | Type | Key | Description |
|---|---|---|---|
| `userId` | String | PK | User identifier — hardcoded `user#001` |
| `transactionId` | String | SK | `{ISO-timestamp}#{uuid4}` — sortable by insert time |
| `type` | String | — | `"expense"` or `"income"` |
| `amount` | Number | — | Transaction amount |
| `category` | String | — | Category (see below) |
| `description` | String | — | Optional free-text note |
| `date` | String | — | `YYYY-MM-DD` — used for month filtering |

**Billing mode:** On-demand (PAY_PER_REQUEST)

**Example item — expense:**
```json
{
  "userId": "user#001",
  "transactionId": "2026-05-23T08:15:30.123456+00:00#550e8400-e29b-41d4-a716-446655440000",
  "type": "expense",
  "amount": 42.50,
  "category": "food",
  "description": "Grocery run",
  "date": "2026-05-23"
}
```

**Example item — income:**
```json
{
  "userId": "user#001",
  "transactionId": "2026-05-01T06:00:00.000000+00:00#7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "type": "income",
  "amount": 3000.00,
  "category": "salary",
  "description": "May salary",
  "date": "2026-05-01"
}
```

---

## Table: `savings_goals`

| Attribute | Type | Key | Description |
|---|---|---|---|
| `userId` | String | PK | User identifier |
| `goalId` | String | SK | UUID v4 |
| `name` | String | — | Human-readable goal name |
| `targetAmount` | Number | — | Savings target |
| `currentAmount` | Number | — | Amount saved so far (starts at 0) |
| `deadline` | String | — | `YYYY-MM-DD` target date |

**Billing mode:** On-demand (PAY_PER_REQUEST)

**Example item:**
```json
{
  "userId": "user#001",
  "goalId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Emergency Fund",
  "targetAmount": 5000.00,
  "currentAmount": 1200.00,
  "deadline": "2026-12-31"
}
```

---

## Table: `budgets`

| Attribute | Type | Key | Description |
|---|---|---|---|
| `userId` | String | PK | User identifier |
| `category` | String | SK | Expense category (used as the natural key) |
| `monthlyLimit` | Number | — | Maximum monthly spend for this category |
| `alertThreshold` | Number | — | Alert trigger as a fraction, e.g. `0.8` = 80% |

**Billing mode:** On-demand (PAY_PER_REQUEST)

**Example item:**
```json
{
  "userId": "user#001",
  "category": "food",
  "monthlyLimit": 400.00,
  "alertThreshold": 0.80
}
```

---

## Notes

- All monetary values are stored as DynamoDB `Number`, retrieved as Python `Decimal`, and serialized to JSON as `float`.
- The `transactions` table uses a composite SK (`{timestamp}#{uuid}`) so items are naturally ordered by insertion time within a user's partition.
- Month-range filtering on `transactions` uses `FilterExpression=Attr('date').begins_with('YYYY-MM')` — no GSI required.
- The `budgets` table uses `category` as the SK, which acts as a natural unique key per category per user — upserts via `put_item` are safe.
