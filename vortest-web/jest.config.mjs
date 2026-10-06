import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import('jest').Config} */
const config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // Mock iron-session (ESM-only) to prevent uncrypto parse error
    "^iron-session$": "<rootDir>/__mocks__/iron-session.js",
    // Monaco no corre en jsdom y no aporta nada a un test unitario — se
    // sustituye por un <textarea> con el mismo contrato de props.
    "^@monaco-editor/react$": "<rootDir>/__mocks__/@monaco-editor/react.js",
  },
  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/",
    "<rootDir>/e2e/",
    "<rootDir>/runtime/",
    "<rootDir>/fixtures/",
  ],
};

export default createJestConfig(config);
