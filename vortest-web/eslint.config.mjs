import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // "next/typescript" registra el plugin @typescript-eslint (el código ya
  // tiene comentarios `eslint-disable @typescript-eslint/no-explicit-any`
  // que, sin esto, ESLint marca como "rule not found").
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "coverage/**",
      "runtime/**",
      "test-results/**",
      "playwright-report/**",
      "openspec/**",
      "sdd/**",
    ],
  },
];

export default eslintConfig;
