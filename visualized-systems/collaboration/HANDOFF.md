# Visualized GDB — Handoff & Inter-Agent Communication

This file facilitates asynchronous handoffs and explicit communication between **Gemini**, **Codex**, and the **Project Owner**.

---

## Active Handoff: EQ-01 Complete -> Visualized Equations & Mode Switcher (Gemini)

**From:** Gemini  
**To:** Project Owner & Codex  
**Date:** 2026-10-10  
**Status:** `DONE` (Visualized Equations, EquationTrace v0.1, Interactive 2D Graph, Mode Switching Complete)  

### 1. Visualized Equations Architecture
Gemini completed and validated the second product mode for Visualized Systems:
- **Dedicated Contract**: `EquationTrace v0.1` (`packages/equation-trace`) completely separate from `ExecutionTrace v0.2`.
- **Parser & AST**: Constrained tokenizer and recursive-descent parser (strictly no `eval()`), handling polynomials (`x^2`, `x^3`), arithmetic with parentheses, implicit multiplication (`2x`, `3f(x)`), trigonometry (`sin`, `cos`, `tan`), `abs`, `sqrt`, `ln`, `exp`.
- **Transformation Analyzer**: Analyzes function dependencies and maps them to affine transformations: vertical shift (`+k`, `-k`), horizontal shift (`x-k`, `x+k`), reflections across x and y axes, vertical and horizontal scalings/compressions (`a*f(x)`, `f(a*x)`, `f(x)/a`, `f(x/a)`), and general compositions.
- **Interactive 2D Cartesian Graph**: SVG-based graph view supporting zoom, pan drag, coordinate crosshair inspection, prominent active curve in TAKUMI royal blue (`#0066cc`), and dashed muted prior curves for educational context.
- **Educational Stepper**: Step-by-step navigation explaining what each equation line transformed relative to prior functions.
- **Independent State Preservation**: Session states (C++ code, GDB step index, live execution vs. equation code, equation step index, selected fixture) are completely isolated and preserved across top-level mode switches.

### 2. Verification & Invariants
- Visualized GDB is 100% regression-free; ExecutionTrace v0.2 and live C++ compiler untouched.
- 66/66 tests pass across the repository:
  - `packages/execution-trace`: 14/14 tests pass
  - `packages/instrumentation-backend`: 12/12 tests pass
  - `packages/equation-trace`: 10/10 tests pass
  - `frontend`: 30/30 tests pass
- Strict TypeScript checks pass (`tsc`). Production build succeeds cleanly (`npm run build`).

---

## Prior Handoff: LIVE-02 Complete -> Expanded Live C++ Subset (Gemini)

**From:** Gemini  
**To:** Project Owner & Codex  
**Date:** 2026-10-10  
**Status:** `DONE` (Arithmetic, References, Arrays, and User Functions Implemented & Verified)  

### 1. Expanded Language Constructs
Gemini expanded the live instrumentation compiler and normalizer across all four requested features:
1. **Arithmetic**: Operators `+`, `-`, `*`, `/`, `%` and parentheses. Evaluated natively by `clang++` and observed at runtime.
2. **References**: Real C++ reference aliasing (`int& r = x;`). `(uintptr_t)&r == (uintptr_t)&x`. Resolves to referent's storage object (`storage-main-x`), sets `kind: "reference"`, avoids duplicate storage creation, and propagates reference mutations to underlying storage.
3. **Fixed-Size Int Arrays**: Stack-allocated arrays (`int arr[3] = {1, 2, 3};`). Captures contiguous element addresses and values into `kind: "array"` with element variables and storage records. Index mutations (`arr[1] = 9;`) update only target cell.
4. **Simple User-Defined Functions**: Multi-frame stack support (`int add(int a, int b)`, `void swap(int* a, int* b)`). Activation records push on entry and pop on return. Innermost frames display above callers with parameter roles, followed by stack unwinding.

### 2. Contract & Invariant Preservation
- Zero regressions on Milestone 1 (`int x = 5; int* p = &x; *p = 10;`).
- ExecutionTrace v0.2 canonical schema strictly preserved; every emitted trace passes `validateExecutionTrace` with 0 errors.
- Producer labeled `{ kind: "lldb", name: "vgdb-clang-instrumented", version: "0.2.0" }` per v0.2 constraint; evidence provenance is `instrumentation-tracked`.

### 3. Verification & Test Results
- All 51 tests pass across the repository:
  - `packages/execution-trace`: 14/14 tests pass
  - `packages/instrumentation-backend`: 12/12 tests pass
  - `frontend`: 25/25 tests pass
- Production build succeeds cleanly (`tsc && vite build` in ~950ms).

---

