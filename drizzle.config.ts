import { defineConfig } from "drizzle-kit";

const localDatabaseUrl = "postgres://postgres:postgres@localhost:5432/habitz";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? localDatabaseUrl
  },
  strict: true,
  verbose: true
});
