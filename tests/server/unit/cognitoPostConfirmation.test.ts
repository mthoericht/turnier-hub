import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context, PostConfirmationTriggerEvent } from "aws-lambda";

const userUpsert = vi.fn();
const schoolFindUnique = vi.fn();
const schoolUpsert = vi.fn();

/**
 * `postConfirmation.ts` dynamically imports `db.js` after the secret bootstrap;
 * mocking the module keeps the trigger off a real database.
 */
vi.mock("../../../server/src/db.js", () => ({
  prisma: {
    user: { upsert: (...args: unknown[]) => userUpsert(...args) },
    school: {
      findUnique: (...args: unknown[]) => schoolFindUnique(...args),
      upsert: (...args: unknown[]) => schoolUpsert(...args),
    },
  },
}));

const { handler } = await import(
  "../../../server/src/lambda/cognito/postConfirmation.js"
);

const noopContext = {} as Context;
const noopCallback = (() => undefined) as never;

function makeEvent(
  userAttributes: Record<string, string>,
  triggerSource = "PostConfirmation_ConfirmSignUp"
): PostConfirmationTriggerEvent
{
  return {
    triggerSource,
    request: { userAttributes },
    response: {},
  } as unknown as PostConfirmationTriggerEvent;
}

async function invoke(event: PostConfirmationTriggerEvent): Promise<PostConfirmationTriggerEvent>
{
  return (await handler(event, noopContext, noopCallback)) as PostConfirmationTriggerEvent;
}

describe("Cognito PostConfirmation trigger (RDS user provisioning)", () =>
{
  beforeEach(() =>
  {
    userUpsert.mockReset().mockResolvedValue({ id: "u-1" });
    schoolFindUnique.mockReset();
    schoolUpsert.mockReset();
  });

  afterEach(() =>
  {
    vi.unstubAllEnvs();
  });

  it("links an existing requested school and upserts the user by email", async () =>
  {
    schoolFindUnique.mockResolvedValue({ id: "school-1" });

    await invoke(makeEvent({
      sub: "cognito-sub-123",
      email: "  USER@Example.COM ",
      preferred_username: "JohnDoe",
      "custom:schoolId": "school-1",
    }));

    expect(schoolFindUnique).toHaveBeenCalledWith({
      where: { id: "school-1" },
      select: { id: true },
    });
    expect(schoolUpsert).not.toHaveBeenCalled();
    expect(userUpsert).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
      create: {
        email: "user@example.com",
        username: "johndoe",
        cognitoSub: "cognito-sub-123",
        schoolId: "school-1",
      },
      update: { cognitoSub: "cognito-sub-123" },
    });
  });

  it("falls back to the default school when no valid school is requested", async () =>
  {
    schoolUpsert.mockResolvedValue({ id: "default-school" });

    await invoke(makeEvent({
      sub: "sub-2",
      email: "nobody@example.com",
    }));

    expect(schoolFindUnique).not.toHaveBeenCalled();
    expect(schoolUpsert).toHaveBeenCalledWith({
      where: { name: "defaultSchool" },
      create: { name: "defaultSchool" },
      update: {},
      select: { id: true },
    });
    expect(userUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: "nobody@example.com" },
      create: expect.objectContaining({ username: null, schoolId: "default-school" }),
    }));
  });

  it("falls back to the default school when the requested school is unknown", async () =>
  {
    schoolFindUnique.mockResolvedValue(null);
    schoolUpsert.mockResolvedValue({ id: "default-school" });

    await invoke(makeEvent({
      sub: "sub-3",
      email: "ghost@example.com",
      "custom:schoolId": "missing",
    }));

    expect(schoolFindUnique).toHaveBeenCalledWith({
      where: { id: "missing" },
      select: { id: true },
    });
    expect(schoolUpsert).toHaveBeenCalled();
    expect(userUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ schoolId: "default-school" }),
    }));
  });

  it("ignores non-confirm trigger sources", async () =>
  {
    const event = makeEvent(
      { sub: "x", email: "x@example.com" },
      "PostConfirmation_ConfirmForgotPassword"
    );
    await expect(invoke(event)).resolves.toBe(event);
    expect(userUpsert).not.toHaveBeenCalled();
  });

  it("skips provisioning when sub or email is missing", async () =>
  {
    await invoke(makeEvent({ sub: "only-sub" }));
    expect(userUpsert).not.toHaveBeenCalled();
  });
});
