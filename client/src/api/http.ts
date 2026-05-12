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
  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });
  if (res.status === 401 && !init?.skipAuth)
  {
    /* Session missing or expired — caller may redirect via Authelia at the edge. */
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
