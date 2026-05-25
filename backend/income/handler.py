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

    if method == "OPTIONS":
        return success({})
    if method == "GET":
        return _list()
    if method == "POST":
        try:
            body = json.loads(event.get("body") or "{}")
        except Exception:
            return error("Invalid JSON in request body")

        action = body.get("action", "create")
        if action == "create":
            return _create(body)
        if action == "update":
            return _update(body)
        if action == "delete":
            return _delete(body.get("transactionId"))
        return error(f"Unknown action: '{action}'")

    return error("Method not allowed", 405)


def _create(body):
    try:
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
                "type": "income",
                "amount": Decimal(str(amount)),
                "category": category,
                "description": description,
                "date": date,
            }
        )
        return success({"message": "Income created", "transactionId": transaction_id}, 201)
    except Exception as exc:
        return error(str(exc), 500)


def _update(body):
    transaction_id = body.get("transactionId")
    if not transaction_id:
        return error("transactionId is required")
    try:
        amount = body.get("amount")
        category = body.get("category")
        description = body.get("description", "")
        date = body.get("date")

        if amount is None or not category or not date:
            return error("Missing required fields: amount, category, date")

        # 'date' is a DynamoDB reserved word — must be aliased
        _get_table().update_item(
            Key={"userId": USER_ID, "transactionId": transaction_id},
            UpdateExpression="SET amount = :amt, category = :cat, description = :desc, #dt = :date",
            ExpressionAttributeNames={"#dt": "date"},
            ExpressionAttributeValues={
                ":amt": Decimal(str(amount)),
                ":cat": category,
                ":desc": description,
                ":date": date,
            },
        )
        return success({"message": "Income updated"})
    except Exception as exc:
        return error(str(exc), 500)


def _delete(transaction_id):
    if not transaction_id:
        return error("transactionId is required")
    try:
        _get_table().delete_item(
            Key={"userId": USER_ID, "transactionId": transaction_id}
        )
        return success({"message": "Income deleted"})
    except Exception as exc:
        return error(str(exc), 500)


def _list():
    try:
        response = _get_table().query(
            KeyConditionExpression=Key("userId").eq(USER_ID),
            FilterExpression=Attr("type").eq("income"),
        )
        return success({"income": response.get("Items", [])})
    except Exception as exc:
        return error(str(exc), 500)
