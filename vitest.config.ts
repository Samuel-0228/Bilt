import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/cli.ts",
        "src/types/**/*",
        "src/commands/**/*",
        "src/plugins/**/*",
        "src/core/fix/confirm.ts",
        "src/reporters/**/*",
        "src/scanner/**/*",
        "src/checks/**/*",
        "src/constants/**/*",
        "src/env/**/*",
        "src/utils/**/*",
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
      },
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          testTimeout: 30000,
        },
      },
      {
        test: {
          name: "regression",
          include: ["tests/regression/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "fuzz",
          include: ["tests/fuzz/**/*.test.ts"],
          environment: "node",
          testTimeout: 60000,
        },
      },
      {
        test: {
          name: "perf",
          include: ["tests/perf/**/*.test.ts"],
          environment: "node",
          testTimeout: 30000,
        },
      },
    ],
  },
});
