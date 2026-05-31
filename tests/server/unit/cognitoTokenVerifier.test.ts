import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mockable JWKS verification result for the Cognito access-token path. */
const verifyMock = vi.fn();
const findUnique = vi.fn();

vi.mock("aws-jwt-verify", () => ({
  CognitoJwtVerifier: {
    create: vi.fn(() => ({ verify: (...args: unknown[]) => verifyMock(...args) })),
  },
}));

vi.mock("../../../server/src/db.js", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => findUnique(...args) },
  },
}));

/** Imports the verifier module with `AUTH_VERIFIER=cognito` active. */
async function importCognitoVerifier()
{
  vi.resetModules();
  vi.stubEnv("AUTH_VERIFIER", "cognito");
  vi.stubEnv("COGNITO_USER_POOL_ID", "eu-central-1_test");
  vi.stubEnv("COGNITO_CLIENT_ID", "client-abc");
  const mod = await import("../../../server/src/auth/tokenVerifier.js");
  mod.setTokenVerifierForTests(null);
  return mod;
}

describe("CognitoTokenVerifier", () =>
{
  beforeEach(() =>
  {
    verifyMock.mockReset();
    findUnique.mockReset();
  });

  afterEach(() =>
  {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("maps a verified access token to the internal user via cognitoSub", async () =>
  {
    verifyMock.mockResolvedValue({ sub: "cognito-sub-1" });
    findUnique.mockResolvedValue({ id: "u-1", role: "ADMIN" });

    const { getTokenVerifier } = await importCognitoVerifier();
    const identity = await getTokenVerifier().verify("access-token");

    expect(verifyMock).toHaveBeenCalledWith("access-token");
    expect(findUnique).toHaveBeenCalledWith({
      where: { cognitoSub: "cognito-sub-1" },
      select: { id: true, role: true },
    });
    expect(identity).toEqual({ userId: "u-1", role: "ADMIN" });
  });

  it("returns null when no internal user matches the cognitoSub", async () =>
  {
    verifyMock.mockResolvedValue({ sub: "unknown-sub" });
    findUnique.mockResolvedValue(null);

    const { getTokenVerifier } = await importCognitoVerifier();
    await expect(getTokenVerifier().verify("access-token")).resolves.toBeNull();
  });

  it("returns null when JWKS verification fails", async () =>
  {
    verifyMock.mockRejectedValue(new Error("invalid signature"));

    const { getTokenVerifier } = await importCognitoVerifier();
    await expect(getTokenVerifier().verify("bad-token")).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
