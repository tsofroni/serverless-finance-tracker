# API Documentation

Base URL: `https://<api-id>.execute-api.<region>.amazonaws.com/prod`

All endpoints return JSON. All responses include CORS headers (`Access-Control-Allow-Origin: *`).

---

## Expenses

### POST /expenses

Create a new expense.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `amount` | number | yes | Expense amount (positive) |
| `category` | string | yes | One of the expense categories |
| `description` | string | no | Free-text note |
| `date` | string | yes | ISO 8601 date (`YYYY-MM-DD`) |

**Response `201`**

```json
{
  "message": "Expense created",
  "transactionId": "2026-05-23T08:00:00.000000+00:00#550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses**

| Code | Reason |
|---|---|
| `400` | Missing required fields |
| `500` | Internal error |

---

### GET /expenses

Retrieve all expenses for the user.

**Response `200`**

```json
{
  "expenses": [
    {
      "userId": "user#001",
      "transactionId": "2026-05-23T08:00:00.000000+00:00#...",
      "type": "expense",
      "amount": 42.5,
      "category": "food",
      "description": "Grocery run",
      "date": "2026-05-23"
    }
  ]
}
```

---

### DELETE /expenses/{transactionId}

Delete an expense by its ID.

| Path Parameter | Description |
|---|---|
| `transactionId` | The full transactionId string (URL-encoded) |

**Response `200`**

```json
{ "message": "Expense deleted" }
```

**Error Responses**

| Code | Reason |
|---|---|
| `400` | Missing transactionId |
| `500` | Internal error |

---

## Income

### POST /income

Create a new income record.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `amount` | number | yes | Income amount (positive) |
| `category` | string | yes | One of the income categories |
| `description` | string | no | Free-text note |
| `date` | string | yes | ISO 8601 date (`YYYY-MM-DD`) |

**Response `201`**

```json
{
  "message": "Income created",
  "transactionId": "2026-05-23T08:00:00.000000+00:00#..."
}
```

---

### GET /income

Retrieve all income records for the user.

**Response `200`**

```json
{
  "income": [
    {
      "userId": "user#001",
      "transactionId": "2026-05-23T08:00:00.000000+00:00#...",
      "type": "income",
      "amount": 3000.0,
      "category": "salary",
      "description": "May salary",
      "date": "2026-05-01"
    }
  ]
}
```

---

### DELETE /income/{transactionId}

Delete an income record by its ID.

**Response `200`**

```json
{ "message": "Income deleted" }
```

---

## Savings Goals

### POST /savings

Create a new savings goal.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Goal name |
| `targetAmount` | number | yes | Target amount to save |
| `deadline` | string | yes | ISO 8601 date (`YYYY-MM-DD`) |

**Response `201`**

```json
{
  "message": "Savings goal created",
  "goalId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### GET /savings

Retrieve all savings goals.

**Response `200`**

```json
{
  "goals": [
    {
      "userId": "user#001",
      "goalId": "550e8400-...",
      "name": "Emergency Fund",
      "targetAmount": 5000.0,
      "currentAmount": 1200.0,
      "deadline": "2026-12-31"
    }
  ]
}
```

---

### PUT /savings/{goalId}

Add a deposit to a savings goal (increments `currentAmount`).

| Path Parameter | Description |
|---|---|
| `goalId` | UUID of the goal |

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `amount` | number | yes | Amount to deposit (added to currentAmount) |

**Response `200`**

```json
{ "message": "Savings goal updated" }
```

---

### DELETE /savings/{goalId}

Delete a savings goal.

**Response `200`**

```json
{ "message": "Savings goal deleted" }
```

---

## Budget

### POST /budget

Set or update a monthly budget limit for a category (upsert).

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `category` | string | yes | Expense category |
| `monthlyLimit` | number | yes | Maximum monthly spend |
| `alertThreshold` | number | yes | Fraction (0–1) at which to send an alert, e.g. `0.8` |

**Response `200`**

```json
{ "message": "Budget saved" }
```

---

### GET /budget

Retrieve all budget settings for the user.

**Response `200`**

```json
{
  "budgets": [
    {
      "userId": "user#001",
      "category": "food",
      "monthlyLimit": 400.0,
      "alertThreshold": 0.8
    }
  ]
}
```

---

## Summary

### GET /summary?month=YYYY-MM

Calculate a monthly financial summary.

| Query Parameter | Required | Example |
|---|---|---|
| `month` | yes | `2026-05` |

**Response `200`**

```json
{
  "month": "2026-05",
  "totalIncome": 3000.0,
  "totalExpenses": 1250.75,
  "balance": 1749.25,
  "expensesByCategory": [
    { "category": "food", "amount": 380.0, "percentage": 30.38 },
    { "category": "rent", "amount": 700.0, "percentage": 55.97 },
    { "category": "transport", "amount": 170.75, "percentage": 13.65 }
  ]
}
```

`expensesByCategory` is sorted by `amount` descending. `percentage` is the share of total expenses.

**Error Responses**

| Code | Reason |
|---|---|
| `400` | Missing or invalid `month` parameter |
| `500` | Internal error |

---

## Expense Categories

`food` · `rent` · `transport` · `health` · `entertainment` · `shopping` · `utilities` · `other`

## Income Categories

`salary` · `freelance` · `investment` · `gift` · `other`
