import type { PreSignUpTriggerHandler } from "aws-lambda";
import { bootstrapSecretsIntoEnv } from "../../runtime/secrets.js";

/**
 * Resolve the invite code from Secrets Manager into `process.env.INVITE_CODE`
 * during the Lambda init phase (no-op locally/in tests). The handler reads the
 * env var per invocation, so it is guaranteed to be populated by the time the
 * first sign-up arrives.
 */
await bootstrapSecretsIntoEnv();

/**
 * Cognito **PreSignUp** trigger.
 *
 * Replaces the invite-code gate that previously lived in the Express
 * `signupHandler`. The SPA passes the shared invite code via Cognito
 * `ClientMetadata.inviteCode`; sign-up is rejected unless it matches the
 * configured `INVITE_CODE`.
 *
 * Kept intentionally lean: it reads `process.env.INVITE_CODE` directly instead
 * of importing the server `config.ts` (which performs production env validation
 * for unrelated secrets).
 *
 * Account creation (the matching RDS `User` row) happens in the
 * **PostConfirmation** trigger, not here.
 */
export const handler: PreSignUpTriggerHandler = async (event) =>
{
  const expected = process.env.INVITE_CODE?.trim();
  const provided = event.request.clientMetadata?.inviteCode?.trim();

  if (!expected || !provided || provided !== expected)
  {
    throw new Error("Ungültiger Einladungscode");
  }

  return event;
};