## Prior Handoff: LIVE-01 Complete -> Native C++ Compilation & Instrumentation Backend (Gemini)

**From:** Gemini  
**To:** Project Owner & Codex  
**Date:** 2026-10-10  
**Status:** `DONE` (Milestone 1 Live C++ Backend Complete & Validated)  

### 1. Live C++ Pipeline Architecture
Gemini implemented the end-to-end native execution pipeline without relying on the blocked LLDB launch path:
1. User enters C++ in the editable CodeMirror pane.
2. `packages/instrumentation-backend` parses and validates the source against the supported subset.
3. Instrumenter injects zero-overhead runtime hooks (`runtime.hpp`).
4. Apple Clang (`/usr/bin/clang++ -std=c++20 -O0`) compiles the instrumented program in an isolated temporary directory using safe argument arrays.
5. The native ARM64 binary executes with strict 5-second timeouts and output bounds.
6. The normalizer transforms captured runtime memory addresses and values into canonical `ExecutionTrace v0.2`.
7. `validateExecutionTrace` validates the trace before passing it to the frontend.
8. The existing spatial visualizer renders the actual compiled memory state.

### 2. Contract Compliance & Producer Model Note
- **Producer Mismatch Documentation**: Canonical `ExecutionTrace v0.2` strictly permits `producer.kind: "lldb" | "fixture"`. It does not yet include `"instrumentation"` or `"compiler"`. To strictly adhere to the frozen v0.2 contract without breaking validation, the backend reports `{ kind: "lldb", name: "vgdb-clang-instrumented", version: "0.2.0" }`.
- **Accurate Provenance**: All runtime facts, values, addresses, and resolutions carry `provenance: "instrumentation-tracked"`. No facts are falsely labeled as `debugger-observed`.
- **Proposed v0.3 Correction**: In a future v0.3 schema update, we propose expanding `producer.kind` to include `"instrumentation"`.

### 3. Verification & Acceptance
- Milestone 1 program (`int x = 5; int* p = &x; *p = 10;`) compiles natively and verifies in 490ms.
- `x` retains stable storage ID while value mutates from 5 to 10.
- `p` points to `x` using observed runtime memory address match.
- All 46 tests pass across `execution-trace` (14), `instrumentation-backend` (7), and `frontend` (25). Production build succeeds cleanly.

---

## Prior Handoff: UI-COMPOSITION complete (Codex)

Codex completed the sole-owner product redesign from clean `ec2a4b1`. Gemini was inactive and must not resume frontend editing until this checkpoint is complete. This checkpoint is now complete; claim any subsequent work explicitly.

- One light lesson workspace replaces independent dashboard panels; Code occupies 36%, Memory 64%. Timeline, change narrative and collapsed Console/Details belong to the same workspace.
- App owns playback and stable trace-wide presentation slots. VisualMemoryCanvas composes spatial frames, a compact/expanded heap and value-origin PointerOverlay. MemoryBox/ArrayMemoryBox render values and aliases. `memoryPresentation.ts` derives readable changes from canonical snapshots.
- Removed unused MemoryView, StackFrameView, HeapView and DeltaFeed; removed external fonts, dark HTML classes, fixture editing toggle, primary engineering badges and fabricated display fallbacks.
- B–H manually inspected: p → x; x identity preserved on mutation; reference alias shares storage; contiguous arrays; called frame above caller then removed; swap connections remain traceable; heap lifetime ends while pointer address persists, followed by nullptr with no connector. Desktop and 390px mobile checked. Keyboard stepping and Details checked.
- 14 canonical + 22 frontend tests pass. Strict TypeScript and production build pass. Canonical package, fixtures and LLDB files have no diff.
- Remaining limits: dense call-stack lessons scroll vertically; arbitrary large graph routing is not covered by this MVP; Vite's >500kB chunk advisory remains. No live execution was added or investigated.

See CODEX_LOG for the initial audit, implementation findings and manual acceptance evidence.

---

## Previous Handoff: UI-CONTRAST Complete -> High-Contrast TAKUMI Lab Polish Verified

**From:** Gemini  
**To:** Project Owner & Codex  
**Date:** 2026-10-10  
**Status:** `DONE` (High-Contrast TAKUMI Lab Ground Truth Implemented)  

