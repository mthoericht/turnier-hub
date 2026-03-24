export const TOKEN_KEY = "turnier_hub_token";

export function getToken(): string | null 
{
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void 
{
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function parseError(res: Response): Promise<string> 
{
  const text = await res.text();
  try 
  {
    const j = JSON.parse(text) as { error?: string };
    return j.error ?? (text || res.statusText);
  }
  catch 
  {
    return text || res.statusText;
  }
}

export async function api<T>(
  path: string,
  init?: RequestInit & { skipAuth?: boolean }
): Promise<T> 
{
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body != null) 
  {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token && !init?.skipAuth) 
  {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 && !init?.skipAuth) 
  {
    setToken(null);
  }
  if (res.status === 204) 
  {
    return undefined as T;
  }
  if (!res.ok) 
  {
    throw new Error(await parseError(res));
  }
  const ct = res.headers.get("content-type");
  if (ct?.includes("application/json")) 
  {
    return (await res.json()) as T;
  }
  return undefined as T;
}
