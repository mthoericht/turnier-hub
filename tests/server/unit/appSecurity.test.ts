import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../server/src/app.js";
import { CORS_ALLOWED_ORIGINS } from "../../../server/src/config.js";

describe("app security middleware", () =>
{
  afterEach(() =>
  {
    vi.restoreAllMocks();
  });

  it("applies baseline helmet response headers", async () =>
  {
    const app = createApp();
    const response = await request(app).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["x-dns-prefetch-control"]).toBe("off");
    expect(response.headers["x-download-options"]).toBe("noopen");
  });

  it("allows configured CORS origins", async () =>
  {
    const allowedOrigin = CORS_ALLOWED_ORIGINS[0];
    expect(allowedOrigin).toBeTruthy();

    const app = createApp();
    const response = await request(app)
      .options("/api/auth/login")
      .set("Origin", allowedOrigin!)
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(allowedOrigin);
  });

  it("rejects disallowed CORS origins", async () =>
  {
    const app = createApp();
    const response = await request(app)
      .options("/api/auth/login")
      .set("Origin", "https://not-allowed.example")
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(403);
  });

  it("enforces JSON request body size limits", async () =>
  {
    // This test intentionally triggers body-parser size errors; mute expected error log noise.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createApp();
    const tooLargePayload = {
      email: "large-body@example.com",
      password: "x".repeat(200_000),
    };
    const response = await request(app)
      .post("/api/auth/login")
      .send(tooLargePayload);

    expect(response.status).toBe(413);
  });

  it("does not leak stack traces on internal errors", async () =>
  {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createApp();

    // Trigger an internal error by sending a malformed content-type body.
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("not-json{{{");

    // The response should be a clean error without stack/details.
    expect(response.body).not.toHaveProperty("stack");
    expect(response.body).not.toHaveProperty("message");
  });
});
