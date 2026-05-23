import boto3

_dynamodb_resource = None


def get_dynamodb():
    global _dynamodb_resource
    if _dynamodb_resource is None:
        _dynamodb_resource = boto3.resource("dynamodb")
    return _dynamodb_resource


def get_table(table_name):
    return get_dynamodb().Table(table_name)
