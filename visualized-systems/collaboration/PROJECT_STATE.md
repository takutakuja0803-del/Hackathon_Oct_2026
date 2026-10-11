**Current Phase:** Visualized Systems Multi-Mode Product Expansion (Visualized Equations Complete)
**Active Milestone:** EQ-01 (Gemini)
**Project Owner & Final Decision Maker:** User  

---

## 1. Executive Summary

Visualized Systems is an interactive, browser-based education suite designed by TAKUMI Lab to VISUALIZE THE INTERNAL MECHANISMS of computation and mathematics:
1. **Visualized GDB**: "What is my code doing in memory, step by step?"
2. **Visualized Equations**: "What is each line of mathematics doing to the function/graph, step by step?"

**Visualized Equations Milestone (EQ-01 Complete):**
Implemented a dedicated mathematical transformation visualization mode (`packages/equation-trace`) and integrated it into the top-level application shell with seamless mode switching:
- **Mathematical AST & Parser**: Pure TypeScript mathematical tokenizer and parser without `eval()`, supporting polynomials, standard functions (`sin`, `cos`, `tan`, `abs`, `sqrt`, `ln`, `exp`), implicit multiplication, and custom user functions.
- **Transformation Analyzer**: Detects affine transformations relative to dependent functions (`vertical-shift`, `horizontal-shift`, `reflection-x`, `reflection-y`, `vertical-scale`, `horizontal-scale`, `composition`) and generates educational narratives.
- **EquationTrace v0.1**: Dedicated, strictly validated contract with active and reference curve sampling, sequence index verification, and non-finite discontinuity safety.
- **Interactive Coordinate Graph**: High-contrast 2D SVG Cartesian plane featuring zoom, pan, coordinate inspection, active vs. quieter reference curve rendering, and asymptote-safe path segmentation.
- **Independent State Preservation**: Switching between Visualized GDB and Visualized Equations completely preserves both session states (C++ source, current GDB step, live trace, equation source, current equation step).

All 66 tests across the repository pass:
- 14/14 canonical `ExecutionTrace v0.2` tests (`packages/execution-trace`)
- 12/12 backend compiler/tracer/normalizer tests (`packages/instrumentation-backend`)
- 10/10 `EquationTrace v0.1` tests (`packages/equation-trace`)
- 30/30 frontend tests (`frontend`)
- Strict TypeScript checks pass with 0 errors (`tsc`).
- Production build succeeds cleanly in ~1.0s.

The approved TAKUMI Lab lesson UI (at commit `4cdd351`) has been preserved without redesign or restyling. An intuitive **Edit / Live Code** and **Visualize** workflow was wired into the header and editor. When the user enters code and clicks Visualize, the live trace is compiled, validated via `assertValidExecutionTrace`, and loaded directly into the existing spatial memory visualizer.

**Live Backend Feature Expansion (LIVE-02 Complete):**
Expanded the experimental live C++ visualization backend (`packages/instrumentation-backend`) to support the four required features in order, plus the pointer swap stretch goal:
1. **Arithmetic Expressions**: Full support for integer arithmetic (`+`, `-`, `*`, `/`, `%`) and parentheses in declarations and assignments (`int z = (x + y) / 2;`, `z = z * 2;`).
2. **References**: Real C++ reference aliasing (`int& r = x;`). Normalizer recognizes that `(uintptr_t)&r == (uintptr_t)&x`, assigns `storageId: "storage-main-x"`, sets `kind: "reference"`, and avoids creating duplicate storage objects. Mutations through references (`r = 20;`) mutate the shared storage object directly.
3. **Fixed-Size Int Arrays**: Real contiguous memory arrays (`int arr[3] = {1, 2, 3};`, `arr[1] = 9;`). Captures element addresses, sizes, and scalar values into canonical `kind: "array"` variables with contiguous element storage records.
4. **Simple User-Defined Functions**: Multi-frame stack support (`int add(int a, int b)`, `void swap(int* a, int* b)`). The runtime call stack pushes activation records on entry and pops on return. Innermost active frames appear above callers (`add` above `main`), showing parameters, local variables, and unwinding.

All 51 tests across the repository pass:
- 14/14 canonical `ExecutionTrace v0.2` tests (`packages/execution-trace`)
- 12/12 backend compiler/tracer/normalizer tests (`packages/instrumentation-backend`)
- 25/25 frontend tests (`frontend`)
- Production build succeeds cleanly in ~950ms.

---

## 2. Working Features

- [x] **Live C++ Language Subset Supported:**
  - `main()` and user-defined functions (`int`, `void`, typed parameters).
  - Scalar `int` variables with initializers and assignments.
  - Complex arithmetic with `+`, `-`, `*`, `/`, `%` and parentheses.
  - Pointers: `int* p = &x;`, `*p = 10;`, `p = nullptr;`.
  - References: `int& r = x;`, `r = 20;` with true storage aliasing.
  - Fixed-size arrays: `int arr[N] = {...};`, `arr[i] = val;` with contiguous cells.
  - Function calls: Call stack push/pop, parameter binding, return values, inter-frame pointer swaps.
