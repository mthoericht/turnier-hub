import { api } from "@/api/http";
import type { AuthUser } from "@/types";

export type AuthLoginResponse = { token: string; user: AuthUser };

export type AuthSignupPayload = {
  username: string;
  email: string;
  password: string;
  inviteCode: string;
};

export async function fetchAuthMe(): Promise<AuthUser> 
{
  return api<AuthUser>("/api/auth/me");
}

export async function postAuthLogin(
  email: string,
  password: string
): Promise<AuthLoginResponse> 
{
  return api<AuthLoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
}

export async function postAuthSignup(
  payload: AuthSignupPayload
): Promise<AuthLoginResponse> 
{
  return api<AuthLoginResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}