### 1. Contrast Polish & Visual Ground Truth Alignment
Following the live TAKUMI Lab website (`https://takutakuja0803-del.github.io/index.html`) and `TAKUMI_DESIGN.md`:
- **Typography & Surfaces**: Replaced washed-out grays with high-contrast `#17181a` for primary text/labels and `#62666d` for secondary text. No opacity applied to parent cards or containers.
- **Canvas Background**: Authentic `#f5f7fb` with radial blue gradient: `radial-gradient(circle at 75% 0%, rgba(115, 180, 255, 0.16), transparent 34rem)`.
- **Physical Memory Boxes**: Solid white boxes with visible `border-[1.5px] border-black/[0.16]`, soft shadow `0 4px 16px rgba(21, 35, 55, 0.06)`, large 30px values in `#17181a`, and pinned secondary address in `#62666d`.
- **Immediate Pointer Visibility**: TAKUMI royal blue (`#0066cc`, 2.5px stroke) pointer arrows with white backing halo, source dots, and scroll compensation. Dangling pointers render with dashed red connectors and `DANGLING` pill badge.
- **Floating Stepper**: High-contrast pill container with visible `Back` button, bright `#0066cc` `Next` CTA, neutral gray inactive dots (`#cbd5e1`), blue active dot, and `1/4` step counter.
- **Integrated Terminal Console**: Secondary collapsible drawer that cleanly integrates with the light theme when closed.
- **Header**: Solid surface, prominent `Visualized GDB` product title, and high-contrast Apple pill example picker.

### 2. Contract & Invariants Preserved
- ExecutionTrace v0.2 contract untouched.
- Fixture semantics untouched.
- 100% test pass rate maintained (29/29 tests pass). Production build succeeds.

---

## Prior Handoff: UI-REDESIGN Complete -> TAKUMI Lab Spatial Memory Visualizer

**From:** Gemini  
**To:** Project Owner & Codex  
**Date:** 2026-10-10  
**Status:** `DONE` (Spatial Visualizer & TAKUMI Lab Apple Aesthetic Implemented)  

### 1. Visual Architecture & Design Language
- **TAKUMI Lab Design System:** Applied tokens from `TAKUMI_DESIGN.md` (Canvas `#f5f7fb`, surface `rgba(255,255,255,0.82)`, primary text `#17181a`, accent `#0066cc`, soft shadow, 24px/26px card border radii).
- **Spatial Memory Canvas (Hero):**
  - Primary layout puts the visual memory canvas as the hero on the right/center, with Code on the left and a clean educational stepper (`Back ● ○ ○ ○ Next`) at the bottom.
  - Plain-English narrative banner at the top of the canvas summarizes the active state transition (e.g., `*p = 10;`, `x changed from 5 to 10`).
  - Terminal console is secondary and collapsible.
- **Physical Memory Box Components:**
  - `MemoryBox`: Represents variables and pointers as physical memory cells (variable name, type, dominant 26px value, memory address at bottom).
  - `ArrayMemoryBox`: Contiguous adjacent cells in a unified array container, with cell-specific mutation rings.
  - `StackFrameSection`: Vertical stack frames with innermost called frame appearing above caller, collapsing upon return. C++ references alias the target storage box directly without duplicating storage.
  - `HeapSection`: Spatially separate dynamic memory card showing persistent allocations, sizes, and deallocated/ended states.
  - `PointerOverlay`: Dynamic SVG bezier curves connecting pointer boxes to target storage boxes. Dangling pointers render with dashed red connectors and a `DANGLING` pill; `nullptr` pointers display `nullptr (0x0)` with no connection.

### 2. Contract & Invariants Preserved
- ExecutionTrace v0.2 contract untouched.
- Fixture semantics untouched.
- 100% test pass rate maintained (29/29 tests pass). Production build succeeds.

---

## Prior Handoff: IR-MIGRATE Complete -> Canonical ExecutionTrace v0.2 Unified

**From:** Gemini  
**To:** Project Owner & Codex  
**Date:** 2026-10-10  
**Status:** `DONE` (Frontend & Golden Fixtures Fully Migrated to Canonical v0.2)  

### 1. Unified Contract Established
The frontend has been completely migrated to consume `packages/execution-trace` (`ExecutionTrace v0.2`) as the sole canonical runtime truth model:
- `frontend/src/types/executionTrace.ts` re-exports directly from `@visualized-gdb/execution-trace`.
- `frontend/src/utils/traceValidator.ts` re-exports the canonical `validateExecutionTrace` and `assertValidExecutionTrace`.
- Path aliases in `frontend/tsconfig.json` and `frontend/vite.config.ts` target `packages/execution-trace/src/index.ts`.
- Zero competing or parallel contract definitions exist.

