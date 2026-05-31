import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context, PreSignUpTriggerEvent } from "aws-lambda";

const { handler } = await import(
  "../../../server/src/lambda/cognito/preSignUp.js"
);

const noopContext = {} as Context;
const noopCallback = (() => undefined) as never;

/**
 * Builds a minimal Cognito PreSignUp event. `inviteCode === undefined` omits
 * the `ClientMetadata` block entirely (no metadata sent by the SPA).
 */
function makeEvent(inviteCode?: string): PreSignUpTriggerEvent
{
  return {
    request: {
      clientMetadata: inviteCode === undefined ? undefined : { inviteCode },
      userAttributes: { email: "user@example.com" },
    },
    response: {},
  } as unknown as PreSignUpTriggerEvent;
}

async function invoke(event: PreSignUpTriggerEvent): Promise<PreSignUpTriggerEvent>
{
  return (await handler(event, noopContext, noopCallback)) as PreSignUpTriggerEvent;
}

describe("Cognito PreSignUp trigger (invite-code gate)", () =>
{
  beforeEach(() =>
  {
    vi.stubEnv("INVITE_CODE", "valid-invite-code");
  });

  afterEach(() =>
  {
    vi.unstubAllEnvs();
  });

  it("passes through when the invite code matches", async () =>
  {
    const event = makeEvent("valid-invite-code");
    await expect(invoke(event)).resolves.toBe(event);
  });

  it("trims surrounding whitespace before comparing", async () =>
  {
    const event = makeEvent("  valid-invite-code  ");
    await expect(invoke(event)).resolves.toBe(event);
  });

  it("rejects a wrong invite code", async () =>
  {
    await expect(invoke(makeEvent("nope"))).rejects.toThrow("Ungültiger Einladungscode");
  });

  it("rejects when no invite code is provided", async () =>
  {
    await expect(invoke(makeEvent())).rejects.toThrow("Ungültiger Einladungscode");
  });

  it("rejects when no INVITE_CODE is configured", async () =>
  {
    vi.stubEnv("INVITE_CODE", "");
    await expect(invoke(makeEvent("anything"))).rejects.toThrow("Ungültiger Einladungscode");
  });
});
