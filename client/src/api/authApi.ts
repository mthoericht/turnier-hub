import { api } from "./http";
import type { AuthUser } from "@turnier-hub/shared";

export type AuthLoginResponse = { token: string; user: AuthUser };

export type AuthSignupPayload = {
  username: string;
  email: string;
  password: string;
  inviteCode: string;
  schoolId: string;
};

export type AuthSchoolOption = {
  id: string;
  name: string;
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

export async function fetchAuthSchools(): Promise<AuthSchoolOption[]>
{
  return api<AuthSchoolOption[]>("/api/auth/schools", {
    skipAuth: true,
  });
}
