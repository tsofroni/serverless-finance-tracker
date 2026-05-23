import json
import os
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

from shared.response_helper import error, success

USER_ID = "user#001"


def _get_table():
    return boto3.resource("dynamodb").Table(os.environ["BUDGETS_TABLE"])


def handler(event, context):
    method = event.get("httpMethod", "")

    if method == "OPTIONS":
        return success({})
    if method == "POST":
        return _upsert(event)
    if method == "GET":
        return _list()
    return error("Method not allowed", 405)


def _upsert(event):
    try:
        body = json.loads(event.get("body") or "{}")
        category = body.get("category")
        monthly_limit = body.get("monthlyLimit")
        alert_threshold = body.get("alertThreshold")

        if not category or monthly_limit is None or alert_threshold is None:
            return error("Missing required fields: category, monthlyLimit, alertThreshold")

        _get_table().put_item(
            Item={
                "userId": USER_ID,
                "category": category,
                "monthlyLimit": Decimal(str(monthly_limit)),
                "alertThreshold": Decimal(str(alert_threshold)),
            }
        )
        return success({"message": "Budget saved"})
    except Exception as exc:
        return error(str(exc), 500)


def _list():
    try:
        response = _get_table().query(
            KeyConditionExpression=Key("userId").eq(USER_ID)
        )
        return success({"budgets": response.get("Items", [])})
    except Exception as exc:
        return error(str(exc), 500)
