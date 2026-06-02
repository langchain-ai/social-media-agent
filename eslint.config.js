import js from "@eslint/js";
import tseslintPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import noInstanceofPlugin from "eslint-plugin-no-instanceof";

export default [
  {
    ignores: [
      ".eslintrc.cjs",
      "eslint.config.js",
      "scripts",
      "src/utils/lodash/*",
      "node_modules",
      "dist",
      "dist-cjs",
      "*.js",
      "*.cjs",
      "*.d.ts",
    ],
  },
  js.configs.recommended,
  prettierConfig,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 12,
        project: "./tsconfig.json",
        sourceType: "module",
      },
    },
    plugins: {
      import: importPlugin,
      "@typescript-eslint": tseslintPlugin,
      "no-instanceof": noInstanceofPlugin,
    },
    rules: {
      ...tseslintPlugin.configs.recommended.rules,
      "@typescript-eslint/explicit-module-boundary-types": 0,
      "@typescript-eslint/no-empty-function": 0,
      "@typescript-eslint/no-shadow": 0,
      "@typescript-eslint/no-empty-interface": 0,
      "@typescript-eslint/no-use-before-define": ["error", "nofunc"],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_|^UNUSED_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-empty-object-type": 0,
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": 0,
      "@typescript-eslint/await-thenable": 0,
      "@typescript-eslint/no-explicit-any": 0,
      camelcase: 0,
      "class-methods-use-this": 0,
      "import/extensions": [2, "ignorePackages"],
      "import/no-extraneous-dependencies": [
        "error",
        { devDependencies: ["**/*.test.ts"] },
      ],
      "import/no-unresolved": 0,
      "import/prefer-default-export": 0,
      "keyword-spacing": "error",
      "max-classes-per-file": 0,
      "max-len": 0,
      "no-await-in-loop": 0,
      "no-bitwise": 0,
      "no-console": 0,
      "no-restricted-syntax": 0,
      "no-redeclare": 0,
      "no-shadow": 0,
      "no-continue": 0,
      "no-underscore-dangle": 0,
      "no-undef": 0,
      "no-use-before-define": 0,
      "no-useless-constructor": 0,
      "no-useless-assignment": 0,
      "no-useless-escape": 0,
      "no-return-await": 0,
      "consistent-return": 0,
      "no-else-return": 0,
      "new-cap": ["error", { properties: false, capIsNew: false }],
      "preserve-caught-error": 0,
    },
  },
];
