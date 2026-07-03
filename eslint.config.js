// Flat config (ESLint v9+). Replaces the legacy .eslintrc.js.
// Mirrors the previous setup: expo config + prettier (prettier/prettier as error).
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = [
  ...expoConfig,
  eslintPluginPrettierRecommended,
  {
    rules: {
      // Not enforced under the project's previous config; JSX apostrophes in
      // user-facing copy are fine. Kept as a warning rather than a hard error.
      "react/no-unescaped-entities": "warn",
    },
  },
  {
    ignores: ["dist/*", "android/*", "ios/*", ".expo/*", "node_modules/*"],
  },
];
