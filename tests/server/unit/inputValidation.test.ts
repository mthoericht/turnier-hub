import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../../server/src/app.js";
import { classNameSchema, idSchema, mediumNameSchema } from "../../../server/src/lib/validation.js";

describe("input validation after the Zod upgrade", () =>
{
  it("preserves trimmed Unicode names and existing length boundaries", () =>
  {
    expect(mediumNameSchema.parse("  Müller & Söhne  ")).toBe("Müller & Söhne");
    expect(classNameSchema.safeParse("a".repeat(40)).success).toBe(true);
    expect(classNameSchema.safeParse("a".repeat(41)).success).toBe(false);
    expect(idSchema.safeParse("   ").success).toBe(false);
    expect(mediumNameSchema.safeParse("<script>").success).toBe(false);
  });

  it("rejects unknown fields and wrong scalar types with the existing German errors", async () =>
  {
    const app = createApp();
    for (const body of [
      { name: "10a", admin: true },
      { name: ["10a"] },
      { name: null },
    ])
    {
      const response = await request(app).post("/api/classes").send(body);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Ungültige Eingaben" });
    }
  });

  it("rejects malformed import rows and unsupported tournament modes before persistence", async () =>
  {
    const app = createApp();
    for (const rows of [[], [{ firstName: "Anna", lastName: "Muster" }], [{ firstName: 7, lastName: "Muster", className: "10a" }]])
    {
      const response = await request(app).post("/api/players/import").send({ mode: "append", rows });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Ungültige Importdaten" });
    }
    const response = await request(app).post("/api/tournaments").send({ name: "Test", sport: "Fußball", mode: "UNKNOWN" });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Ungültige Eingaben" });
  });
});
