import type { APIGatewayProxyEventV2 } from "aws-lambda";
import {
  authenticateSseToken,
  parseSseQuery,
  startSseStream,
} from "../realtime/sseEndpoint.js";
import { setRealtimeEventBus } from "../realtime/notify.js";
import { resolveRealtimeBus } from "../runtime/runtimeAdapters.js";

/**
 * Per-container bus instance.
 *
 * Selected via `EVENT_BUS` env (`memory` by default, `dynamo` in AWS Phase 5).
 * This allows the same handler to work in local SAM and in multi-lambda
 * fan-out mode once `DynamoEventBus` is enabled.
 */
const bus = resolveRealtimeBus();
setRealtimeEventBus(bus);

/**
 * Writes a JSON error body and ends the stream.
 *
 * Uses `awslambda.HttpResponseStream.from` so CloudFront / browsers see a
 * proper non-200 status when authentication fails before the SSE stream
 * begins.
 */
function rejectWithStatus(
  responseStream: awslambda.ResponseStream,
  statusCode: number,
  errorMessage: string,
): void
{
  const headed = awslambda.HttpResponseStream.from(responseStream, {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
  headed.write(JSON.stringify({ error: errorMessage }));
  headed.end();
}

/**
 * Lambda streaming handler for `GET /api/sse`.
 *
 * Wires the auth + parse + bus-subscribe pipeline of the Express SSE handler
 * into a Lambda Function URL configured with `InvokeMode: RESPONSE_STREAM`.
 * The runtime's `awslambda.streamifyResponse` allows long-lived chunked
 * responses (up to the Lambda 15-minute limit), after which the browser's
 * `EventSource` automatically reconnects.
 */
export const handler = awslambda.streamifyResponse(async (
  event: APIGatewayProxyEventV2,
  responseStream: awslambda.ResponseStream,
): Promise<void> =>
{
  const parsed = parseSseQuery(event.queryStringParameters ?? {});
  if (parsed.kind !== "ok")
  {
    rejectWithStatus(responseStream, 400, "Ungültige Anfrage");
    return;
  }

  const userId = await authenticateSseToken(parsed.token);
  if (!userId)
  {
    rejectWithStatus(responseStream, 401, "Nicht autorisiert");
    return;
  }

  const sseStream = awslambda.HttpResponseStream.from(responseStream, {
    statusCode: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });

  await new Promise<void>((resolve) =>
  {
    const cleanup = startSseStream({
      bus,
      tournamentIds: parsed.tournamentIds,
      write: (chunk) =>
      {
        sseStream.write(chunk);
      },
      onClose: (cleanupHandler) =>
      {
        sseStream.on("close", cleanupHandler);
        sseStream.on("error", cleanupHandler);
      },
    });

    const finish = (): void =>
    {
      cleanup();
      resolve();
    };

    sseStream.on("close", finish);
    sseStream.on("error", finish);
  });
});