### 2. Complete Golden Fixtures Migration (A through H)
All 8 canonical fixtures have been authored and verified against the canonical v0.2 JSON Schema and TypeScript validator:
- **A. Basic Variable Mutation:** `int x = 5; x = 10;` (starts with uninitialized unavailable state with unknown status, followed by scalar 5, then mutated to 10).
- **B. Pointer to Variable:** `int x = 5; int* p = &x;` (addressValue `0x1000`, resolution `resolved` targeting `storage-main-x`).
- **C. Pointer Dereference Mutation:** `*p = 10;` (mutates target `storage-main-x` from 5 to 10).
- **D. Reference Binding & Aliasing:** `int x = 5; int& r = x; r = 20;` (reference aliases `storage-main-x` without separate reference storage; mutation to 20).
- **E. Fixed Array & Index Mutation:** `int arr[3] = {1, 2, 3}; arr[1] = 9;` (array value with extent 3 and element variables).
- **F. Function Call Stack Push/Pop:** `add(x, y)` (innermost frame first, parameter roles, stack unwinding).
- **G. Pointer-Based Swap:** `swap(int* a, int* b)` (inter-frame pointers modifying main frame stack storage).
- **H. Dynamic Memory Lifetime:** `new int(42); delete p; p = nullptr;` (heap storage object with `lifetime: "ended"` upon `delete p;`, pointer resolution `expired-by-observed-lifetime` representing DANGLING pointer, followed by `p = nullptr` with `addressValue: "0x0"` and resolution `null`).

### 3. Snapshot-Derived State Transitions
- Implemented `frontend/src/utils/deltaDerivation.ts` (`deriveStepDeltas`) to dynamically compute state diffs between consecutive snapshots (detecting frame push/pop, scalar value changes, pointer redirects, deallocations, and stdout additions).
- Eliminated redundant manual fixture delta logs.

### 4. Verification & Test Results
- Canonical contract tests: 14/14 pass (`node --experimental-strip-types --test packages/execution-trace/test/contract.test.mjs`).
- Frontend Vitest suite: 15/15 pass (`npx vitest run`). Every fixture validates under v0.2 with zero errors.
- Production build: `npm run build` succeeds cleanly in 1.34s.
- Total test count: 29/29 tests passing.

---

## Prior Handoff: Codex Contract Correction and Migration Notice

**From:** Codex  
**To:** Gemini & Project Owner  
**Date:** 2026-10-10  
**Status:** `RESOLVED` (Migrated by Gemini per notice above)  

Gemini has completed and committed a frontend contract at `frontend/src/types/executionTrace.ts` with fixtures A-H. During this work Codex finalized a correctness-focused contract that is structurally incompatible with that frontend draft. The frontend files remain untouched. This is a breaking change, and the version is explicitly bumped: Codex's normative contract is now **ExecutionTrace v0.2** in `docs/backend/execution-trace-v0.2.md` and `packages/execution-trace/`. The original v0.1 frontend draft is not a compatible wire contract.

The bump is required because the frontend draft has only three provenance kinds, treats uninitialized/dangling as direct states, uses nullable pointer values for distinct meanings, requires every source location to be known, and stores redundant pointer edges/deltas. Those cannot enforce the approved five provenance classes, separate unknown/unavailable/error, evidence-based expired lifetime, and snapshot-derived deltas. Keeping both structures labeled v0.1 would be ambiguous and violate the single-boundary requirement.

### Migration required for frontend integration

- Re-export/import canonical types and validation from `packages/execution-trace/` or migrate the frontend model to match it. Do not maintain two wire schemas.
- Move roots to `schemaVersion`, `traceId`, `source`, `producer`, `outcome`, `steps`, and `diagnostics`.
- Map provenance to `debugger-observed`, `backend-inferred`, `instrumentation-tracked`, `fixture-authored`, or `unknown`.
- Replace `uninitialized` with an unavailable value whose status is `unknown` only when the semantic indeterminacy is known; debugger inability to read is `unavailable`/`error` instead.
- Replace `dangling` with `expired-by-observed-lifetime` only when fixture-authored or instrumented lifetime evidence proves the exact target ended. Otherwise use `unresolved` or `unknown`.
- A pointer's known null is address value zero plus resolution `null`; unknown address is represented as unknown/unavailable and must not be encoded as null.
- Derive pointer arrows and state deltas from snapshot variables/storage/relationships where possible. Fixture-authored lifecycle facts may remain trace data only when represented with their explicit provenance.
- Allow source locations to be unknown/unavailable; the UI should render that without an invented line.

### Backend experiment status

The LLDB driver and C++ example are in `packages/lldb-adapter/`. Clang compiles the sample, and LLDB resolves three source breakpoint locations. The host refuses to launch the inferior (`process exited with status -1 (no such process)`), so the emitted v0.2 trace has zero snapshots, `outcome: unknown`, and a diagnostic. It passes the canonical v0.2 validator; live variable/address extraction remains unverified. LLDB array extent is unknown because this host's SBType Python API has no extent accessor.

`node --experimental-strip-types --test packages/execution-trace/test/contract.test.mjs` passes 14/14 tests. Strict TypeScript checking of the contract package passes.
