/**
 * Ambient declarations for the `awslambda` runtime helpers.
 *
 * The Lambda Node.js managed runtime injects an `awslambda` global with the
 * `streamifyResponse` helper and `HttpResponseStream.from` factory. There is
 * no official `@types` package for these helpers yet, so we mirror the parts
 * we use here.
 *
 * Reference:
 * https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html
 *
 * This file is an **ambient script** (no top-level imports/exports), so the
 * `declare global` block applies project-wide without consumers needing to
 * import it explicitly.
 */

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace awslambda
{
  /**
   * Optional metadata used by `HttpResponseStream.from` to prepend an HTTP
   * status line and headers to the response stream.
   */
  type HttpResponseMetadata = {
    statusCode?: number;
    headers?: Record<string, string>;
    cookies?: string[];
  };

  /**
   * The writable stream Lambda hands to a streamifying handler. We model only
   * the methods/events used by the SSE handler.
   */
  interface ResponseStream
  {
    write(chunk: string | Uint8Array): boolean;
    end(): void;
    on(event: "close", listener: () => void): this;
    on(event: "error", listener: (err: unknown) => void): this;
    setContentType?(contentType: string): void;
  }

  /**
   * Wraps a streamified Lambda response with HTTP status + headers metadata.
   */
  interface HttpResponseStreamHelper
  {
    from(stream: ResponseStream, metadata: HttpResponseMetadata): ResponseStream;
  }

  /** Per-runtime singleton offering the `from` factory. */
  const HttpResponseStream: HttpResponseStreamHelper;

  /**
   * Wraps a Lambda handler so it returns its body via a streaming response.
   * The wrapped handler signature gains a `responseStream` second argument;
   * the runtime calls the original `event` callback shape with the stream
   * positioned to receive the body.
   */
  function streamifyResponse<TEvent, TResult = void>(
    handler: (
      event: TEvent,
      responseStream: ResponseStream,
      context: unknown,
    ) => Promise<TResult>,
  ): (event: TEvent, context: unknown) => Promise<TResult>;
}
