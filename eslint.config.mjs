import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      ".next/**",
      "out/**",
      "node_modules/**",
      "src-tauri/**",
      "fydor-website/**"
    ]
  },
  {
    files: ["**/*.{ts,tsx,mjs}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended
    ],
    plugins: {
      "react-refresh": reactRefresh
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // New in eslint-plugin-react-hooks v7; flags a load-then-setState pattern
      // used throughout this codebase. Revisit per-file rather than as a blanket refactor.
      "react-hooks/set-state-in-effect": "off"
    }
  }
);
