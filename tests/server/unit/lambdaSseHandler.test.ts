import { afterEach, describe, expect, it, vi } from "vitest";
import { PassThrough } from "node:stream";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

/**
 * Tracks every `HttpResponseStream.from(stream, metadata)` invocation so each
 * test can assert on the status code, headers, and emitted body produced by
 * the SSE Lambda handler.
 */
type StreamInvocation = {
  metadata: { statusCode?: number; headers?: Record<string, string> };
  body: string;
};

const invocations: StreamInvocation[] = [];

/**
 * Mock Prisma so token-version checks resolve without a real database.
 * Returning `null` simulates a deleted user → the handler should answer 401.
 */
const mockFindUnique = vi.fn().mockResolvedValue({ id: "u-1", tokenVersion: 0 });

vi.mock("../../../server/src/db.js", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

/**
 * The most recent stream handed to the streaming SSE handler — exposed so
 * tests can drive the close lifecycle (which the handler awaits before
 * resolving its top-level Promise).
 */
let latestStream: PassThrough | null = null;

/**
 * Replace the runtime-provided `awslambda` global with a minimal stub so we
 * can drive the streaming handler purely from Vitest. Calling `from` returns
 * the same stream after recording the metadata; tests then read the resulting
 * body via the captured `StreamInvocation`.
 *
 * This must run **before** the `await import(...)` below — the SSE Lambda
 * module references `awslambda.streamifyResponse` at module top level.
 */
(globalThis as unknown as { awslambda: unknown }).awslambda = {
  HttpResponseStream: {
    from(stream: PassThrough, metadata: StreamInvocation["metadata"])
    {
      const invocation: StreamInvocation = { metadata, body: "" };
      invocations.push(invocation);
      stream.on("data", (chunk: Buffer) =>
      {
        invocation.body += chunk.toString("utf8");
      });
      return stream;
    },
  },
  streamifyResponse<TEvent, TResult>(
    handler: (event: TEvent, stream: PassThrough, context: unknown) => Promise<TResult>
  ): (event: TEvent, context: unknown) => Promise<TResult>
  {
    return async (event, context) =>
    {
      const stream = new PassThrough();
      latestStream = stream;
      return handler(event, stream, context);
    };
  },
};

afterEach(() =>
{
  invocations.length = 0;
  latestStream = null;
});

const { handler } = await import("../../../server/src/lambda/sseHandler.js");
const { signToken } = await import("../../../server/src/auth/token.js");

function makeEvent(query: Record<string, string>): APIGatewayProxyEventV2
{
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: "/api/sse",
    rawQueryString: new URLSearchParams(query).toString(),
    headers: {},
    queryStringParameters: query,
    requestContext: {
      accountId: "123456789012",
      apiId: "test",
      domainName: "sse.lambda-url.eu-central-1.on.aws",
      domainPrefix: "sse",
      http: {
        method: "GET",
        path: "/api/sse",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest",
      },
      requestId: "sse-request",
      routeKey: "$default",
      stage: "$default",
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
  };
}

describe("Lambda SSE handler (streaming Function URL)", () =>
{
  it("rejects requests without a token (400 JSON body)", async () =>
  {
    await handler(makeEvent({}), {});

    expect(invocations).toHaveLength(1);
    const invocation = invocations[0]!;
    expect(invocation.metadata.statusCode).toBe(400);
    expect(JSON.parse(invocation.body)).toMatchObject({ error: expect.any(String) });
  });

  it("rejects requests with an invalid token (401)", async () =>
  {
    mockFindUnique.mockResolvedValueOnce(null);
    const token = signToken("user-deleted", 0);

    await handler(makeEvent({ token }), {});

    expect(invocations).toHaveLength(1);
    expect(invocations[0]!.metadata.statusCode).toBe(401);
  });

  it("opens a 200 text/event-stream response and writes the connect comment", async () =>
  {
    mockFindUnique.mockResolvedValueOnce({ id: "u-1", tokenVersion: 0 });
    const token = signToken("u-1", 0);

    // The handler awaits the response stream's `close` event; drive it from
    // the test once the initial frames have been flushed.
    const pending = handler(makeEvent({ token, tournaments: "t1" }), {});
    await new Promise((r) => setTimeout(r, 20));
    latestStream?.emit("close");
    await pending;

    expect(invocations).toHaveLength(1);
    const invocation = invocations[0]!;
    expect(invocation.metadata.statusCode).toBe(200);
    expect(invocation.metadata.headers).toMatchObject({
      "Content-Type": expect.stringContaining("text/event-stream"),
      "Cache-Control": expect.stringContaining("no-cache"),
    });
    expect(invocation.body).toContain(": connected");
  });
});