- [x] **Experimental Live C++ Backend (`packages/instrumentation-backend`):**
  - Constrained C++ parser: Detects supported variable declarations, pointer assignments, dereference assignments, and return statements while explicitly rejecting unsupported constructs (e.g. `std::vector`, `class`, templates, loops) with clean educational diagnostics.
  - Source Instrumenter: Emits lightweight tracing hooks with a self-contained C++ runtime header (`runtime.hpp`).
  - Compiler & Executor: Invokes `/usr/bin/clang++ -std=c++20` with safe argument arrays (no shell interpolation), temporary directory isolation, and execution timeouts.
  - Normalizer: Reconciles observed runtime memory addresses (`&x`, `&p`, `(uintptr_t)p`), establishes pointer-to-storage resolution targets, tracks scalar mutations, and outputs canonical `ExecutionTrace v0.2` with `instrumentation-tracked` provenance.
  - Validation Gate: Enforces `validateExecutionTrace` on every generated trace before returning to the UI.
- [x] **Frontend Live Mode & Visualize Workflow:**
  - `Header`: Clean `Edit / Live Code` toggle and `Visualize` CTA button.
  - `CodeEditor`: Switches to editable CodeMirror 6 mode in Live Mode.
  - `App`: Connects `requestLiveTrace` to local Vite API endpoint `/api/visualize`, handles loading states, surfaces diagnostics on error, and updates the spatial memory canvas.
- [x] **Spatial Memory Visualizer (Hero Canvas):**
  - `MemoryBox`: Physical memory box displaying variable name, type, prominent scalar/pointer value, and hex memory address.
  - `ArrayMemoryBox`: Contiguous adjacent cells in a unified array container, with cell-specific mutation rings.
  - `StackFrameSection`: Spatial frame boundaries stacked vertically (callee above caller), displaying local variables and parameters.
  - `HeapSection`: Spatially separate dynamic memory card showing persistent allocations, sizes, and deallocated/expired states.
  - `PointerOverlay`: Dynamic SVG bezier curves connecting pointer boxes to target storage boxes. Dangling pointers render with dashed red connectors and a `DANGLING` pill; `nullptr` pointers display `nullptr (0x0)` with no connection.
  - Reference Aliasing: `&r` attaches directly to the referenced storage box as an alias badge without duplicating storage.
- [x] **Educational Narrative & Primary Layout:**
  - Snapshot-derived change explanation below the memory stage (`memoryPresentation.ts`).
  - Left column: Apple-light-themed CodeMirror 6 editor with line execution highlight.
  - Secondary terminal console: Collapsible drawer for program output.
  - Stepper Bar: Clean educational stepper (`Back ● ○ ○ ○ Next`) with play/pause and 1x/2x speed controls.
- [x] **Canonical Runtime Contract Boundary (`ExecutionTrace v0.2`):**
  - Single runtime truth model imported directly from `@visualized-gdb/execution-trace`.
  - Provenance tracked explicitly across all runtime facts (`debugger-observed`, `backend-inferred`, `instrumentation-tracked`, `fixture-authored`, `unknown`).
  - Distinct handling of semantic unknowns vs. debugger unavailability vs. error states (**"UNKNOWN IS BETTER THAN WRONG"**).
  - Explicit pointer resolution states (`resolved`, `null`, `unresolved`, `out-of-bounds`, `expired-by-observed-lifetime`, `unknown`).
- [x] **Snapshot-Derived State Transitions (`deltaDerivation.ts`):**
  - State deltas dynamically derived by diffing consecutive canonical snapshots.
- [x] **Complete Golden Fixture Suite (A through H) under Canonical v0.2:**
  - **A. Basic Variable Mutation:** `int x = 5; x = 10;`
  - **B. Pointer to Variable:** `int x = 5; int* p = &x;`
  - **C. Pointer Dereference Mutation:** `*p = 10;`
  - **D. Reference Binding & Aliasing:** `int x = 5; int& r = x; r = 20;`
  - **E. Fixed Array & Index Mutation:** `int arr[3] = {1, 2, 3}; arr[1] = 9;`
  - **F. Function Call Stack Push/Pop:** `add(x, y)` activation record push, parameter passing, and frame unwinding.
  - **G. Pointer-Based Swap:** Inter-frame memory mutation in `swap(int* a, int* b)`.
  - **H. Dynamic Memory Lifetime:** `new int(42); delete p; p = nullptr;` with explicit `expired-by-observed-lifetime` resolution and ended storage lifetime.
- [x] **Automated Verification:**
  - 14/14 canonical contract tests pass in `packages/execution-trace`.
  - 22/22 frontend tests pass in `frontend` (fixtures + validator).
  - Production build succeeds cleanly (`tsc && vite build`).
  - Total: 36/36 tests passing across repository.
  - `TerminalConsole`: Computes cumulative `stdout` from step deltas and highlights per-step output.
  - `StepperBar`: Timeline controls with play/pause, step scrubbing, speed multiplier, and keyboard navigation.
  - `Header`: TAKUMI Lab navigation and example selector; validation and provenance are in Details.
  - `extensionBridge`: Supports `?code=` URL parameter and `window.postMessage`.
- [x] **Automated Verification:**
  - 14/14 canonical contract tests pass in `packages/execution-trace`.
  - 22/22 frontend tests pass in `frontend` (fixtures + validator).
  - Production build succeeds cleanly (`tsc && vite build`).
  - Total: 36/36 tests passing across repository.

---

## 3. What Does NOT Work Yet (Deferred to Codex / Next Milestone)

- Live inferior process launch under LLDB on macOS ARM64 host remains unverified; investigation is paused by user scope.
- Production container/microVM sandbox for untrusted execution.
- STL container visualization (post-MVP).

---

## 4. Launch Instructions

Run `./start.sh` or:
```bash
cd frontend
npm run dev
```
Open `http://localhost:5173` to test the visualizer.
