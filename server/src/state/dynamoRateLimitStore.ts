import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { RateLimitCounter, RateLimitStore } from "./rateLimitStore.js";
import { getDynamoDocumentClient } from "./dynamoClient.js";

export type DynamoRateLimitStoreOptions = {
  tableName: string;
  client?: DynamoDBDocumentClient;
};

type RateLimitRow = {
  key: string;
  count: number;
  resetAtMs: number;
  ttl: number;
};

export class DynamoRateLimitStore implements RateLimitStore
{
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  public constructor(options: DynamoRateLimitStoreOptions)
  {
    this.tableName = options.tableName;
    this.client = options.client ?? getDynamoDocumentClient();
  }

  public async consume(key: string, windowMs: number): Promise<RateLimitCounter>
  {
    const now = Date.now();
    const resetAtMs = now + windowMs;

    try
    {
      const active = await this.client.send(new UpdateCommand({
        TableName: this.tableName,
        Key: { key },
        UpdateExpression:
          "ADD #count :inc SET #ttl = :ttl, #resetAtMs = if_not_exists(#resetAtMs, :resetAtMs)",
        ConditionExpression:
          "attribute_not_exists(#resetAtMs) OR #resetAtMs > :now",
        ExpressionAttributeNames: {
          "#count": "count",
          "#ttl": "ttl",
          "#resetAtMs": "resetAtMs",
        },
        ExpressionAttributeValues: {
          ":inc": 1,
          ":ttl": Math.ceil(resetAtMs / 1000),
          ":resetAtMs": resetAtMs,
          ":now": now,
        },
        ReturnValues: "ALL_NEW",
      }));

      const row = active.Attributes as RateLimitRow;
      return { count: row.count, resetAtMs: row.resetAtMs };
    }
    catch (error)
    {
      if (!(error instanceof ConditionalCheckFailedException))
      {
        throw error;
      }
    }

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        key,
        count: 1,
        resetAtMs,
        ttl: Math.ceil(resetAtMs / 1000),
      } satisfies RateLimitRow,
    }));

    return { count: 1, resetAtMs };
  }

  public async reset(key: string): Promise<void>
  {
    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { key },
    }));
  }
}
