import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  // user_sessions is created and managed by the app (server/auth.ts), not the schema;
  // without this, every schema push would offer to delete it and sign everyone out.
  tablesFilter: ["*", "!user_sessions"],
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
