import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  // public/ holds vendored, prebuilt files (e.g. pdf.worker.min.mjs).
  { ignores: ["dist", "public"] },
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
    settings: { react: { version: "18.2" } },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Only the two classic hooks rules — v7's "recommended" preset also
      // enables React Compiler rules, which this codebase isn't written for.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // The project doesn't use PropTypes (prop-types isn't even installed).
      "react/prop-types": "off",
    },
  },
  {
    // Vercel functions, tests and config files run in Node, not the browser.
    files: ["api/**/*.js", "**/*.test.js", "*.config.js", "*.cjs"],
    languageOptions: { globals: globals.node },
  },
];
