import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";

export const localDatabaseUrl = "postgres://postgres:postgres@localhost:5432/habitz";

const connectionString = process.env.DATABASE_URL ?? localDatabaseUrl;

const client = postgres(connectionString, {
  prepare: false,
  max: 5
});

export const db = drizzle(client, { schema });
