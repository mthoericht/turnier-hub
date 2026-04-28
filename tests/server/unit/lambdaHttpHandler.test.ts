import { describe, expect, it, vi } from "vitest";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";

/**
 * Avoid touching the real Prisma client during the handler boot. The smoke
 * tests below never reach a route that queries the database, but importing
 * `createApp()` transitively imports `db.ts`.
 */
vi.mock("../../../server/src/db.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

const { handler } = await import("../../../server/src/lambda/httpHandler.js");

function makeFunctionUrlEvent(overrides: {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}): APIGatewayProxyEventV2
{
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: overrides.path,
    rawQueryString: "",
    headers: overrides.headers ?? {},
    requestContext: {
      accountId: "123456789012",
      apiId: "test",
      domainName: "test.lambda-url.eu-central-1.on.aws",
      domainPrefix: "test",
      http: {
        method: overrides.method,
        path: overrides.path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest",
      },
      requestId: "test-request",
      routeKey: "$default",
      stage: "$default",
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    body: overrides.body,
    isBase64Encoded: false,
  };
}

const noopContext = {} as Context;

describe("Lambda HTTP handler (Function URL wrapper)", () =>
{
  it("rejects /api/auth/me without an Authorization header (401)", async () =>
  {
    const result = (await handler(
      makeFunctionUrlEvent({ method: "GET", path: "/api/auth/me" }),
      noopContext
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(401);
    expect(typeof result.body).toBe("string");
    expect(JSON.parse(String(result.body))).toMatchObject({
      error: expect.any(String),
    });
  });

  it("returns 404 for unknown /api routes (handled by Express fallback)", async () =>
  {
    const result = (await handler(
      makeFunctionUrlEvent({ method: "GET", path: "/api/does-not-exist" }),
      noopContext
    )) as APIGatewayProxyStructuredResultV2;

    expect(result.statusCode).toBe(404);
  });

  it("emits security headers on 4xx responses", async () =>
  {
    const result = (await handler(
      makeFunctionUrlEvent({ method: "GET", path: "/api/does-not-exist" }),
      noopContext
    )) as APIGatewayProxyStructuredResultV2;

    const headers = result.headers ?? {};
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
  });
});
