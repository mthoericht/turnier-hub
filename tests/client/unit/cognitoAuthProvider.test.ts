import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signIn = vi.fn();
const signUp = vi.fn();
const confirmSignUp = vi.fn();
const signOut = vi.fn();
const fetchAuthSession = vi.fn();

vi.mock("aws-amplify/auth", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
  signUp: (...args: unknown[]) => signUp(...args),
  confirmSignUp: (...args: unknown[]) => confirmSignUp(...args),
  signOut: (...args: unknown[]) => signOut(...args),
  fetchAuthSession: (...args: unknown[]) => fetchAuthSession(...args),
}));

const fetchAuthMe = vi.fn();
vi.mock("../../../client/src/api/authApi", () => ({
  fetchAuthMe: (...args: unknown[]) => fetchAuthMe(...args),
}));

const setToken = vi.fn();
vi.mock("../../../client/src/api/http", () => ({
  setToken: (...args: unknown[]) => setToken(...args),
}));

const ensureAmplifyConfigured = vi.fn();
vi.mock("../../../client/src/auth/cognitoConfig", () => ({
  ensureAmplifyConfigured: () => ensureAmplifyConfigured(),
}));

import { createCognitoAuthProvider } from "../../../client/src/auth/cognitoAuthProvider";

/** Builds an Amplify session whose access token toString()s to `token`. */
function sessionWithToken(token: string | null)
{
  return token === null
    ? { tokens: undefined }
    : { tokens: { accessToken: { toString: () => token } } };
}

const ME = { id: "u-1", email: "user@example.com", role: "user" as const };

describe("cognitoAuthProvider", () =>
{
  beforeEach(() =>
  {
    signIn.mockReset();
    signUp.mockReset();
    confirmSignUp.mockReset();
    signOut.mockReset();
    fetchAuthSession.mockReset();
    fetchAuthMe.mockReset().mockResolvedValue(ME);
    setToken.mockReset();
    ensureAmplifyConfigured.mockReset();
  });

  afterEach(() =>
  {
    vi.clearAllMocks();
  });

  it("configures Amplify when created", () =>
  {
    createCognitoAuthProvider();
    expect(ensureAmplifyConfigured).toHaveBeenCalledOnce();
  });

  it("signs in, mirrors the access token, and returns the /me profile", async () =>
  {
    fetchAuthSession.mockResolvedValue(sessionWithToken("access-token"));
    const provider = createCognitoAuthProvider();

    const user = await provider.login("user@example.com", "pw");

    expect(signIn).toHaveBeenCalledWith({ username: "user@example.com", password: "pw" });
    expect(setToken).toHaveBeenCalledWith("access-token");
    expect(user).toEqual(ME);
  });

  it("passes the invite code as clientMetadata and attributes during signup", async () =>
  {
    const provider = createCognitoAuthProvider();

    const result = await provider.signup({
      email: "new@example.com",
      password: "pw",
      username: "newuser",
      schoolId: "school-1",
      inviteCode: "invite-123",
    });

    expect(signUp).toHaveBeenCalledWith({
      username: "new@example.com",
      password: "pw",
      options: {
        userAttributes: {
          email: "new@example.com",
          preferred_username: "newuser",
          "custom:schoolId": "school-1",
        },
        clientMetadata: { inviteCode: "invite-123" },
      },
    });
    expect(result).toEqual({ status: "needsConfirmation", email: "new@example.com" });
  });

  it("confirms a signup with the verification code", async () =>
  {
    const provider = createCognitoAuthProvider();
    await provider.confirmSignup("new@example.com", "123456");
    expect(confirmSignUp).toHaveBeenCalledWith({
      username: "new@example.com",
      confirmationCode: "123456",
    });
  });

  it("clears the local token on logout", async () =>
  {
    signOut.mockResolvedValue(undefined);
    const provider = createCognitoAuthProvider();
    await provider.logout();
    expect(signOut).toHaveBeenCalledOnce();
    expect(setToken).toHaveBeenCalledWith(null);
  });

  it("restores the profile when a session token exists", async () =>
  {
    fetchAuthSession.mockResolvedValue(sessionWithToken("restored-token"));
    const provider = createCognitoAuthProvider();

    const user = await provider.restore();

    expect(setToken).toHaveBeenCalledWith("restored-token");
    expect(user).toEqual(ME);
  });

  it("returns null from restore when no session token is present", async () =>
  {
    fetchAuthSession.mockResolvedValue(sessionWithToken(null));
    const provider = createCognitoAuthProvider();

    const user = await provider.restore();

    expect(setToken).toHaveBeenCalledWith(null);
    expect(fetchAuthMe).not.toHaveBeenCalled();
    expect(user).toBeNull();
  });
});
