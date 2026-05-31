import type { PostConfirmationTriggerHandler } from "aws-lambda";
import { bootstrapSecretsIntoEnv } from "../../runtime/secrets.js";

/**
 * Resolve `DATABASE_URL` from Secrets Manager (RDS secret + proxy endpoint)
 * before importing `db.ts` — the Prisma client reads `DATABASE_URL` at
 * construction time. This top-level `await` runs once per container during the
 * Lambda init phase; locally/in tests it is a no-op.
 */
await bootstrapSecretsIntoEnv();
const { prisma } = await import("../../db.js");

const DEFAULT_SCHOOL_NAME = process.env.DEFAULT_SCHOOL_NAME?.trim() || "defaultSchool";

/**
 * Resolves the school id for a freshly confirmed Cognito user.
 *
 * Uses the `custom:schoolId` attribute when it points at an existing school;
 * otherwise falls back to the default school (created on demand). This mirrors
 * `ensureDefaultSchool`, but inlined to keep the trigger free of `config.ts`
 * (and its production env validation).
 */
async function resolveSchoolId(requested: string | undefined): Promise<string>
{
  if (requested)
  {
    const found = await prisma.school.findUnique({
      where: { id: requested },
      select: { id: true },
    });
    if (found)
    {
      return found.id;
    }
  }

  const fallback = await prisma.school.upsert({
    where: { name: DEFAULT_SCHOOL_NAME },
    create: { name: DEFAULT_SCHOOL_NAME },
    update: {},
    select: { id: true },
  });
  return fallback.id;
}

/**
 * Cognito **PostConfirmation** trigger.
 *
 * Replaces `prisma.user.create(...)` from the Express `signupHandler`: once a
 * user confirms their sign-up, the matching RDS `User` row is created (or
 * linked, if an email-matching row already exists) and tagged with the Cognito
 * `sub`. New users get the default `USER` role; roles remain Postgres-managed.
 *
 * Idempotent via an email upsert so repeated trigger invocations are safe.
 */
export const handler: PostConfirmationTriggerHandler = async (event) =>
{
  if (event.triggerSource !== "PostConfirmation_ConfirmSignUp")
  {
    return event;
  }

  const attrs = event.request.userAttributes;
  const cognitoSub = attrs.sub;
  const email = attrs.email?.trim().toLowerCase();
  const username = attrs.preferred_username?.trim().toLowerCase() || null;

  if (!cognitoSub || !email)
  {
    return event;
  }

  const schoolId = await resolveSchoolId(attrs["custom:schoolId"]);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      username,
      cognitoSub,
      schoolId,
    },
    update: {
      cognitoSub,
    },
  });

  return event;
};
