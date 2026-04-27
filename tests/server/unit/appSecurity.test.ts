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
    // This test intentionally triggers CORS rejection; mute expected error log noise.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createApp();
    const response = await request(app)
      .options("/api/auth/login")
      .set("Origin", "https://not-allowed.example")
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Interner Serverfehler" });
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

    expect([413, 500]).toContain(response.status);
  });
});
