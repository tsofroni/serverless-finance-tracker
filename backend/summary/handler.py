import os
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr, Key

from shared.response_helper import error, success

USER_ID = "user#001"


def _get_table():
    return boto3.resource("dynamodb").Table(os.environ["TRANSACTIONS_TABLE"])


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return success({})

    params = event.get("queryStringParameters") or {}
    month = params.get("month")

    if not month or len(month) != 7 or month[4] != "-":
        return error("month query parameter is required (format: YYYY-MM)")

    try:
        response = _get_table().query(
            KeyConditionExpression=Key("userId").eq(USER_ID),
            FilterExpression=Attr("date").begins_with(month),
        )
        items = response.get("Items", [])

        total_income = Decimal("0")
        total_expenses = Decimal("0")
        expenses_by_category: dict[str, Decimal] = {}

        for item in items:
            amount = item.get("amount", Decimal("0"))
            if item.get("type") == "income":
                total_income += amount
            elif item.get("type") == "expense":
                total_expenses += amount
                cat = item.get("category", "other")
                expenses_by_category[cat] = expenses_by_category.get(cat, Decimal("0")) + amount

        category_breakdown = []
        for cat, amount in expenses_by_category.items():
            pct = float(amount / total_expenses * 100) if total_expenses > 0 else 0.0
            category_breakdown.append(
                {"category": cat, "amount": amount, "percentage": round(pct, 2)}
            )
        category_breakdown.sort(key=lambda x: x["amount"], reverse=True)

        return success(
            {
                "month": month,
                "totalIncome": total_income,
                "totalExpenses": total_expenses,
                "balance": total_income - total_expenses,
                "expensesByCategory": category_breakdown,
            }
        )
    except Exception as exc:
        return error(str(exc), 500)
