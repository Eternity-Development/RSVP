import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: rely on variables already set in the environment (e.g. CI).
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL must be set to run tests (see .env.example).");

export default defineConfig({
  test: {
    env: { DATABASE_URL: testDatabaseUrl },
    globalSetup: "./tests/globalSetup.ts",
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
