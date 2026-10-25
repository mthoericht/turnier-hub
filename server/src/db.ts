import { createDatabaseClient } from "./dbClient.js";

export const prisma = createDatabaseClient(process.env.DATABASE_URL ?? "");
