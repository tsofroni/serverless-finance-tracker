import json
import os
import uuid
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

from shared.response_helper import error, success

USER_ID = "user#001"


def _get_table():
    return boto3.resource("dynamodb").Table(os.environ["SAVINGS_TABLE"])


def handler(event, context):
    method = event.get("httpMethod", "")
    path_params = event.get("pathParameters") or {}

    if method == "OPTIONS":
        return success({})
    if method == "POST":
        return _create(event)
    if method == "GET":
        return _list()
    if method == "PUT":
        return _deposit(event, path_params.get("goalId"))
    if method == "DELETE":
        return _delete(path_params.get("goalId"))
    return error("Method not allowed", 405)


def _create(event):
    try:
        body = json.loads(event.get("body") or "{}")
        name = body.get("name")
        target_amount = body.get("targetAmount")
        deadline = body.get("deadline")

        if not name or target_amount is None or not deadline:
            return error("Missing required fields: name, targetAmount, deadline")

        goal_id = str(uuid.uuid4())

        _get_table().put_item(
            Item={
                "userId": USER_ID,
                "goalId": goal_id,
                "name": name,
                "targetAmount": Decimal(str(target_amount)),
                "currentAmount": Decimal("0"),
                "deadline": deadline,
            }
        )
        return success({"message": "Savings goal created", "goalId": goal_id}, 201)
    except Exception as exc:
        return error(str(exc), 500)


def _list():
    try:
        response = _get_table().query(
            KeyConditionExpression=Key("userId").eq(USER_ID)
        )
        return success({"goals": response.get("Items", [])})
    except Exception as exc:
        return error(str(exc), 500)


def _deposit(event, goal_id):
    if not goal_id:
        return error("goalId path parameter is required")
    try:
        body = json.loads(event.get("body") or "{}")
        amount = body.get("amount")

        if amount is None or Decimal(str(amount)) <= 0:
            return error("amount must be a positive number")

        _get_table().update_item(
            Key={"userId": USER_ID, "goalId": goal_id},
            UpdateExpression="ADD currentAmount :amt",
            ExpressionAttributeValues={":amt": Decimal(str(amount))},
        )
        return success({"message": "Savings goal updated"})
    except Exception as exc:
        return error(str(exc), 500)


def _delete(goal_id):
    if not goal_id:
        return error("goalId path parameter is required")
    try:
        _get_table().delete_item(Key={"userId": USER_ID, "goalId": goal_id})
        return success({"message": "Savings goal deleted"})
    except Exception as exc:
        return error(str(exc), 500)
