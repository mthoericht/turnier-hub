import { fetchAuthMe, postAuthLogin, postAuthSignup } from "@/api/authApi";
import { getToken, setToken } from "@/api/http";
import type { AuthProvider } from "./authProvider";

/**
 * Local auth backend: talks to the server's `/api/auth/*` endpoints and stores
 * the HS256 token in `localStorage`. Used for development, tests, and the
 * legacy login path.
 */
export function createLocalAuthProvider(): AuthProvider
{
  return {
    requiresConfirmation: false,

    async login(email, password)
    {
      const res = await postAuthLogin(email, password);
      setToken(res.token);
      return res.user;
    },

    async signup(input)
    {
      const res = await postAuthSignup(input);
      setToken(res.token);
      return { status: "authenticated", user: res.user };
    },

    async confirmSignup()
    {
      // Local signup is immediate; no confirmation step exists.
    },

    async logout()
    {
      setToken(null);
    },

    async restore()
    {
      if (!getToken())
      {
        return null;
      }
      try
      {
        return await fetchAuthMe();
      }
      catch
      {
        setToken(null);
        return null;
      }
    },
  };
}
