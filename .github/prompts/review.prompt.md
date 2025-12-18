---
name: review
description: Comprehensive code review with security, quality, and performance analysis
argument-hint: Paste code or describe what to review
agent: Apollo
---

<!--
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
-->

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
