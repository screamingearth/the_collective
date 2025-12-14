// @ts-check
import eslint from "@eslint/js";

export default [
  eslint.configs.recommended,
  {
    files: ["scripts/**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        // Node.js globals
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    rules: {
      // Code quality
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "no-console": "off", // CLI scripts need console
      "no-debugger": "error",
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],

      // Style consistency
      "brace-style": ["error", "1tbs"],
      "comma-dangle": ["error", "always-multiline"],
      quotes: ["error", "double", { avoidEscape: true }],
      semi: ["error", "always"],

      // Best practices
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-return-await": "error",
      "require-await": "error",
      "no-throw-literal": "error",
      "prefer-promise-reject-errors": "error",
    },
  },
  {
    ignores: [
      "node_modules/",
      ".collective/memory-server/", // Has its own eslint config
      "dist/",
      ".mcp/",
    ],
  },
];
