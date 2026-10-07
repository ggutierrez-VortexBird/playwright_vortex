import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import globals from "globals";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Los tests no se modifican (regla del proyecto): mocks con require() y any son el patrón establecido ahí.
    files: ["__tests__/**", "__mocks__/**", "e2e/**", "**/*.test.{ts,tsx,js}", "jest.setup.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@next/next/no-img-element": "off",
      "react/display-name": "off",
    },
  },
  {
    files: ["scripts/**/*.{js,cjs}", "*.{js,cjs}"],
    languageOptions: { globals: globals.node },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "coverage/**",
    "runtime/**",
    "test-results/**",
    "playwright-report/**",
    "openspec/**",
    "sdd/**",
    "next-env.d.ts",
  ]),
]);
