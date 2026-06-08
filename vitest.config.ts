import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    globals: true,
    // Test-only secrets so platform/config.ts loads without a real .env.
    env: {
      JWT_ACCESS_SECRET: "test-access-secret",
      JWT_REFRESH_SECRET: "test-refresh-secret",
      ACCESS_TOKEN_TTL: "900",
      REFRESH_TOKEN_TTL: "2592000",
    },
  },
});
