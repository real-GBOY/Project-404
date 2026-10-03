import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Dependency direction (enforced below):
 *   features/<name>  →  features/training, features/auth   (the two shared domains)
 *   features/training →  nothing in features/*             (pure domain: engine, store, persistence)
 *   features/auth     →  nothing in features/*
 *   components/, lib/, theme/ →  never import features/*
 */
const FEATURES = [
  "auth",
  "training",
  "builder",
  "workout",
  "home",
  "profile",
  "history",
  "stats",
  "progress",
  "onboarding",
];
const SHARED = ["training", "auth"];

const ban = (names, why) => ({
  "no-restricted-imports": [
    "error",
    {
      patterns: names.map((n) => ({
        group: [`@/features/${n}`, `@/features/${n}/**`],
        message: why,
      })),
    },
  ],
});

const featureBoundaries = FEATURES.map((name) => ({
  files: [`src/features/${name}/**/*.{ts,tsx}`],
  rules: ban(
    FEATURES.filter((f) => f !== name && (SHARED.includes(name) || !SHARED.includes(f))),
    SHARED.includes(name)
      ? `"${name}" is a shared domain and must not depend on other features.`
      : "Features may only depend on the shared domains (training, auth), not on each other.",
  ),
}));

export default tseslint.config(
  { ignores: ["node_modules/**", ".expo/**", "dist/**", "web-build/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: { globals: { __DEV__: "readonly", console: "readonly", window: "readonly" } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-restricted-syntax": [
        "error",
        {
          // Every colour lives in src/theme/tokens.ts.
          selector: "Literal[value=/^(#[0-9a-fA-F]{3,8}|rgba?\\()/]",
          message: "Use a colour from src/theme/tokens.ts instead of a literal.",
        },
      ],
    },
  },
  ...featureBoundaries,
  {
    files: ["src/components/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}", "src/theme/**/*.{ts,tsx}"],
    rules: ban(FEATURES, "Shared UI, lib and theme code must not import from features."),
  },
  {
    // The theme is where colour literals belong; tests may use anything.
    files: ["src/theme/tokens.ts", "**/*.test.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
);
