import json
import os

import boto3


def handler(event, context):
    try:
        for record in event.get("Records", []):
            _process_record(record)
        return {"statusCode": 200, "body": "OK"}
    except Exception as exc:
        return {"statusCode": 500, "body": json.dumps({"error": str(exc)})}


def _process_record(record):
    sns_message = record["Sns"]["Message"]
    data = json.loads(sns_message)

    category = data.get("category", "Unknown")
    monthly_limit = data.get("monthlyLimit", 0)
    current_spending = data.get("currentSpending", 0)
    percentage = data.get("percentage", 0)
    month = data.get("month", "")

    subject = f"Budget Alert: {category} spending at {round(percentage)}%"

    html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 2rem;">
  <h2 style="color: #c0392b;">Budget Alert</h2>
  <p>
    Your spending in <strong>{category}</strong> has reached
    <strong>{percentage:.1f}%</strong> of your monthly budget for <strong>{month}</strong>.
  </p>
  <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
    <tr style="background: #f5f5f5;">
      <td style="padding: 0.5rem 1rem; font-weight: bold;">Category</td>
      <td style="padding: 0.5rem 1rem;">{category}</td>
    </tr>
    <tr>
      <td style="padding: 0.5rem 1rem; font-weight: bold;">Month</td>
      <td style="padding: 0.5rem 1rem;">{month}</td>
    </tr>
    <tr style="background: #f5f5f5;">
      <td style="padding: 0.5rem 1rem; font-weight: bold;">Monthly Limit</td>
      <td style="padding: 0.5rem 1rem;">€ {monthly_limit:.2f}</td>
    </tr>
    <tr>
      <td style="padding: 0.5rem 1rem; font-weight: bold;">Current Spending</td>
      <td style="padding: 0.5rem 1rem;">€ {current_spending:.2f}</td>
    </tr>
    <tr style="background: #f5f5f5;">
      <td style="padding: 0.5rem 1rem; font-weight: bold;">Usage</td>
      <td style="padding: 0.5rem 1rem; color: #c0392b;">{percentage:.1f}%</td>
    </tr>
  </table>
  <p style="margin-top: 1.5rem; color: #777; font-size: 0.85rem;">
    Sent by Finance Tracker — AWS Lambda
  </p>
</body>
</html>"""

    text_body = (
        f"Budget Alert\n\n"
        f"Category:         {category}\n"
        f"Month:            {month}\n"
        f"Monthly Limit:    EUR {monthly_limit:.2f}\n"
        f"Current Spending: EUR {current_spending:.2f}\n"
        f"Usage:            {percentage:.1f}%\n"
    )

    boto3.client("ses").send_email(
        Source=os.environ["SES_SENDER_EMAIL"],
        Destination={"ToAddresses": [os.environ["SES_RECIPIENT_EMAIL"]]},
        Message={
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            "Body": {
                "Text": {"Data": text_body, "Charset": "UTF-8"},
                "Html": {"Data": html_body, "Charset": "UTF-8"},
            },
        },
    )
