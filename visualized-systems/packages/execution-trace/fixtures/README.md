# Canonical ExecutionTrace v0.2 fixtures

These JSON files use the same contract as LLDB output. Values, identities, and addresses in fixtures are authored pedagogical trace data, not claims about execution on the current host. `fixture-authored` makes that provenance explicit. The scalar/pointer example contains three authored snapshots for:

1. `x` initialized to 5
2. `p` holding the observed/authored address of `x` and resolving to its trace-local storage identity
3. `*p = 10` reflected in the next snapshot

The unknown-values fixture distinguishes semantic unknown from a value that a debugger could not provide. Neither state carries a fabricated scalar payload.
