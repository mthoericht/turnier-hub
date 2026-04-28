import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDynamoDocumentClient } from "../state/dynamoClient.js";
import {
  type RealtimeEvent,
  type RealtimeEventBus,
  type RealtimeListener,
  type RealtimeSubscriptionOptions,
} from "./eventBus.js";

export type DynamoEventBusOptions = {
  tableName: string;
  pollMs: number;
  client?: DynamoDBDocumentClient;
};

type PersistedEvent = {
  pk: string;
  ts: number;
  ttl: number;
  payload: RealtimeEvent;
};

function toPartitionKeys(event: RealtimeEvent): string[]
{
  if (event.type === "tournamentChanged")
  {
    return ["broadcast", `tournament#${event.tournamentId}`];
  }
  return ["broadcast"];
}

function sortUniqueEvents(events: PersistedEvent[]): RealtimeEvent[]
{
  const seen = new Set<string>();

  return events
    .sort((a, b) => a.ts - b.ts)
    .filter((entry) =>
    {
      const id = `${entry.pk}:${entry.ts}:${JSON.stringify(entry.payload)}`;
      if (seen.has(id))
      {
        return false;
      }
      seen.add(id);
      return true;
    })
    .map((entry) => entry.payload);
}

export class DynamoEventBus implements RealtimeEventBus
{
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;
  private readonly pollMs: number;

  public constructor(options: DynamoEventBusOptions)
  {
    this.tableName = options.tableName;
    this.pollMs = options.pollMs;
    this.client = options.client ?? getDynamoDocumentClient();
  }

  public publish(event: RealtimeEvent): void
  {
    const now = Date.now();
    const ttl = Math.ceil((now + 60 * 60 * 1000) / 1000);

    for (const pk of toPartitionKeys(event))
    {
      void this.client.send(new PutCommand({
        TableName: this.tableName,
        Item: {
          pk,
          ts: now,
          ttl,
          payload: event,
        } satisfies PersistedEvent,
      })).catch(() =>
      {
        // Drop publish failures to preserve route behavior parity with MemoryEventBus.
      });
    }
  }

  public subscribe(opts: RealtimeSubscriptionOptions, listener: RealtimeListener): () => void
  {
    let active = true;
    let lastSeenTs = Date.now();

    const poll = async (): Promise<void> =>
    {
      if (!active)
      {
        return;
      }

      const pks = [
        "broadcast",
        ...Array.from(opts.tournamentIds).map((id) => `tournament#${id}`),
      ];

      const collected: PersistedEvent[] = [];

      for (const pk of pks)
      {
        const result = await this.client.send(new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "#pk = :pk AND #ts > :ts",
          ExpressionAttributeNames: {
            "#pk": "pk",
            "#ts": "ts",
          },
          ExpressionAttributeValues: {
            ":pk": pk,
            ":ts": lastSeenTs,
          },
          ScanIndexForward: true,
        }));

        const items = (result.Items ?? []) as PersistedEvent[];
        collected.push(...items);
      }

      for (const event of sortUniqueEvents(collected))
      {
        listener(event);
      }

      const maxTs = collected.reduce((max, item) => Math.max(max, item.ts), lastSeenTs);
      lastSeenTs = maxTs;
    };

    const timer = setInterval(() =>
    {
      void poll().catch(() =>
      {
        // Keep the subscriber alive on transient Dynamo read failures.
      });
    }, this.pollMs);

    if (typeof timer.unref === "function")
    {
      timer.unref();
    }

    void poll().catch(() =>
    {
      // Ignore transient startup read failures.
    });

    return () =>
    {
      active = false;
      clearInterval(timer);
    };
  }
}
