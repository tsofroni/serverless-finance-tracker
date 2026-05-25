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
    # Read ID from query params — avoids per-sub-resource CORS configuration
    query_params = event.get("queryStringParameters") or {}
    goal_id = query_params.get("goalId")

    if method == "OPTIONS":
        return success({})
    if method == "POST":
        return _create(event)
    if method == "GET":
        return _list()
    if method == "PUT":
        return _update(event, goal_id)
    if method == "DELETE":
        return _delete(goal_id)
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


def _update(event, goal_id):
    if not goal_id:
        return error("goalId query parameter is required")
    try:
        body = json.loads(event.get("body") or "{}")

        # Deposit: body contains { "deposit": <amount> }
        if "deposit" in body:
            deposit = Decimal(str(body["deposit"]))
            if deposit <= 0:
                return error("deposit must be a positive number")
            _get_table().update_item(
                Key={"userId": USER_ID, "goalId": goal_id},
                UpdateExpression="ADD currentAmount :amt",
                ExpressionAttributeValues={":amt": deposit},
            )
            return success({"message": "Deposit added"})

        # Full edit: body contains { name, targetAmount, deadline, currentAmount? }
        updates = []
        values = {}
        names = {}

        if "name" in body:
            # 'name' is a DynamoDB reserved word
            updates.append("#nm = :name")
            names["#nm"] = "name"
            values[":name"] = body["name"]
        if "targetAmount" in body:
            updates.append("targetAmount = :target")
            values[":target"] = Decimal(str(body["targetAmount"]))
        if "deadline" in body:
            updates.append("deadline = :deadline")
            values[":deadline"] = body["deadline"]
        if "currentAmount" in body:
            updates.append("currentAmount = :current")
            values[":current"] = Decimal(str(body["currentAmount"]))

        if not updates:
            return error("No fields to update")

        kwargs = {
            "Key": {"userId": USER_ID, "goalId": goal_id},
            "UpdateExpression": "SET " + ", ".join(updates),
            "ExpressionAttributeValues": values,
        }
        if names:
            kwargs["ExpressionAttributeNames"] = names

        _get_table().update_item(**kwargs)
        return success({"message": "Savings goal updated"})
    except Exception as exc:
        return error(str(exc), 500)


def _delete(goal_id):
    if not goal_id:
        return error("goalId query parameter is required")
    try:
        _get_table().delete_item(Key={"userId": USER_ID, "goalId": goal_id})
        return success({"message": "Savings goal deleted"})
    except Exception as exc:
        return error(str(exc), 500)
