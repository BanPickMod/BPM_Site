import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Design references and local tooling, not site code.
    "design-lab/**",
    // Node build tooling (CommonJS), run directly with node.
    "scripts/**",
    ".claude/**",
  ]),
  // The server log is written in one place (lib/server/log.ts), which scrubs what it writes.
  { files: ["**/*.{ts,tsx}"], rules: { "no-console": "error" } },
]);

export default eslintConfig;
