/**
 * Event types pushed from the server to subscribed clients.
 *
 * Mirrors the legacy WebSocket payload shapes so the client-side dispatcher
 * does not need to change when SSE replaces WebSocket transport.
 */
export type RealtimeEvent =
  | { type: "tournamentChanged"; tournamentId: string }
  | { type: "catalogChanged"; kinds: Array<"players" | "classes"> }
  | { type: "tournamentsChanged" };

export type RealtimeListener = (event: RealtimeEvent) => void;

export type RealtimeSubscriptionOptions = {
  tournamentIds: ReadonlySet<string>;
};

/**
 * Transport-agnostic realtime event bus.
 *
 * The same interface is implemented by `MemoryEventBus` (used in dev/tests
 * and inside a single Express process) and later by `DynamoEventBus`
 * (Phase 5: polls a DynamoDB event log so that REST Lambdas and SSE
 * Lambdas can fan out across separate processes).
 */
export interface RealtimeEventBus
{
  publish(event: RealtimeEvent): void;
  subscribe(opts: RealtimeSubscriptionOptions, listener: RealtimeListener): () => void;
}

/**
 * Returns true when an event matches a subscriber's tournament filter.
 *
 * `catalogChanged` and `tournamentsChanged` are broadcast to every subscriber.
 * `tournamentChanged` is delivered only to subscribers that opted into the
 * specific tournament id.
 */
export function eventMatchesSubscription(
  event: RealtimeEvent,
  tournamentIds: ReadonlySet<string>
): boolean
{
  if (event.type === "tournamentChanged")
  {
    return tournamentIds.has(event.tournamentId);
  }
  return true;
}

type Entry = {
  tournamentIds: ReadonlySet<string>;
  listener: RealtimeListener;
};

/**
 * In-memory implementation of `RealtimeEventBus`.
 *
 * Suitable for the local development server, unit tests, and any setup where
 * publishers and subscribers live in the same Node.js process.
 */
export class MemoryEventBus implements RealtimeEventBus
{
  private readonly entries: Set<Entry> = new Set();

  publish(event: RealtimeEvent): void
  {
    for (const entry of this.entries)
    {
      if (!eventMatchesSubscription(event, entry.tournamentIds))
      {
        continue;
      }
      try
      {
        entry.listener(event);
      }
      catch
      {
        // A faulty listener must not break the publisher loop or other listeners.
      }
    }
  }

  subscribe(opts: RealtimeSubscriptionOptions, listener: RealtimeListener): () => void
  {
    const entry: Entry = {
      tournamentIds: opts.tournamentIds,
      listener,
    };
    this.entries.add(entry);
    return () =>
    {
      this.entries.delete(entry);
    };
  }

  /**
   * Returns the current number of active subscriptions. Test/diagnostic helper.
   */
  subscriberCount(): number
  {
    return this.entries.size;
  }
}
