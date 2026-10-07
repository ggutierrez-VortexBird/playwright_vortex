// ESLint flat config para vortest-engine (NestJS + TypeScript).
// Reglas base recomendadas de typescript-eslint; no se activan reglas
// "type-checked" más estrictas para no generar un volumen de violaciones
// que bloquee el CI antes de una limpieza progresiva (ver [C-03]).
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "runtime/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Scripts JS que Playwright y Node cargan como CommonJS (el reporter, verificaciones).
    files: ["scripts/**/*.js"],
    languageOptions: { globals: globals.node, sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["**/*.spec.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
