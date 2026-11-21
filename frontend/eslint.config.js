import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        location: "readonly",
        fetch: "readonly",
        RequestInit: "readonly",
        FormData: "readonly",
        File: "readonly",
        Response: "readonly",
        Headers: "readonly",
        DOMException: "readonly",
        AbortController: "readonly",
        console: "readonly",
        confirm: "readonly",
        process: "readonly",
      },
    },
  },
);
