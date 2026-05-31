import type { AuthUser } from "@turnier-hub/shared";

/** Fields collected by the signup form, shared by both auth backends. */
export type SignupInput = {
  username: string;
  email: string;
  password: string;
  inviteCode: string;
  schoolId: string;
};

/**
 * Outcome of a signup attempt:
 * - `authenticated`: the user is signed in immediately (local backend).
 * - `needsConfirmation`: an email confirmation code is required before sign-in
 *   (Cognito self sign-up).
 */
export type SignupResult =
  | { status: "authenticated"; user: AuthUser }
  | { status: "needsConfirmation"; email: string };

/**
 * Backend-agnostic authentication surface used by the `auth` store.
 *
 * Implementations encapsulate where tokens come from; both keep the access
 * token in the shared `http.ts` storage so REST + SSE transports stay unchanged.
 */
export interface AuthProvider
{
  /** Whether signup requires an explicit email-confirmation step. */
  readonly requiresConfirmation: boolean;
  login(email: string, password: string): Promise<AuthUser>;
  signup(input: SignupInput): Promise<SignupResult>;
  confirmSignup(email: string, code: string): Promise<void>;
  logout(): Promise<void>;
  /** Restores any existing session on app start; resolves `null` if none. */
  restore(): Promise<AuthUser | null>;
}

const providerMode = (import.meta.env.VITE_AUTH_PROVIDER ?? "local").trim().toLowerCase();

/** `true` when the SPA is configured to authenticate against AWS Cognito. */
export const isCognitoAuth = providerMode === "cognito";

let cached: Promise<AuthProvider> | null = null;

/**
 * Lazily resolves the configured auth provider. The Cognito implementation
 * (and the heavy `aws-amplify` dependency) is only imported in `cognito` mode,
 * so local/dev builds and tests never load it.
 */
export function getAuthProvider(): Promise<AuthProvider>
{
  if (!cached)
  {
    cached = isCognitoAuth
      ? import("./cognitoAuthProvider").then((m) => m.createCognitoAuthProvider())
      : import("./localAuthProvider").then((m) => m.createLocalAuthProvider());
  }
  return cached;
}
