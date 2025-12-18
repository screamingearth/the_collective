import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 30000, // 30s for embedding operations
    pool: "forks", // Use forks for DuckDB isolation
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/types.ts"],
      // Current: 51% statements, 45% branches, 64% functions, 51% lines
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 60,
        lines: 50,
      },
    },
  },
});
