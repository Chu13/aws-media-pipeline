import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "lambdas/**/src/**/*.test.ts",
      "infra/test/**/*.test.ts",
      "web/src/**/*.test.ts",
    ],
    environment: "node",
    passWithNoTests: false,
  },
});
