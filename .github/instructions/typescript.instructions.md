---
applyTo: "**/*.ts,**/*.tsx,**/*.mts,**/*.cts"
description: TypeScript coding standards and best practices
---

# TypeScript Standards

## Type Safety

- Enable `strict: true` in tsconfig.json - no exceptions
- Avoid `any` - use `unknown` with type guards instead
- Prefer explicit return types on exported functions
- Use discriminated unions over type assertions

## Patterns

- Use `interface` for object shapes that may be extended
- Use `type` for unions, intersections, and computed types
- Prefer `readonly` arrays and properties when mutation isn't needed
- Use `as const` for literal inference

## Modern Syntax

- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Prefer `satisfies` operator over type assertions when possible
- Use template literal types for string patterns

## Async/Await

- Always handle promise rejections with try/catch or `.catch()`
- Use `Promise.all()` for parallel operations
- Avoid mixing callbacks and promises

## Imports

- Use ESM imports (`import`/`export`)
- Prefer named exports over default exports
- Sort imports: external packages → internal modules → relative paths

## Error Handling

- Create typed error classes extending `Error`
- Include context in error messages
- Use Result types for expected failures, exceptions for unexpected ones
