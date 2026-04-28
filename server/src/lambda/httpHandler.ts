import serverlessExpress from "serverless-http";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";
import { createApp } from "../app.js";

/**
 * The Express application wrapped for Lambda Function URL invocation.
 *
 * `createApp()` returns a fresh Express instance with the same routes and
 * middleware used by the legacy single-VM deployment, including the realtime
 * `RealtimeEventBus` that powers `notify*` helpers from route handlers. The
 * SSE endpoint (`GET /api/sse`) is intentionally **not** routed through this
 * Lambda — see `sseHandler.ts` for the streaming handler.
 *
 * The wrapped handler is reused across warm invocations of the same Lambda
 * container, so the Express app, Prisma client, and any internal singletons
 * are initialized once per container.
 */
const wrappedHandler = serverlessExpress(createApp());

/**
 * Lambda Function URL entry point for the REST/HTTP surface.
 *
 * Maps an API Gateway v2-shaped Function URL event to a Node.js
 * `http.IncomingMessage` / `http.ServerResponse` pair via `serverless-http`,
 * letting Express run unchanged inside Lambda. CloudFront fronts the Function
 * URL with OAC + `AuthType: AWS_IAM`; application-level auth (JWT) stays in
 * the Express middleware stack.
 */
export const handler = async (
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyStructuredResultV2> =>
{
  // serverless-http returns a structured result compatible with Function URL
  // (and API Gateway HTTP API v2) responses.
  return wrappedHandler(event, context) as Promise<APIGatewayProxyStructuredResultV2>;
};
