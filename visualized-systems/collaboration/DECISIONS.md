# Visualized GDB — Architecture Decision Records (ADR)

This file records key technical, product, and architectural decisions. Once recorded, decisions should not be silently reversed without an update and explanation here.

---

## ADR-001: Separation of Execution Engine and Visualization Layer

- **Status:** Accepted by owner
- **Date:** 2026-10-10
- **Context:** Visualized GDB needs to visualize C++ code execution step-by-step. Coupling the UI directly to a local compiler or debugger process would make testing difficult, reduce portability, and prevent frontend/backend parallelization.
- **Decision:** Establish a strict, language-agnostic Intermediate Representation (`ExecutionTrace`) serialized as JSON. The backend engine compiles and steps the program to produce an `ExecutionTrace`. The frontend UI is a pure consumer that renders any valid `ExecutionTrace`.
- **Consequences:**
  - Gemini (frontend) and Codex (backend) can work in parallel immediately by relying on static fixture traces.
  - The execution backend can be swapped, upgraded, or moved to a cloud worker without modifying frontend rendering logic.
- **Alternatives Considered:** Direct WebSocket stream of raw GDB/LLDB machine interface commands into the frontend (rejected due to high UI coupling and brittle state parsing).

---

## ADR-002: Terminal / Debugger Aesthetic & Visual Restraint

- **Status:** Accepted
- **Date:** 2026-10-10
- **Context:** The visualizer is aimed at CS students learning systems programming. Flashy, colorful educational tools can feel childish or overwhelming.
- **Decision:** Adopt a restrained terminal/debugger aesthetic:
  - Deep black and dark gray backgrounds (`#0a0a0c`, `#16161a`, `#27272a`).
  - High-readability monospace typography for code, addresses, and variable names.
  - Restrained semantic accent colors used strictly to highlight meaning:
    - Amber/Orange for pointer arrows and reference links.
    - Cyan/Blue for the active execution line.
    - Emerald Green for mutated values in the current step.
    - Crimson Red for memory errors, freed blocks, or dangling pointers.
- **Consequences:** High clarity, professional tool feel, low visual noise.

---

## ADR-003: "Unknown is Better Than Wrong" Handling of Program State

- **Status:** Accepted
- **Date:** 2026-10-10
- **Context:** C++ contains uninitialized variables, undefined behavior, and opaque runtime internals. Guessing or inventing memory addresses or values misleads students.
- **Decision:** Whenever runtime state cannot be definitively resolved, represent it as explicit `unknown`, `unavailable`, or `error` according to the v0.2 contract. Use an uninitialized semantic label only when fixture/instrumentation evidence justifies it; never display arbitrary stack bytes as a C++ value.
- **Consequences:** Upholds pedagogical integrity and debugger truth.

---

## ADR-004: Browser Extension Integration Boundary

- **Status:** Accepted
- **Date:** 2026-10-10
- **Context:** Visualized GDB will eventually integrate with a broader hackathon browser extension for international students ("Visualize Code" button), but must function as a standalone web application.
- **Decision:** The visualizer will be a standalone web application that supports two passive intake channels:
  1. URL query parameters: `?code=<url_or_base64_encoded_source>`
  2. `window.postMessage` listener: `{ type: "VGDB_LOAD_CODE", payload: { code: string } }`
- **Consequences:** Zero direct coupling to extension build systems; standalone development remains completely unhindered.

---

## ADR-005: Host Environment Assessment & Experimental Debugger Selection

- **Status:** Accepted by owner for an experimental backend
- **Date:** 2026-10-10
- **Context:** The development host is macOS ARM64 Darwin. GNU GDB is not available natively. Docker is not installed. Apple Clang/Clang++ and LLDB are installed.
- **Decision:**
  - Use Apple Clang (`clang++ -g -O0`) and LLDB for a constrained, experimental local adapter. The current host resolves source breakpoints but has not launched the inferior; runtime extraction remains unverified.
  - Do not expose arbitrary native execution as a safe public feature. Header/source blacklisting is not a sandbox. Keep the adapter replaceable behind ExecutionTrace for a future VM/microVM worker.
