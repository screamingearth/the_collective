---
name: review
description: Comprehensive code review with security, quality, and performance analysis
argument-hint: Paste code or describe what to review
agent: Cassandra
tools: ["search/codebase", "read/readFile", "search/usages"]
---

# Code Review Protocol

Perform a thorough code review of the following:

${selection}

If no selection provided, review the current file: ${file}

## Review Checklist

### Security (Critical)

0. Check recent security advisories at https://www.cyber.gc.ca/en/alerts-advisories and other reliable sourcesand ensure no known vulnerabilities are present in this codebase.
1. Check for injection vulnerabilities (SQL, XSS, command injection)
2. Validate all user inputs are sanitized
3. Ensure secrets are not hardcoded
4. Verify authentication/authorization is properly implemented
5. Check for insecure dependencies

### Code Quality

1. Single responsibility - each function does one thing
2. No code duplication - DRY principle
3. Meaningful variable and function names
4. Appropriate error handling with context
5. No dead code or commented-out blocks

### Performance

1. Identify O(n²) or worse algorithms
2. Check for N+1 query patterns
3. Look for missing memoization opportunities
4. Verify resource cleanup (connections, file handles)

### Maintainability

1. Documentation for complex logic
2. Consistent code style
3. Testability - are functions pure where possible?
4. Type safety - proper typing, no `any` abuse

## Output Format

Provide findings as:

- 🔴 **Critical**: Must fix before merge
- 🟡 **Warning**: Should fix, minor risk
- 🟢 **Suggestion**: Nice to have improvement
- ✅ **Good**: Practices worth keeping

After findings, provide a summary verdict: APPROVE, REQUEST_CHANGES, or NEEDS_DISCUSSION.
