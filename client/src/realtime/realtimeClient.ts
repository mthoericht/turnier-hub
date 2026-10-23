import { ref } from "vue";

type ServerPushMessage =
  | { type: "tournamentChanged"; tournamentId: string }
  | { type: "catalogChanged"; kinds: Array<"players" | "classes"> }
  | { type: "tournamentsChanged" };

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let enabled = false;
let hasConnected = false;
export const realtimeDisconnected = ref(false);
const tournamentSubs = new Set<string>();
const RECONNECT_MS = 4000;
let dispatchMessage: (msg: ServerPushMessage) => Promise<void> = dispatch;

function wsUrl(): string | null
{
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/api/ws`;
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

function flushSubscriptions(): void
{
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  for (const id of tournamentSubs)
  {
    socket.send(JSON.stringify({ type: "subscribe", tournamentId: id }));
  }
}

function scheduleReconnect(): void
{
  if (!enabled || reconnectTimer) return;
  reconnectTimer = setTimeout(() =>
  {
    reconnectTimer = null;
    connectRealtime();
  }, RECONNECT_MS);
}

export function connectRealtime(): void
{
  enabled = true;
  const url = wsUrl();
  if (!url) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING))
  {
    return;
  }
  socket?.close();
  try
  {
    const ws = new WebSocket(url);
    socket = ws;
    ws.onopen = () =>
    {
      if (socket !== ws || !enabled) return;
      realtimeDisconnected.value = false;
      flushSubscriptions();
      if (hasConnected)
      {
        void dispatchMessage({ type: "catalogChanged", kinds: ["players", "classes"] });
        void dispatchMessage({ type: "tournamentsChanged" });
        for (const tournamentId of tournamentSubs) void dispatchMessage({ type: "tournamentChanged", tournamentId });
      }
      hasConnected = true;
    };
    ws.onmessage = (ev) =>
    {
      try
      {
        const msg = JSON.parse(String(ev.data)) as ServerPushMessage;
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
        /* ignore */
      }
    };
    ws.onclose = () =>
    {
      if (socket !== ws || !enabled) return;
      socket = null;
      realtimeDisconnected.value = true;
      scheduleReconnect();
    };
    ws.onerror = () =>
    {
      ws.close();
    };
  }
  catch
  {
    realtimeDisconnected.value = true;
    scheduleReconnect();
  }
}

export function disconnectRealtime(): void
{
  enabled = false;
  hasConnected = false;
  realtimeDisconnected.value = false;
  if (reconnectTimer)
  {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  tournamentSubs.clear();
  socket?.close();
  socket = null;
}

export function subscribeTournamentRealtime(tournamentId: string): void
{
  tournamentSubs.add(tournamentId);
  if (socket?.readyState === WebSocket.OPEN)
  {
    socket.send(JSON.stringify({ type: "subscribe", tournamentId }));
  }
}

export function unsubscribeTournamentRealtime(tournamentId: string): void
{
  tournamentSubs.delete(tournamentId);
  if (socket?.readyState === WebSocket.OPEN)
  {
    socket.send(JSON.stringify({ type: "unsubscribe", tournamentId }));
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
