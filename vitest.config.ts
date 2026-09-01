import { defineConfig } from "vitest/config";
import path from "node:path";

// DOM tests opt in per file with `// @vitest-environment happy-dom`.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
