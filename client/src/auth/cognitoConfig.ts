import { Amplify } from "aws-amplify";

let configured = false;

/**
 * Configures Amplify Auth from `VITE_COGNITO_*` env once per session.
 *
 * Called lazily by the Cognito provider so the configuration (and any missing
 * env error) only matters when `VITE_AUTH_PROVIDER=cognito`.
 */
export function ensureAmplifyConfigured(): void
{
  if (configured)
  {
    return;
  }

  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID?.trim();
  const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID?.trim();

  if (!userPoolId || !userPoolClientId)
  {
    throw new Error(
      "VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID must be set when VITE_AUTH_PROVIDER=cognito"
    );
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
      },
    },
  });
  configured = true;
}
