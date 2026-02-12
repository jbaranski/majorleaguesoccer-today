import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient();
const TABLE_NAME = 'EmailCollector';

export const handler = async (event) => {
  const id = event.queryStringParameters?.id;

  if (!id) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html' },
      body: page('Missing id', 'No unsubscribe ID was provided.'),
    };
  }

  // Find the subscriber by unsubscribe UUID
  const scanResult = await client.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'unsubscribe = :id',
    ExpressionAttributeValues: { ':id': { S: id } },
  }));

  const item = scanResult.Items?.[0];
  if (!item) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/html' },
      body: page('Not Found', 'This unsubscribe link is not valid.'),
    };
  }

  // Set active = false
  await client.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: { email: item.email, site: item.site },
    UpdateExpression: 'SET active = :false',
    ExpressionAttributeValues: { ':false': { BOOL: false } },
  }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: page('Unsubscribed', 'You have been successfully unsubscribed and will no longer receive emails.'),
  };
};

const page = (title, message) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - MLS Today</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: #ffffff;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      color: #1f2937;
    }
    .container {
      text-align: center;
      max-width: 480px;
      padding: 24px;
    }
    h1 { font-size: 1.5rem; margin-bottom: 12px; }
    p { font-size: 1rem; color: #4b5563; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
