# Visualized GDB — Task Board

**Status Legend:**
- `TODO`: Not started
- `IN_PROGRESS`: Actively owned and being worked on (only one agent working at a time)
- `BLOCKED`: Awaiting dependency, input, or other agent handoff
- `REVIEW`: Awaiting review or user decision
- `DONE`: Completed, tested, and verified

**Rules of Engagement:**
1. Do not modify another agent's `IN_PROGRESS` task without explicit handoff in `HANDOFF.md` or user authorization.
2. Update this file immediately when taking on a task or changing status.
3. Every task must have an explicit single owner (`Gemini`, `Codex`, or `Owner`).

---

## Active & Upcoming Tasks

| Task ID | Task Description | Owner | Status | Dependencies | Notes |
|---|---|---|---|---|---|
| **EQ-01** | Visualized Equations & Top-Level Product Mode Switching | Gemini | `DONE` | LIVE-02 | EquationTrace v0.1 contract, parser, AST evaluator, affine transformation analyzer, interactive 2D graph, line-by-line stepper, and independent mode state preservation |
| **LIVE-02** | Expand Live C++ subset (Arithmetic, References, Arrays, Functions) | Gemini | `DONE` | LIVE-01 | Added arithmetic (+,-,*,/,%, parens), reference aliasing (int& r = x), fixed-size arrays (int arr[3]), and user-defined functions (add, swap) with stack frames |
| **LIVE-01** | Experimental Live C++ Visualization Backend (Milestone 1) | Gemini | `DONE` | UI-COMPOSITION | First live pointer program end-to-end; parser, clang++ runner, normalizer, ExecutionTrace v0.2, UI live mode |
| **UI-COMPOSITION** | Product-level memory textbook redesign and visual acceptance B–H | Codex | `DONE` | UI-CONTRAST | Sole-owner redesign complete; B–H visually reviewed; 36 tests pass; build passes |
| **SETUP-01** | Initialize Git repository & baseline `.gitignore` | Gemini | `DONE` | None | Initialized on `main` |
| **SETUP-02** | Create shared collaboration system in `collaboration/` | Gemini | `DONE` | SETUP-01 | 7 operational files |
| **SETUP-03** | Inspect host environment and developer toolchains | Gemini | `DONE` | SETUP-01 | macOS ARM64, Clang/LLDB, Node v26 |
| **PLAN-01** | Propose System Architecture & IR Contract | Gemini | `DONE` | SETUP-02 | Documented in ARCHITECTURE.md |
| **PLAN-02** | Propose Hackathon MVP Scope & Boundaries | Gemini | `DONE` | SETUP-02 | Documented in PROJECT_STATE.md |
| **PLAN-03** | Review Architecture & IR Contract | Codex | `DONE` | PLAN-01 | Critical review recorded in ARCHITECTURE.md, DECISIONS.md, CODEX_LOG.md, and HANDOFF.md |
| **DECIDE-01**| Approve Architecture, MVP Scope & Execution Strategy | Owner | `DONE` | PLAN-01, PLAN-02, PLAN-03 | Approved by Owner (Architecture Freeze v0.1) |
| **IR-01** | Freeze canonical TypeScript / JSON `ExecutionTrace` schema v0.2 & validator | Codex | `DONE` | DECIDE-01 | `docs/backend/execution-trace-v0.2.md`; types/schema/validator/fixtures in `packages/execution-trace/`; frozen canonical boundary |
| **IR-MIGRATE** | Migrate frontend contract/fixtures to canonical ExecutionTrace v0.2 | Gemini | `DONE` | IR-01 | Completed; single source of truth at `packages/execution-trace`, zero semantic drift, derived deltas, 29/29 tests pass |
| **UI-REDESIGN**| Major spatial memory visualizer redesign (TAKUMI Lab Apple aesthetic) | Gemini | `DONE` | IR-MIGRATE | Hero memory canvas: physical memory boxes, pointers/references, contiguous arrays, vertical stack frames, spatial heap |
| **UI-CONTRAST**| Visual contrast & TAKUMI Lab ground truth visual polish | Gemini | `DONE` | UI-REDESIGN | High contrast #17181a text, visible borders, physical memory boxes, prominent stepper, integrated terminal, radial canvas |
| **UI-01** | Initialize React + Vite + TypeScript frontend project with CodeMirror 6 | Gemini | `DONE` | DECIDE-01 | Set up in `frontend/` with terminal aesthetic design system |
| **UI-02** | Build minimalist terminal/debugger UI shell & layout | Gemini | `DONE` | UI-01 | Deep dark, monospace, restrained semantic accents |
| **UI-03** | Implement CodeMirror 6 source display/editor with execution line highlighter | Gemini | `DONE` | UI-01, UI-02 | Active line marker, gutter indicators (`▶`), C++ syntax highlighting |
| **UI-04** | Implement Stepper controller (prev, next, scrub, play/pause, reset) | Gemini | `DONE` | UI-02, IR-01 | Timeline state machine, speed control, scrubber, keyboard shortcuts |
| **UI-05** | Build Stack Frame, Variables & Memory-Object inspector | Gemini | `DONE` | UI-02, IR-01 | Frames, addresses, scalars, arrays, structs, uninitialized/unknown markers |
| **UI-06** | Build Heap Memory allocation inspector component | Gemini | `DONE` | UI-02, IR-01 | Dynamic allocations, sizes, provenance, freed status |
| **UI-07** | Implement SVG Pointer & Reference Arrow relationship layer | Gemini | `DONE` | UI-05, UI-06 | Dynamic curved bezier arrows from pointers to target memory cells |
| **UI-08** | Implement State Transition Delta feed panel | Gemini | `DONE` | UI-02, IR-01 | Snapshot-derived deltas ("x: 5 -> 10", "*p: 10", deallocations, dangling states) |
| **UI-09** | Implement Terminal stdout / stderr console sync | Gemini | `DONE` | UI-02, IR-01 | Real-time console buffer synced to active step (cumulative + step delta) |
| **FIXTURE-01**| Author Golden Fixture suite (A through H) with correct provenance | Gemini | `DONE` | IR-MIGRATE | All 8 required fixtures migrated to canonical v0.2 and 100% verified with Vitest |
| **EXP-01** | Curate educational example selector & loader for Fixtures A-H | Gemini | `DONE` | FIXTURE-01, UI-01 | Quick-switch demo catalog in header |
| **EXT-01** | Implement Browser Extension ingest bridge (URL/postMessage)| Gemini | `DONE` | UI-01 | Supports `?code=` query param and `window.postMessage` |
| **QA-02** | Cross-browser & visual polish verification | Gemini | `DONE` | UI-01, FIXTURE-01 | Production build passes with 0 errors, 15/15 frontend tests passing |
| **ENG-01** | Experimental constrained Clang + LLDB adapter | Codex | `IN_PROGRESS` | IR-01 | Adapter and example added; breakpoints resolve but debuggee launch fails on this host (`-1 / no such process`) |
| **ENG-02** | Normalize LLDB observations to ExecutionTrace | Codex | `IN_PROGRESS` | ENG-01, IR-01 | Normalizer emits canonical v0.2; actual runtime snapshots await successful inferior launch |
| **ENG-03** | General object lifetimes, new/delete, dangling pointers | Codex | `BLOCKED` | ENG-02 | Out of live MVP; support only if reliable instrumentation/tracking emerges |
| **ENG-04** | VM isolation for arbitrary native user input | Codex | `BLOCKED` | DECIDE-01 | Not required for hackathon live experiment; no public safe runner claim |
| **INT-01** | Connect frontend stepper to backend execution runner | Gemini | `TODO` | ENG-01, UI-04 | End-to-end integration when backend ready |
| **QA-01** | ExecutionTrace validator and correctness tests for MVP subset | Codex | `DONE` | IR-01 | 14 tests cover scalars/parameters, pointers, refs, arrays, nested frames, unknown/unavailable, locations, lifetimes, and invalid claims |
