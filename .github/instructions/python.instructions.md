---
applyTo: "**/*.py"
description: Python coding standards and best practices
---

# Python Standards

## Type Hints

- Use type hints for all function signatures
- Use `from __future__ import annotations` for forward references
- Prefer `list[str]` over `List[str]` (Python 3.9+)
- Use `TypedDict` for dictionary schemas

## Style (PEP 8)

- 4-space indentation
- Max line length: 88 characters (Black default)
- Use snake_case for functions and variables
- Use PascalCase for classes
- Use SCREAMING_SNAKE_CASE for constants

## Imports

- Group: stdlib → third-party → local
- Use absolute imports over relative
- Avoid `from module import *`

## Functions

- Single responsibility - one function, one job
- Use `*args` and `**kwargs` sparingly and with documentation
- Prefer keyword arguments for clarity
- Document with docstrings (Google or NumPy style)

## Error Handling

- Catch specific exceptions, never bare `except:`
- Use context managers (`with`) for resources
- Create custom exception classes for domain errors

## Async

- Use `asyncio` for I/O-bound concurrency
- Use `async with` for async context managers
- Prefer `asyncio.gather()` for parallel tasks

## Testing

- Use pytest over unittest
- Name test files `test_*.py`
- Use fixtures for setup/teardown
- Aim for >80% coverage on critical paths
