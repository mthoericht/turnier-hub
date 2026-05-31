import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getToken, setToken } from "../api/http";
import {
  connectRealtime,
  disconnectRealtime,
} from "@/realtime/realtimeClient";
import {
  getAuthProvider,
  isCognitoAuth,
  type SignupInput,
  type SignupResult,
} from "@/auth/authProvider";
import type { AuthUser } from "@turnier-hub/shared";
import router from "@/router";

export const useAuthStore = defineStore("auth", () => 
{
  const user = ref<AuthUser | null>(null);
  const ready = ref(false);

  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === "admin");

  async function hydrate(): Promise<void> 
  {
    // Local mode stores the token itself, so skip work when there is none.
    // Cognito keeps its session outside our storage, so always try to restore.
    if (!isCognitoAuth && !getToken()) 
    {
      ready.value = true;
      return;
    }
    try 
    {
      const provider = await getAuthProvider();
      const restored = await provider.restore();
      if (restored)
      {
        user.value = restored;
        connectRealtime();
      }
      else
      {
        user.value = null;
      }
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
    const provider = await getAuthProvider();
    user.value = await provider.login(email, password);
    connectRealtime();
    await router.push("/");
  }

  async function signup(input: SignupInput): Promise<SignupResult> 
  {
    const provider = await getAuthProvider();
    const result = await provider.signup(input);
    if (result.status === "authenticated")
    {
      user.value = result.user;
      connectRealtime();
      await router.push("/");
    }
    return result;
  }

  async function confirmSignup(email: string, code: string): Promise<void>
  {
    const provider = await getAuthProvider();
    await provider.confirmSignup(email, code);
  }

  async function logout(): Promise<void>
  {
    try
    {
      const provider = await getAuthProvider();
      await provider.logout();
    }
    catch
    {
      // Even if the backend sign-out fails, drop the local session below.
    }
    finally
    {
      disconnectRealtime();
      setToken(null);
      user.value = null;
      void router.push("/login");
    }
  }

  return {
    user,
    ready,
    isAuthenticated,
    isAdmin,
    requiresConfirmation: isCognitoAuth,
    hydrate,
    login,
    signup,
    confirmSignup,
    logout,
  };
});
