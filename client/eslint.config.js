import eslint from "@eslint/js";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";

const styleRules = {
  semi: ["error", "always"],
  "brace-style": ["error", "allman", { allowSingleLine: true }],
  indent: [
    "error",
    2,
    {
      SwitchCase: 1,
      ignoredNodes: [
        "TSTypeParameterInstantiation",
        "TSTypeParameterDeclaration",
      ],
    },
  ],
  "no-unused-vars": "off",
  "@typescript-eslint/no-unused-vars": "off",
  "no-undef": "off",
};

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "storybook-static/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/essential"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: { ...styleRules },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: { ...styleRules },
  }
);
