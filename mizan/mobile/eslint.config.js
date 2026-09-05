// Flat config — Expo's shared rules (React Native, hooks, import ordering) plus
// a few house rules kept in sync with mizan/web/eslint.config.js.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*", "node_modules/*", "expo-env.d.ts"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/array-type": ["error", { default: "array" }],

      // i18next's fluent API lives on the default export (`i18n.use(...)`,
      // `i18n.changeLanguage(...)`); the named-member lint is a false positive here.
      "import/no-named-as-default-member": "off",

      // The experimental React Compiler lint set (react-hooks 6) fires on
      // idioms this codebase uses deliberately and safely — `useRef(new
      // Animated.Value()).current`, formatting helpers called in render,
      // one-shot sync of async route data into local state. Not adopting
      // React Compiler, so these stay advisory.
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
    },
  },
]);
