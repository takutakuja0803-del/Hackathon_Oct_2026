# ExecutionTrace v0.2 contract

**Status: frozen for parallel implementation.** The machine-readable JSON Schema and TypeScript types live in `packages/execution-trace/`. Golden fixtures and LLDB output use this same contract. Do not add fields or change meanings silently. A breaking change requires a new schema version, a reason, migration notes, and a HANDOFF entry before code changes.

## Boundary and snapshot meaning

`ExecutionTrace` is the only runtime-state boundary. It is a sequence of snapshots at intentional stops, not a complete C++ operation/event log. One source line may contain several operations; the debugger may stop before or after a line according to its line table. `index` is zero-based and contiguous. `location.line` and `column` are 1-based source positions. Frames are innermost first.

`storage` lists only storage objects the producer can justify. It is not a census of process memory or the heap. `lifetime` is `live`, `ended`, or `unknown`; its provenance says whether that status was observed, tracked, fixture-authored, or inferred. An optional `address` is a runtime address observation and is never an identity. `id` values are trace-local identities; when the producer can establish continuity, it reuses IDs across snapshots. IDs need only be unique within an individual snapshot for frames, variables, and storage, while identities may recur across snapshots. Frontends should key temporal continuity by these IDs.

## Provenance

Every runtime fact that could be interpreted as truth has provenance, directly on an evidence wrapper or value/relationship:

- `debugger-observed`: returned by LLDB at this stop (for example, a frame variable's displayed value or address). It does not establish facts the debugger did not return.
- `backend-inferred`: derived conservatively from observations (for example, matching a pointer's numeric value to exactly one observed storage range). Inference must be explainable and may resolve to unknown when ambiguous.
- `instrumentation-tracked`: recorded by compiler/runtime instrumentation or explicit adapter hooks. Only instrumentation that actually ran may assert tracked events.
- `fixture-authored`: facts declared for a canonical example's known snapshots. They describe the fixture's stipulated execution and are not measurements of the current host.
- `unknown`: no justified fact exists. Unknown must not carry a guessed value or target.

Fixture producers must use `fixture-authored` for authored runtime facts. Fixture producers claiming `debugger-observed` produce a warning in validation. Compiler identity, producer name, source text, and stop description are metadata, not runtime facts.

## Values, unknowns, errors

A `RuntimeValue` is a tagged union: `scalar`, `aggregate`, `array`, `pointer`, `reference`, or `unavailable`. Scalar display is presentation text; it is not a round-trippable C++ value. `unavailable` carries one of:

- `unknown`: the semantic/runtime fact is not known (e.g. an uninitialized object's value is indeterminate).
- `unavailable`: a tool/observation could not provide the fact (e.g. optimized out, no debug value, unreadable memory).
- `error`: an observation attempt failed with an explicit diagnostic.

These states are not interchangeable. A debugger failure does not mean the C++ value is uninitialized. A source declaration without an initializer does not permit showing arbitrary bytes as its value. The current fixture uses unknown and unavailable to demonstrate the distinction; it does not claim LLDB's output proves indeterminate state.

## Pointer and reference resolution

`addressValue` preserves the pointer's displayed/address value when available. It is separate from `resolution`, which identifies a target by storage ID:

- `resolved`: exactly one justified storage object contains the target address; offset is relative to that storage object. The current MVP only resolves exact object starts unless a producer can justify a byte offset.
- `null`: the pointer value is known to be null. Validation requires an evidenced zero address (`0x0`); a nonzero or unavailable address contradicts this state.
- `unresolved`: pointer value is known, but no currently justified object match exists. This is not a dangling-pointer claim.
- `out-of-bounds`: only when a producer knows the target storage extent and proves the offset falls outside it. Not required for live LLDB MVP.
- `expired-by-observed-lifetime`: only after evidence establishes that the same storage identity's lifetime ended. Provenance records whether evidence came from debugger observation, instrumentation, or a fixture. Never infer this from a failed read or an unmatched address.
- `unknown`: pointer value or target identity cannot be determined. Provenance must be `unknown`.

References use the same target resolution vocabulary, but cannot be null in valid C++. A reference with null resolution is contradictory and should be rejected by validation; if the adapter cannot find its referent, use `unknown` or `unresolved`. A reference is an alias, not an independent pointer object. Its variable record should not claim separate reference storage unless that storage fact is specifically observed as an implementation detail; do not render it as a pointer slot by default.

## Observation and deltas

`observations.completeness` is `partial` when the producer knows some state may be missing; v0.2 currently has no claim of a complete process snapshot. Notes explain limits (optimized-out values, selected breakpoints, unsupported types). Deltas are derived by comparing adjacent snapshots by IDs. No serialized delta is needed in v0.2, avoiding contradictions between snapshots and a second authored change log. Output strings are per-step additions, not cumulative buffers.

## Validation

`validateExecutionTrace` checks the v0.2 version, required structure, contiguous step indexes, line ranges, typed-value shape, trace-local identity rules, pointer resolution references, null/address contradictions, and provenance constraints. Unknown/unavailable states are valid data. Contradictory or malformed claims are errors; incomplete observations are not errors. Fixture provenance on LLDB-produced facts is permitted only if explicitly fixture data is being replayed, not relabeled as LLDB output. The frontend may reject traces with errors and should display warnings/unknowns without inventing state.

The JSON Schema performs structural checks. The TypeScript validator adds cross-record and source-range invariants; producers and frontend consumers should run both where a JSON Schema implementation is available.

## Field provenance by producer

| Fields | LLDB adapter | Fixtures |
|---|---|---|
| `source`, `producer`, `outcome`, `steps[].index` | adapter/host metadata; index is backend-assigned | fixture-authored metadata/index |
| step/frame source locations and function names | debugger-observed when LLDB supplies them; unknown otherwise | fixture-authored |
| variable names/types/value display/address | debugger-observed when LLDB supplies them; unavailable/unknown otherwise | fixture-authored |
| frame/variable/storage IDs | backend-inferred stable identities; never raw addresses | fixture-authored stable identities |
| storage records and lifetimes | only debugger-observed or instrumentation-tracked evidence; otherwise omit or `unknown` | fixture-authored only for stated scenario |
| pointer numeric value | debugger-observed if returned by LLDB | fixture-authored |
| pointer/reference target resolution | backend-inferred from observed storage ranges, instrumentation-tracked, fixture-authored, or unknown | fixture-authored |
| stop details and output | debugger-observed/host-captured | fixture-authored |
| observations and diagnostics | backend-authored explanation; provenance identifies evidence class | fixture-authored explanation |

## Canonical traces

`packages/execution-trace/fixtures/` contains minimal same-schema examples: scalar/pointer reassignment through indirection; nested frames with arrays and references; unknown and unavailable values. Fixture addresses are illustrative and explicitly fixture-authored. They demonstrate the contract; they do not claim to be LLDB captures.
