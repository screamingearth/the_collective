/*
 * This file is part of >the_collective.
 * Copyright (c) 2025 screamingearth.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
      "node_modules/**",
      ".collective/**", // Has its own eslint configs
      "**/dist/**", // Compiled output
      ".mcp/**", // Database files
    ],
  },
];
