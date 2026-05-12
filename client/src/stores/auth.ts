import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { fetchSession } from "@/api/sessionApi";
import {
  connectRealtime,
  disconnectRealtime,
  setRealtimeSessionActive,
} from "@/realtime/realtimeClient";
import type { SessionUser } from "@turnier-hub/shared";

export const useAuthStore = defineStore("auth", () =>
{
  const user = ref<SessionUser | null>(null);
  const ready = ref(false);

  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === "admin");

  /**
   * Fetches the session user from the API and sets the realtime session active if successful.
   */
  async function hydrate(): Promise<void>
  {
    try
    {
      user.value = await fetchSession();
      setRealtimeSessionActive(true);
      connectRealtime();
    }
    catch
    {
      user.value = null;
      setRealtimeSessionActive(false);
      disconnectRealtime();
    }
    finally
    {
      ready.value = true;
    }
  }

  /**
   * Ends the Authelia session when `logoutUrl` was provided by the API;
   * otherwise this is a no-op (identity is enforced by the reverse proxy).
   */
  function logout(): void
  {
    const url = user.value?.logoutUrl;
    disconnectRealtime();
    setRealtimeSessionActive(false);
    user.value = null;
    if (url)
    {
      window.location.assign(url);
    }
  }

  return { user, ready, isAuthenticated, isAdmin, hydrate, logout };
});
