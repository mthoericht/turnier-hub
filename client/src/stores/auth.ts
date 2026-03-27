import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  fetchAuthMe,
  postAuthLogin,
  postAuthSignup,
} from "@/api/authApi";
import { getToken, setToken } from "@/api/http";
import {
  connectRealtime,
  disconnectRealtime,
} from "@/realtime/realtimeClient";
import type { AuthUser } from "@/types";
import router from "@/router";

export const useAuthStore = defineStore("auth", () => 
{
  const user = ref<AuthUser | null>(null);
  const ready = ref(false);

  const isAuthenticated = computed(() => !!user.value);

  async function hydrate(): Promise<void> 
  {
    if (!getToken()) 
    {
      ready.value = true;
      return;
    }
    try 
    {
      user.value = await fetchAuthMe();
      connectRealtime();
    }
    catch 
    {
      setToken(null);
      user.value = null;
      disconnectRealtime();
    }
    finally 
    {
      ready.value = true;
    }
  }

  async function login(email: string, password: string): Promise<void> 
  {
    const res = await postAuthLogin(email, password);
    setToken(res.token);
    user.value = res.user;
    connectRealtime();
    await router.push("/");
  }

  async function signup(payload: {
    username: string;
    email: string;
    password: string;
    inviteCode: string;
  }): Promise<void> 
  {
    const res = await postAuthSignup(payload);
    setToken(res.token);
    user.value = res.user;
    connectRealtime();
    await router.push("/");
  }

  function logout(): void 
  {
    disconnectRealtime();
    setToken(null);
    user.value = null;
    void router.push("/login");
  }

  return { user, ready, isAuthenticated, hydrate, login, signup, logout };
});
