import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "db/migrations/**"] },
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
