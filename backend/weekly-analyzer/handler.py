import json
import os
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr, Key

USER_ID = "user#001"


def _get_transactions_table():
    return boto3.resource("dynamodb").Table(os.environ["TRANSACTIONS_TABLE"])


def _get_budgets_table():
    return boto3.resource("dynamodb").Table(os.environ["BUDGETS_TABLE"])


def handler(event, context):
    try:
        current_month = datetime.now(timezone.utc).strftime("%Y-%m")

        budgets_response = _get_budgets_table().query(
            KeyConditionExpression=Key("userId").eq(USER_ID)
        )
        budgets = {item["category"]: item for item in budgets_response.get("Items", [])}

        if not budgets:
            return {"statusCode": 200, "body": json.dumps({"message": "No budgets configured"})}

        transactions_response = _get_transactions_table().query(
            KeyConditionExpression=Key("userId").eq(USER_ID),
            FilterExpression=Attr("type").eq("expense") & Attr("date").begins_with(current_month),
        )

        expenses_by_category: dict[str, Decimal] = {}
        for item in transactions_response.get("Items", []):
            cat = item.get("category", "other")
            expenses_by_category[cat] = (
                expenses_by_category.get(cat, Decimal("0")) + item.get("amount", Decimal("0"))
            )

        sns_client = boto3.client("sns")
        topic_arn = os.environ["SNS_TOPIC_ARN"]
        alerts_sent = 0

        for category, budget in budgets.items():
            monthly_limit = budget.get("monthlyLimit", Decimal("0"))
            alert_threshold = budget.get("alertThreshold", Decimal("0.8"))
            actual = expenses_by_category.get(category, Decimal("0"))

            if monthly_limit > 0 and actual >= monthly_limit * alert_threshold:
                percentage = float(actual / monthly_limit * 100)
                message = json.dumps(
                    {
                        "category": category,
                        "monthlyLimit": float(monthly_limit),
                        "currentSpending": float(actual),
                        "percentage": round(percentage, 2),
                        "month": current_month,
                    }
                )
                sns_client.publish(
                    TopicArn=topic_arn,
                    Message=message,
                    Subject=f"Budget Alert: {category} at {round(percentage)}%",
                )
                alerts_sent += 1

        return {"statusCode": 200, "body": json.dumps({"alertsSent": alerts_sent})}
    except Exception as exc:
        return {"statusCode": 500, "body": json.dumps({"error": str(exc)})}
