import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { LockoutEntry, LockoutStore } from "./lockoutStore.js";
import { getDynamoDocumentClient } from "./dynamoClient.js";

export type DynamoLockoutStoreOptions = {
  tableName: string;
  client?: DynamoDBDocumentClient;
};

type LockoutRow = {
  key: string;
  failures: number;
  lockedUntilMs: number;
  ttl: number;
};

export class DynamoLockoutStore implements LockoutStore
{
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  public constructor(options: DynamoLockoutStoreOptions)
  {
    this.tableName = options.tableName;
    this.client = options.client ?? getDynamoDocumentClient();
  }

  public async getActive(key: string): Promise<LockoutEntry | null>
  {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { key },
      ConsistentRead: true,
    }));

    const row = result.Item as LockoutRow | undefined;
    if (!row)
    {
      return null;
    }

    if (row.lockedUntilMs <= Date.now())
    {
      return null;
    }

    return {
      failures: row.failures,
      lockedUntilMs: row.lockedUntilMs,
    };
  }

  public async registerFailure(
    key: string,
    computeLockoutMs: (failures: number) => number,
  ): Promise<LockoutEntry>
  {
    const now = Date.now();

    const updated = await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { key },
      UpdateExpression: "ADD #failures :inc SET #ttl = :ttl",
      ExpressionAttributeNames: {
        "#failures": "failures",
        "#ttl": "ttl",
      },
      ExpressionAttributeValues: {
        ":inc": 1,
        ":ttl": Math.ceil((now + 60 * 60 * 1000) / 1000),
      },
      ReturnValues: "ALL_NEW",
    }));

    const row = updated.Attributes as { failures: number };
    const lockoutMs = computeLockoutMs(row.failures);
    const lockedUntilMs = lockoutMs > 0 ? now + lockoutMs : 0;

    await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { key },
      UpdateExpression: "SET #lockedUntilMs = :lockedUntilMs, #ttl = :ttl",
      ExpressionAttributeNames: {
        "#lockedUntilMs": "lockedUntilMs",
        "#ttl": "ttl",
      },
      ExpressionAttributeValues: {
        ":lockedUntilMs": lockedUntilMs,
        ":ttl": Math.ceil(Math.max(now + 60 * 60 * 1000, lockedUntilMs) / 1000),
      },
    }));

    return {
      failures: row.failures,
      lockedUntilMs,
    };
  }

  public async reset(key: string): Promise<void>
  {
    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { key },
    }));
  }
}
