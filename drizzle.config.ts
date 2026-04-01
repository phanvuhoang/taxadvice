import { defineConfig } from "drizzle-kit";

// Note: This app uses raw pg queries instead of Drizzle ORM for PostgreSQL
// This config is kept for compatibility with the build system
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: "data.db",
  },
});
