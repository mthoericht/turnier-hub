import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DYNAMODB_ENDPOINT } from "../config.js";

let client: DynamoDBDocumentClient | null = null;

function createClient(): DynamoDBDocumentClient
{
  const base = new DynamoDBClient({
    region: process.env.AWS_REGION ?? "eu-central-1",
    endpoint: DYNAMODB_ENDPOINT,
  });

  return DynamoDBDocumentClient.from(base, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });
}

export function getDynamoDocumentClient(): DynamoDBDocumentClient
{
  if (!client)
  {
    client = createClient();
  }
  return client;
}
