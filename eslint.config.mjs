import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "db/migrations/**"] },
  {
    // Test fixtures (mock data, the mock-backed copy of the data layer) are for tests only.
    // Production code must never import anything under tests/, so it can never fall back to mock data.
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "db/**/*.ts", "proxy.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/tests/*", "**/tests/*", "tests/*"], message: "Production code must not import from tests/ (mock data is for tests only)." },
          ],
        },
      ],
    },
  },
  {
    // All user-facing text lives in lib/i18n/strings.ts (spec section 5, rule 4).
    // Components call t("key"); they never contain literal wording.
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXText[value=/\\S/]",
          message: "Hardcoded user-facing text. Add a key to lib/i18n/strings.ts and use t(\"key\").",
        },
        {
          selector: "JSXExpressionContainer > Literal[value=/[A-Za-z]/]",
          message: "Hardcoded user-facing text. Add a key to lib/i18n/strings.ts and use t(\"key\").",
        },
        {
          selector: "JSXAttribute[name.name=/^(alt|title|placeholder|label|aria-label|aria-description)$/] > Literal",
          message: "Hardcoded user-facing text in an attribute. Use t(\"key\") from lib/i18n/strings.ts.",
        },
      ],
    },
  },
  {
    // Allow `_name` for values dropped on purpose, e.g. `const { contact: _contact, ...rest } = partner`.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
