# Visualized GDB — System Architecture

**Status:** ExecutionTrace v0.2 frozen; frontend migration pending
**Author:** Gemini (with review planned by Codex & Project Owner)
**Last Updated:** 2026-10-10

---

## 1. Architectural Principles

1. **Decoupled Engine & Presentation:** The execution backend produces a structured intermediate representation (`ExecutionTrace`), and the frontend renders it. Neither layer directly leaks internal debugger bindings or DOM concerns into the other.
2. **Correctness Over Flashiness ("Unknown is Better Than Wrong"):** If runtime state is ambiguous, undefined, or unresolvable, the system represents it using explicit unknown/unavailable/error states in the frozen v0.2 contract rather than inventing fictitious memory.
3. **Restrained Terminal/Debugger Aesthetic:** Minimalist visual design using black, dark grays, crisp white monospace typography, and restrained semantic accent colors (e.g., amber for pointers, blue for active line, green for value changes).
4. **Resilient to Network & Environment Failures:** The frontend can run in offline demo mode using curated golden traces while supporting dynamic execution from the backend.
5. **Extension-Ready Ingestion:** The web app functions as a standalone tool and provides an open interface (URL parameters, `postMessage`) for incoming code from the student browser extension.

---

## 2. High-Level System Overview

```text
┌────────────────────────────────────────────────────────┐
│               Student Browser Extension                │
│    (Selects C++ snippet -> "Visualize Code" action)    │
└──────────────────────────┬─────────────────────────────┘
                           │ URL params / postMessage
                           ▼
┌────────────────────────────────────────────────────────┐
│            Visualized GDB Frontend (SPA)               │
│  ┌───────────────────────┬──────────────────────────┐  │
│  │     Source Code       │   Call Stack & Locals    │  │
│  │     Editor & Stepper  ├──────────────────────────┤  │
│  │     Active Line Marker│   Heap & Dynamic Blocks  │  │
│  ├───────────────────────┴──────────────────────────┤  │
│  │   SVG Pointer Connector & State Transition Diff  │  │
│  ├──────────────────────────────────────────────────┤  │
│  │   Terminal stdout/stderr Console                 │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────▲─────────────────────────────┘
                           │ ExecutionTrace JSON
                           │
┌──────────────────────────┴─────────────────────────────┐
│          Execution & Debugger Engine (Backend)         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Feature Validator (not a security boundary)     │  │
│  ├──────────────────────────────────────────────────┤  │
│  │  Compilation (clang++ -g -O0)                    │  │
│  ├──────────────────────────────────────────────────┤  │
│  │  Runtime Stepping & State Inspection (LLDB/GDB)  │  │
│  ├──────────────────────────────────────────────────┤  │
│  │  Trace Serializer (Emits ExecutionTrace JSON)    │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 3. Intermediate Representation (IR) Contract

### Codex review notes (historical; normative v0.2 contract below)

The interface boundary is the right direction, but the draft below is not a sufficient correctness contract. It mixes observed debugger values with semantic claims that LLDB cannot generally make (for example, `isFreed` for an arbitrary address, or that an address currently belongs to a live object). Do not freeze the original interfaces unchanged.

Recommended contract principles:

- Snapshots describe what was observed at a stop, with provenance and availability; they are not a complete event history of C++ semantics.
- Keep stable trace-local identities separate from process addresses. A variable instance identity is tied to a frame instance and declaration/location where available; a storage/object identity is a backend-tracked identity, not a raw address. Addresses are optional observations and may be reused.
- Represent relationships as typed references to object/storage identities with an explicit resolution state (`resolved`, `null`, `unresolved`, `out-of-bounds`, `expired-by-observed-lifetime`, `unknown`). Do not infer a dangling pointer solely because dereferencing fails or an address is absent.
- Track object lifetime only where supported by observed allocation/deallocation events or known fixture annotations. Stack scope exit can be inferred from frame/scope transitions observed at stops, but optimized-out/inlined scopes and missed stops reduce coverage.
- Distinguish `uninitialized` only when the backend can establish that fact (e.g. a controlled fixture annotation or instrumentation). Otherwise use `unavailable` / `unknown`; a displayed debugger value is not proof that the C++ object was initialized.
- Keep observed stop data, backend-derived interpretations, and fixture-authored annotations in distinct provenance fields.
- Preserve source location validity and stop reason. A line breakpoint is a source-level observation, not one event per C++ statement; one line can execute multiple operations, and some statements have no distinct line-table stop.

The frozen v0.2 schema implements these principles with typed snapshot values, frame/storage records, optional evidence-bearing addresses, explicit availability/provenance, and no serialized deltas. Raw debugger strings are not visualization semantics.

For MVP, limit claims to scalar locals/parameters, addresses when LLDB supplies them, simple pointers/references, fixed arrays and plain structs, frames at selected source stops, and explicitly instrumented/fixture-known `new`/`delete` examples. Defer general lifetime, arbitrary heap enumeration, STL pretty-print semantics, pointer arithmetic bounds, and “uninitialized” detection.

The canonical v0.2 contract is frozen at [`docs/backend/execution-trace-v0.2.md`](../docs/backend/execution-trace-v0.2.md). Its normative TypeScript definitions, validator, JSON Schema, and canonical fixtures are in [`packages/execution-trace/`](../packages/execution-trace/). Gemini's committed frontend v0.1 type/fixture contract is a separate incompatible draft and requires migration before integration; details are in HANDOFF.

The frozen contract uses typed values and availability, explicit provenance, trace-local identities separate from runtime addresses, snapshot-based pointer/reference resolution, selected-stop snapshots, and no serialized deltas. See the contract document for invariants, meanings, validation rules, and the field-by-field producer provenance table.

## 4. Frontend Architecture

### Technology Stack
- **Framework:** React 19 + TypeScript
- **Bundler:** Vite (instant HMR, fast builds)
- **Styling:** Tailwind CSS with custom terminal/monochrome theme
- **Code Editor:** CodeMirror 6 with custom minimalist dark theme and gutter step indicators
- **Pointer Visualizer:** Lightweight reactive SVG overlay that queries DOM node bounding boxes for pointer sources and target addresses, computing dynamic bezier curves with arrowheads

### Component Breakdown
1. **`AppLayout`**: Outer terminal chrome with status bar, menu/example picker, and split view.
2. **`SourceViewer`**: Monospace editor displaying C++ code with current execution line highlight, execution progress dots, and breakpoint markers.
3. **`StepperBar`**: Play, Pause, Step Next, Step Previous, Reset, Step slider scrubber, and step speed control.
4. **`MemoryInspector`**:
   - `StackView`: Displays stack frames as stacked memory cards.
   - `HeapView`: Displays dynamically allocated blocks (`new`/`delete`).
   - `PointerCanvas`: Computes and draws arrows from pointer cells to target address cells.
5. **`DeltaFeed`**: Terminal log panel showing precise state diffs for the current step (e.g. `p -> &x (0x7ffd10)`, `*p: 5 -> 10`).
6. **`ConsoleOutput`**: Standard output / error buffer synced to the active step.
7. **`ExampleCatalog`**: Curated library of key educational snippets ready to run in one click.

---

## 5. Execution Backend & Security Strategy

### The Host Context
- macOS ARM64 Darwin.
- Available tools: Clang/Clang++ 21.0, LLDB 2100.0, Node.js 26.9, Python 3.14.
- Unavailable: GNU GDB, Docker.

### Backend Strategy Options
1. **Option A: Local LLDB Python Script / Process Driver (Host-based)**
   - Uses `clang++ -g -O0` and an LLDB script (or `lldb` batch command execution) to step through line by line, dumping `frame variable` and memory addresses at each breakpoint/step.
   - *Pros:* Real native C++ execution and authentic debugger memory addresses.
   - *Cons / Risks:* Untrusted code execution on host Mac; macOS sandbox limitations; LLDB output parsing complexity.
2. **Option B: WebAssembly-Based C++ Runtime or AST Tracer**
   - Execute in-browser or via Node.js WASM sandbox.
   - *Pros:* 100% secure, zero server requirement, runs anywhere.
   - *Cons:* Emscripten memory layout differs from standard desktop memory; requires complex WASM toolchain setup.
3. **Option C: Hybrid Architecture (Recommended for Hackathon MVP)**
   - **Tier 1 (Golden Fixture Library):** A comprehensive suite of pre-generated, verified golden `ExecutionTrace` traces covering all canonical student concepts (Pointer Basics, Pointer Reassignment, Swapping via Pointers, Stack vs Heap, Dynamic Arrays, Linked List Node).
   - **Tier 2 (Experimental Local LLDB):** A local development experiment using `clang++` + LLDB. It executes native code on the host, is not sandboxed, and is not a public arbitrary-code feature. Do not spend the hackathon building VM infrastructure. Keep the adapter behind the trace boundary so execution can later move to an ephemeral VM/microVM worker.

### Codex security review (2026-10-10; production guidance; local experiment follows accepted ADR-008)

- **Hackathon development/demo:** Prefer known golden fixtures for public demos. If live arbitrary code is necessary, run one job at a time in a disposable Linux VM with no network, no host/shared-folder mounts other than a single isolated job directory, unprivileged account, read-only base image, fresh writable overlay, CPU/memory/process/disk caps, wall-clock kill, and VM teardown after each job. On this Mac, Apple's `container` is a possible VM-backed path only if the actual host meets its supported macOS/Xcode requirements; it is not installed here. A separate disposable Linux machine/VM is a reasonable alternative. Local macOS execution with `sandbox-exec`/Seatbelt can be investigated for a controlled demo, but must be treated as defense-in-depth and verified with deny-by-default profiles; it does not turn a native runner into a production sandbox.
- **Production:** Execute jobs on isolated, ephemeral Linux microVMs or equivalent hardened worker VMs in a separate execution service. Use no credentials, no network by default, immutable images, no host paths, unprivileged user/namespaces/seccomp/LSM controls, cgroups for CPU/memory/PIDs/I/O, strict output/trace limits, watchdog, resource cleanup, and per-job destruction. Keep compiler/debugger and untrusted program in the same isolated boundary or split them with a tightly scoped protocol. Patch and monitor the worker image. Do not expose an LLDB control socket or arbitrary debugger commands to clients.
- Source validation can reject unsupported constructs to improve product behavior, but is not a security boundary. Timeouts and process limits address resource exhaustion only; they do not prevent data access or escape.

### Runtime observation boundary

LLDB's SB API can provide frames, variables, types, addresses/load addresses, children, and read errors at a stop when debug information and target state permit. It observes the stopped process as described by debug information; it does not automatically enumerate every C++ allocation, recover all source-level identity/lifetime facts, or establish initialization state. Optimizations, inlining, compiler lowering, type formatters, inaccessible memory, and expression evaluation can change or limit what is available. The backend must report unavailable/unknown and observation limitations instead of substituting invented state. “Freed” can be asserted only from observed delete/free events or fixture-authored known events; a later unreadable address is not proof of deallocation.

### Pipeline boundary

`C++ source → fixed compiler invocation → LLDB driver/API → raw stop observations → normalizer + conservative event tracker → validated/versioned ExecutionTrace → pure renderer`.

The compiler/debugger adapter owns process control and raw LLDB interaction. The normalizer owns stable IDs, typed values, provenance, explicit unknowns, and narrowly justified lifetime events. The frontend owns layout and display, not semantic inference. Keep stdout/stderr and termination/timeout/compiler failure in trace metadata. Do not make the frontend parse LLDB text.

---

## 6. Extension Integration Interface

The visualizer can be launched standalone or embedded/linked from the student browser extension:
1. **URL Parameter Scheme:**
   `https://<visualized-gdb-url>/?code=<base64_encoded_source>&lang=cpp`
2. **Window PostMessage Channel:**
   Listens for `{ type: "VGDB_LOAD_CODE", payload: { code: string, title?: string } }`.
