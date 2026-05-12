/**
 * Wraps `fetch` so same-origin API calls include `Remote-User` (Authelia-style)
 * and cookies (`credentials: "include"`) for integration tests.
 * Optional `extraHeaders` (e.g. `Remote-Groups`) are merged for Authelia-style tests.
 */
export function wrapFetchForTestApi(
  originalFetch: typeof fetch,
  apiBaseUrl: string,
  remoteUser: string,
  extraHeaders?: Record<string, string>,
): typeof fetch
{
  return ((input: RequestInfo | URL, init?: RequestInit) =>
  {
    const headers = new Headers(init?.headers);
    headers.set("Remote-User", remoteUser);
    if (extraHeaders)
    {
      for (const [key, value] of Object.entries(extraHeaders))
      {
        headers.set(key, value);
      }
    }
    const nextInit: RequestInit = { ...init, headers, credentials: "include" };
    if (typeof input === "string" && input.startsWith("/"))
    {
      return originalFetch(`${apiBaseUrl}${input}`, nextInit);
    }
    if (input instanceof URL && input.pathname.startsWith("/"))
    {
      return originalFetch(
        new URL(`${apiBaseUrl}${input.pathname}${input.search}`),
        nextInit,
      );
    }
    return originalFetch(input as RequestInfo, nextInit);
  }) as typeof fetch;
}
