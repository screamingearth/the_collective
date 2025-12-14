---
name: debug
description: Systematic debugging workflow with root cause analysis
argument-hint: Describe the bug or paste error message
agent: Prometheus
tools: ["read/readFile", "search/codebase", "execute/runInTerminal", "read/terminalLastCommand"]
---

# Debugging Protocol

Systematically diagnose and fix the reported issue.

**Context:** ${file}
**Error/Issue:** ${input:issue:Describe the bug or paste the error}

## Phase 1: Gather Context

1. **Read the error** - Get exact error message, stack trace, line numbers
2. **Reproduce** - Understand the conditions that trigger the bug
3. **Check recent changes** - What changed that could have caused this?

## Phase 2: Isolate

1. **Narrow scope** - Binary search to find the exact failing component
2. **Check inputs** - Are the inputs what you expect?
3. **Check state** - Is application state corrupted somewhere upstream?
4. **Check dependencies** - Did a dependency version change?

## Phase 3: Diagnose

Use these tools:

- `get_errors` - Get compile/lint errors
- `grep_search` - Search for similar patterns
- `run_in_terminal` - Run targeted tests, add debug logging
- `read_file` - Examine related code

## Phase 4: Fix

1. **Minimal fix** - Change only what's necessary
2. **Verify** - Run the failing scenario again
3. **Regression check** - Ensure no new failures introduced
4. **Document** - Add comment explaining the fix if non-obvious

## Output Format

```
### Root Cause
[Explain what caused the bug]

### Fix Applied
[What was changed and why]

### Verification
[How the fix was verified]

### Prevention
[How to prevent similar bugs in future]
```

Hand off to Cassandra for review if the fix touches security-sensitive code.
