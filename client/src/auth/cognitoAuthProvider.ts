import { fetchAuthMe } from "@/api/authApi";
import { setToken } from "@/api/http";
import { ensureAmplifyConfigured } from "./cognitoConfig";
import type { AuthProvider } from "./authProvider";

/**
 * Pulls the current Cognito access token into the shared `http.ts` storage so
 * REST + SSE transports keep reading it synchronously. `fetchAuthSession`
 * auto-refreshes expired tokens when a valid refresh token is present.
 */
async function syncAccessToken(): Promise<boolean>
{
  const { fetchAuthSession } = await import("aws-amplify/auth");
  const session = await fetchAuthSession();
  const token = session.tokens?.accessToken?.toString();
  if (token)
  {
    setToken(token);
    return true;
  }
  setToken(null);
  return false;
}

/**
 * AWS Cognito auth backend (production). Uses Amplify Auth for the credential
 * flow; the invite code travels as `clientMetadata.inviteCode` to the PreSignUp
 * trigger, and `custom:schoolId` / `preferred_username` as user attributes for
 * the PostConfirmation trigger. The user profile itself still comes from
 * `/api/auth/me` (Postgres), keeping roles server-managed.
 */
export function createCognitoAuthProvider(): AuthProvider
{
  ensureAmplifyConfigured();

  return {
    requiresConfirmation: true,

    async login(email, password)
    {
      const { signIn } = await import("aws-amplify/auth");
      await signIn({ username: email, password });
      await syncAccessToken();
      return fetchAuthMe();
    },

    async signup(input)
    {
      const { signUp } = await import("aws-amplify/auth");
      await signUp({
        username: input.email,
        password: input.password,
        options: {
          userAttributes: {
            email: input.email,
            preferred_username: input.username,
            "custom:schoolId": input.schoolId,
          },
          clientMetadata: { inviteCode: input.inviteCode },
        },
      });
      return { status: "needsConfirmation", email: input.email };
    },

    async confirmSignup(email, code)
    {
      const { confirmSignUp } = await import("aws-amplify/auth");
      await confirmSignUp({ username: email, confirmationCode: code });
    },

    async logout()
    {
      const { signOut } = await import("aws-amplify/auth");
      try
      {
        await signOut();
      }
      finally
      {
        setToken(null);
      }
    },

    async restore()
    {
      try
      {
        if (!(await syncAccessToken()))
        {
          return null;
        }
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
