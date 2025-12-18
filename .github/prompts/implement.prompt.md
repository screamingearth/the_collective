---
name: implement
description: Full implementation workflow from requirements to working code
argument-hint: Describe the feature or component to build
agent: Prometheus
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

# Implementation Protocol

This prompt activates the_collective for a full implementation workflow.

**Workspace:** ${workspaceFolder}
**Request:** ${input:feature:Describe what you want to build}

## Phase 1: Planning (Nyx)

1. Break down requirements into discrete tasks
2. Identify affected files and components
3. Search memory for relevant past decisions
4. Create todo list for tracking

## Phase 2: Architecture (Prometheus)

1. Review existing code patterns in the codebase
2. Design the implementation approach
3. Identify integration points
4. Plan for error handling and edge cases

## Phase 3: Risk Analysis (Cassandra)

1. Security implications of the change
2. Breaking changes to existing functionality
3. Edge cases that need handling
4. Dependencies that might be affected

## Phase 4: Implementation (Prometheus)

1. Write the code following established patterns
2. Add appropriate error handling
3. Include inline documentation for complex logic
4. Run tests after each significant change

## Phase 5: Quality Check (Apollo)

1. Code style consistency
2. Performance review
3. Refactor for clarity if needed
4. Ensure proper typing

## Phase 6: Verification

1. Run full test suite
2. Check for lint/compile errors
3. Store decisions in memory for future reference

## Workflow Notes

- All agents collaborate throughout
- Cassandra has veto power on security issues
- Apollo certifies when complete
- Nyx manages user communication
