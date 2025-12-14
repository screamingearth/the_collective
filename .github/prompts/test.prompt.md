---
name: test
description: Generate comprehensive tests for code under development
argument-hint: Select code or specify function to test
agent: Prometheus
tools: ["search/codebase", "read/readFile", "search/usages", "execute/runInTerminal"]
---

# Test Generation Protocol

Generate comprehensive tests for:

**File:** ${file}
**Selection:** ${selection}

## Test Strategy

### 1. Unit Tests (Priority 1)

- Test each function in isolation
- Mock external dependencies
- Cover happy path + edge cases

### 2. Edge Cases to Cover

- Empty inputs (`""`, `[]`, `{}`, `null`, `undefined`)
- Boundary values (0, 1, -1, MAX_INT, MIN_INT)
- Invalid types (if not using strict typing)
- Concurrent/async race conditions
- Error conditions and exception paths

### 3. Test Structure

```typescript
describe("[FunctionName]", () => {
  describe("happy path", () => {
    it("should [expected behavior] when [condition]", () => {
      // Arrange
      // Act
      // Assert
    });
  });

  describe("edge cases", () => {
    it("should handle empty input", () => {});
    it("should handle null/undefined", () => {});
    it("should handle boundary values", () => {});
  });

  describe("error handling", () => {
    it("should throw [ErrorType] when [invalid condition]", () => {});
  });
});
```

### 4. Coverage Goals

- Aim for 80%+ line coverage
- 100% coverage on critical paths (auth, payments, data mutations)
- Every public API method must have tests

## Before Writing Tests

1. Read the implementation to understand the logic
2. Identify dependencies that need mocking
3. Check existing test patterns in the codebase
4. Understand the testing framework in use

## After Writing Tests

Run the tests with `run_in_terminal` and fix any failures before presenting to the user.