- **Alternatives Considered:** Installing GDB on macOS (historically unstable on Apple Silicon due to Darwin task port code signing).

---

## ADR-006: Dual-Tier Demo Strategy (Golden Fixtures + Experimental LLDB)

- **Status:** Accepted by owner
- **Date:** 2026-10-10
- **Context:** In a hackathon demo, live native compilation can be vulnerable to timeout glitches, platform nuances, or unexpected compiler errors.
- **Decision:** Build a dual-tier strategy:
  - **Tier 1 (Golden Fixtures):** Curate same-schema canonical traces for core educational examples. These are the reliable offline demo path.
  - **Tier 2 (Experimental LLDB):** A local-only native execution experiment. It is not a safe public runner. Do not make VM infrastructure a hackathon dependency; later move it to a disposable VM/microVM worker without changing the trace contract.
- **Consequences:** Guarantees a flawless live presentation while maintaining dynamic capability.

---

## ADR-007: ExecutionTrace v0.2 Schema Freeze

- **Status:** Frozen by Codex under the owner's implementation authorization; changes require a versioned handoff
- **Date:** 2026-10-10
- **Context:** A debugger snapshot cannot establish every semantic fact needed to render memory and lifetime, and the draft schema treats some unavailable facts as known booleans.
- **Decision:** Keep one versioned `ExecutionTrace` shape for fixtures and debugger output, requiring explicit provenance, availability/unknown states, typed values, trace-local identities separate from addresses, pointer/reference resolution, stop metadata, and snapshot-derived deltas. The frozen normative contract is `docs/backend/execution-trace-v0.2.md`, with types/validator/JSON Schema/fixtures in `packages/execution-trace/`. No backend or fixture may invent an unobservable fact to satisfy the UI.
- **Consequences:** Golden traces can exercise the exact renderer/validator contract without claiming LLDB observed events it did not. Schema design and fixture production must wait for owner approval and a concrete MVP scope.
- **Alternatives Considered:** Keep flat `value` strings and boolean flags (too ambiguous); give fixtures a separate “fake” schema (unnecessary divergence); promise arbitrary C++ lifetime semantics from debugger snapshots (not supportable).

---

## ADR-008: Native Code Isolation (Hackathon constraint)

- **Status:** Accepted by owner
- **Date:** 2026-10-10
- **Context:** Native C++ compilation and execution of user input is arbitrary code execution. Blacklists and timeouts do not isolate it from the host or provide a production security boundary.
- **Decision:** Golden fixtures are the reliable demo path. LLDB live execution is experimental and local only; it must not be exposed as a safe public feature. The adapter must stay behind an interface that can move to a disposable VM/microVM without changing ExecutionTrace. Production isolation remains as described above. Source validation is not a security boundary.
- **Consequences:** Public arbitrary-code execution is not part of the MVP. Local LLDB experiments are permitted as unsandboxed, non-public development work and must be treated accordingly. The current host has no `container` CLI installed; VM isolation is a later production direction, not a hackathon prerequisite.
- **Alternatives Considered:** Header/function blacklist plus timeout (not a sandbox); in-process or unsandboxed macOS execution (unacceptable for untrusted input).

---

## ADR-009: Code Editor Choice

- **Status:** Accepted by owner
- **Date:** 2026-10-10
- **Context:** The MVP needs source display and execution-line highlighting; a full IDE editor is not a correctness-critical dependency.
- **Decision:** Use CodeMirror 6 for the initial browser editor; keep source location mapping independent of editor implementation.
- **Consequences:** Smaller, composable editor surface for the initial MVP; Monaco remains a viable later choice if language services or IDE-scale features become a requirement.
