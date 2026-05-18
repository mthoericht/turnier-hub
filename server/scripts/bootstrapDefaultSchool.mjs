// Idempotent: ensure a "default" School row exists with the configured
// id + name, so the production DEFAULT_SCHOOL_ID lookup always finds a row.
//
// Designed to run as a Nomad prestart task in the production image, after
// `prisma db push` has created the schema. Plain Node ESM (no tsx needed),
// uses the generated Prisma client from the runtime image's node_modules.
//
// Required env:
//   DATABASE_URL          mysql://user:pass@host:port/db
//   DEFAULT_SCHOOL_ID     stable string used as School.id (operator owned)
//   DEFAULT_SCHOOL_NAME   human-readable unique name (defaults to "defaultSchool")

import { PrismaClient } from "@prisma/client";

function requireEnv(key)
{
    const value = process.env[key]?.trim();
    if (!value)
    {
        throw new Error(`${key} must be set`);
    }
    return value;
}

async function main()
{
    requireEnv("DATABASE_URL");
    const id = requireEnv("DEFAULT_SCHOOL_ID");
    const name = process.env.DEFAULT_SCHOOL_NAME?.trim() || "defaultSchool";

    const prisma = new PrismaClient();
    try
    {
        // Upsert by unique name. If a row with this name already exists,
        // leave its id alone (don't reassign primary keys at runtime).
        const existing = await prisma.school.findUnique({
            where: { name },
            select: { id: true, name: true },
        });

        if (existing)
        {
            if (existing.id !== id)
            {
                console.warn(
                    `[bootstrapDefaultSchool] School "${name}" already exists with `
                    + `id="${existing.id}", but DEFAULT_SCHOOL_ID="${id}". `
                    + "Update DEFAULT_SCHOOL_ID to match the existing row.",
                );
            }
            else
            {
                console.log(`[bootstrapDefaultSchool] School already present: ${name} (${existing.id})`);
            }
            return;
        }

        const created = await prisma.school.create({
            data: { id, name },
            select: { id: true, name: true },
        });
        console.log(`[bootstrapDefaultSchool] Created school: ${created.name} (${created.id})`);
    }
    finally
    {
        await prisma.$disconnect();
    }
}

main().catch((error) =>
{
    console.error("[bootstrapDefaultSchool] failed", error);
    process.exit(1);
});
