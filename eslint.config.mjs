import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "out/**", "evidence/**", ".cortex-dev/**", "test-results/**", "playwright-report/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  { files: ["**/test/**", "tests/**"], rules: { "@typescript-eslint/no-explicit-any": "off", "@typescript-eslint/no-unused-expressions": "off" } },
  { files: ["scripts/dev-smoke.mjs"], languageOptions: { globals: { document: "readonly" } } },
  { files: ["**/*.{js,mjs,cjs}"], languageOptions: { globals: { process: "readonly", console: "readonly", URL: "readonly", Buffer: "readonly", setTimeout: "readonly", fetch: "readonly" } } },
);
