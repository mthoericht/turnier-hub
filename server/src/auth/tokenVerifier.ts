import jwt from "jsonwebtoken";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { prisma } from "../db.js";
import {
  AUTH_VERIFIER,
  COGNITO_CLIENT_ID,
  COGNITO_USER_POOL_ID,
  JWT_SECRET,
} from "../config.js";
import type { AuthPayload } from "./token.js";

/** Resolved, application-level identity behind a verified bearer token. */
export type AuthIdentity = {
  userId: string;
  role: "ADMIN" | "USER";
};

/**
 * Verifies a bearer/SSE token and resolves it to an internal user identity.
 *
 * Implementations encapsulate both the cryptographic verification and the
 * strategy used to map the token to a Postgres `User` row, so callers
 * (HTTP middleware, SSE endpoint) stay backend-agnostic.
 */
export interface TokenVerifier
{
  verify(token: string): Promise<AuthIdentity | null>;
}

/**
 * Local HS256 verifier — used for development, tests, and the legacy login
 * path. Tokens carry the internal user id (`sub`) plus a `tokenVersion` (`tv`)
 * that must match the stored value (session revocation).
 */
class LocalTokenVerifier implements TokenVerifier
{
  public async verify(token: string): Promise<AuthIdentity | null>
  {
    try
    {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { id: true, role: true, tokenVersion: true },
      });
      if (!user)
      {
        return null;
      }
      if ((decoded.tv ?? 0) !== user.tokenVersion)
      {
        return null;
      }
      return { userId: user.id, role: user.role };
    }
    catch
    {
      return null;
    }
  }
}

/**
 * AWS Cognito verifier — used in production. Validates the access token against
 * the user pool JWKS (cached by `aws-jwt-verify`) and maps the Cognito `sub` to
 * the internal user via `User.cognitoSub`. Roles stay Postgres-managed.
 */
class CognitoTokenVerifier implements TokenVerifier
{
  private readonly verifier: ReturnType<typeof CognitoJwtVerifier.create>;

  public constructor(userPoolId: string, clientId: string)
  {
    this.verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: "access",
      clientId,
    });
  }

  public async verify(token: string): Promise<AuthIdentity | null>
  {
    try
    {
      const payload = await this.verifier.verify(token);
      const user = await prisma.user.findUnique({
        where: { cognitoSub: payload.sub },
        select: { id: true, role: true },
      });
      if (!user)
      {
        return null;
      }
      return { userId: user.id, role: user.role };
    }
    catch
    {
      return null;
    }
  }
}

let cachedVerifier: TokenVerifier | null = null;

function createVerifier(): TokenVerifier
{
  if (AUTH_VERIFIER === "cognito")
  {
    if (!COGNITO_USER_POOL_ID || !COGNITO_CLIENT_ID)
    {
      throw new Error(
        "COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set when AUTH_VERIFIER=cognito"
      );
    }
    return new CognitoTokenVerifier(COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID);
  }
  return new LocalTokenVerifier();
}

/**
 * Returns the process-wide token verifier, constructing it lazily from config
 * on first use (so the Cognito JWKS client is only created in `cognito` mode).
 */
export function getTokenVerifier(): TokenVerifier
{
  if (!cachedVerifier)
  {
    cachedVerifier = createVerifier();
  }
  return cachedVerifier;
}

/**
 * Test seam: swaps the active verifier (pass `null` to rebuild from config on
 * the next `getTokenVerifier()` call).
 */
export function setTokenVerifierForTests(instance: TokenVerifier | null): void
{
  cachedVerifier = instance;
}
