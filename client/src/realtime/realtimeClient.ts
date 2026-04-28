import { getToken } from "../api/http";

type ServerPushMessage =
  | { type: "tournamentChanged"; tournamentId: string }
  | { type: "catalogChanged"; kinds: Array<"players" | "classes"> }
  | { type: "tournamentsChanged" };

let source: EventSource | null = null;
const tournamentSubs = new Set<string>();
let dispatchMessage: (msg: ServerPushMessage) => Promise<void> = dispatch;
let reopenScheduled = false;
let intentionallyDisconnected = false;

function buildSseUrl(): string | null
{
  const token = getToken();
  if (!token) return null;
  const params = new URLSearchParams();
  params.set("token", token);
  if (tournamentSubs.size > 0)
  {
    params.set("tournaments", Array.from(tournamentSubs).join(","));
  }
  const proto = window.location.protocol === "https:" ? "https" : "http";
  return `${proto}://${window.location.host}/api/sse?${params.toString()}`;
}

async function dispatch(msg: ServerPushMessage): Promise<void>
{
  const [
    { useTournamentLayoutStore },
    { usePlayersManagementStore },
    { useClassesManagementStore },
    { useTournamentsListStore },
    { useDashboardStore },
  ] = await Promise.all([
    import("../stores/tournamentLayout"),
    import("../stores/playersManagement"),
    import("../stores/classesManagement"),
    import("../stores/tournamentsList"),
    import("../stores/dashboard"),
  ]);

  if (msg.type === "tournamentChanged")
  {
    useTournamentLayoutStore().onRealtimeTournamentChanged(msg.tournamentId);
    return;
  }
  if (msg.type === "catalogChanged")
  {
    const playersStore = usePlayersManagementStore();
    const classesStore = useClassesManagementStore();
    const layoutStore = useTournamentLayoutStore();
    for (const k of msg.kinds)
    {
      if (k === "players") void playersStore.reloadIfInitialized();
      if (k === "classes") void classesStore.reloadIfInitialized();
    }
    void layoutStore.reloadPlayersIfActive();
    return;
  }
  if (msg.type === "tournamentsChanged")
  {
    void useTournamentsListStore().reloadIfInitialized();
    void useDashboardStore().reloadIfInitialized();
  }
}

function closeSource(): void
{
  if (!source) return;
  try
  {
    source.close();
  }
  catch
  {
    // ignore
  }
  source = null;
}

function openSource(): void
{
  const url = buildSseUrl();
  if (!url) return;
  try
  {
    const es = new EventSource(url);
    source = es;
    const handle = (raw: unknown): void =>
    {
      try
      {
        const msg = JSON.parse(String(raw)) as ServerPushMessage;
        if (
          msg.type === "tournamentChanged"
          || msg.type === "catalogChanged"
          || msg.type === "tournamentsChanged"
        )
        {
          void dispatchMessage(msg);
        }
      }
      catch
      {
        /* ignore malformed payload */
      }
    };
    es.addEventListener("tournamentChanged", (ev) => handle((ev as MessageEvent).data));
    es.addEventListener("catalogChanged", (ev) => handle((ev as MessageEvent).data));
    es.addEventListener("tournamentsChanged", (ev) => handle((ev as MessageEvent).data));
    // EventSource auto-reconnects on transient network errors. We only react
    // to errors here for diagnostics and to drop a stale handle if the browser
    // gives up entirely (readyState === CLOSED).
    es.onerror = () =>
    {
      if (es.readyState === EventSource.CLOSED && source === es)
      {
        source = null;
      }
    };
  }
  catch
  {
    source = null;
  }
}

/**
 * Closes any current SSE connection and reopens one with the latest token and
 * tournament-subscription set. Coalesces rapid-fire calls so a burst of
 * subscribe/unsubscribe operations only triggers a single reconnect.
 */
function reopenSoon(): void
{
  if (intentionallyDisconnected) return;
  if (reopenScheduled) return;
  reopenScheduled = true;
  queueMicrotask(() =>
  {
    reopenScheduled = false;
    if (intentionallyDisconnected) return;
    if (!getToken())
    {
      closeSource();
      return;
    }
    closeSource();
    openSource();
  });
}

export function connectRealtime(): void
{
  intentionallyDisconnected = false;
  if (!getToken()) return;
  if (source && source.readyState !== EventSource.CLOSED)
  {
    return;
  }
  closeSource();
  openSource();
}

export function disconnectRealtime(): void
{
  intentionallyDisconnected = true;
  tournamentSubs.clear();
  closeSource();
}

export function subscribeTournamentRealtime(tournamentId: string): void
{
  if (tournamentSubs.has(tournamentId)) return;
  tournamentSubs.add(tournamentId);
  if (source)
  {
    reopenSoon();
  }
}

export function unsubscribeTournamentRealtime(tournamentId: string): void
{
  if (!tournamentSubs.has(tournamentId)) return;
  tournamentSubs.delete(tournamentId);
  if (source)
  {
    reopenSoon();
  }
}

export function setRealtimeDispatchForTests(
  fn: ((msg: ServerPushMessage) => Promise<void> | void) | null
): void
{
  if (!fn)
  {
    dispatchMessage = dispatch;
    return;
  }
  dispatchMessage = async (msg: ServerPushMessage) =>
  {
    await fn(msg);
  };
}
