import json
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr, Key

from shared.response_helper import error, success

USER_ID = "user#001"


def _get_table():
    return boto3.resource("dynamodb").Table(os.environ["TRANSACTIONS_TABLE"])


def handler(event, context):
    method = event.get("httpMethod", "")
    path_params = event.get("pathParameters") or {}

    if method == "OPTIONS":
        return success({})
    if method == "POST":
        return _create(event)
    if method == "GET":
        return _list()
    if method == "DELETE":
        return _delete(path_params.get("transactionId"))
    return error("Method not allowed", 405)


def _create(event):
    try:
        body = json.loads(event.get("body") or "{}")
        amount = body.get("amount")
        category = body.get("category")
        description = body.get("description", "")
        date = body.get("date")

        if amount is None or not category or not date:
            return error("Missing required fields: amount, category, date")

        timestamp = datetime.now(timezone.utc).isoformat()
        transaction_id = f"{timestamp}#{uuid.uuid4()}"

        _get_table().put_item(
            Item={
                "userId": USER_ID,
                "transactionId": transaction_id,
                "type": "expense",
                "amount": Decimal(str(amount)),
                "category": category,
                "description": description,
                "date": date,
            }
        )
        return success({"message": "Expense created", "transactionId": transaction_id}, 201)
    except Exception as exc:
        return error(str(exc), 500)


def _list():
    try:
        response = _get_table().query(
            KeyConditionExpression=Key("userId").eq(USER_ID),
            FilterExpression=Attr("type").eq("expense"),
        )
        return success({"expenses": response.get("Items", [])})
    except Exception as exc:
        return error(str(exc), 500)


def _delete(transaction_id):
    if not transaction_id:
        return error("transactionId path parameter is required")
    try:
        _get_table().delete_item(
            Key={"userId": USER_ID, "transactionId": transaction_id}
        )
        return success({"message": "Expense deleted"})
    except Exception as exc:
        return error(str(exc), 500)
