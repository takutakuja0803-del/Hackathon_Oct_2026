# Visualized Systems

> Browser-based interactive program execution and mathematical transformation visualizer.
> Incorporating **Visualized GDB** and **Visualized Equations**.
> Original design: Takumi Naito.

## Overview

Visualized Systems is designed to make hidden internal states tangible and educational:
- **Visualized GDB**: "What is my code doing in memory, step by step?" (Live C++ execution, spatial memory canvas, call stacks, pointers, and reference aliasing)
- **Visualized Equations**: "What is each line of mathematics doing to the function/graph, step by step?" (Pure AST evaluation, affine transformation analysis, coordinate graph visualization)

## Documentation & Collaboration

All project architecture, task ownership, decisions, and inter-agent communication live in [`collaboration/`](./collaboration/):

- [`PROJECT_STATE.md`](./collaboration/PROJECT_STATE.md) - Global project status, current milestone, working features, and blockers.
- [`ARCHITECTURE.md`](./collaboration/ARCHITECTURE.md) - System architecture, execution schema, and module contracts.
- [`TASKS.md`](./collaboration/TASKS.md) - Task ownership and statuses (`TODO`, `IN_PROGRESS`, `BLOCKED`, `REVIEW`, `DONE`).
- [`DECISIONS.md`](./collaboration/DECISIONS.md) - Architectural and product decision log with rationales.
- [`GEMINI_LOG.md`](./collaboration/GEMINI_LOG.md) - Operational log for Gemini.
- [`CODEX_LOG.md`](./collaboration/CODEX_LOG.md) - Operational log for Codex.
- [`HANDOFF.md`](./collaboration/HANDOFF.md) - Inter-agent handoffs and sync points.
