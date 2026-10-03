import { defineConfig } from "vitest/config";
import path from "node:path";

/** Live/offline evaluation of the analysis pipeline. Not part of `pnpm test`. */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    testTimeout: 120_000,
    fileParallelism: false,
  },
});
