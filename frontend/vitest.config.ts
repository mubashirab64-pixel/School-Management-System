/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Resolves `@/...` the same way Next does, from tsconfig paths.
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Only our own tests: the default would reach into node_modules and .next.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
