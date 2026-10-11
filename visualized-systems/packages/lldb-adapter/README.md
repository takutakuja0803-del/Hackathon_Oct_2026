# Experimental local LLDB adapter

This is a constrained development experiment. It executes native code on the host and is **not a sandbox**. Do not expose it as a public arbitrary-code runner. Golden fixtures remain the reliable demo path. This module is deliberately isolated from the frontend and emits the frozen `@visualized-gdb/execution-trace` v0.2 shape.

Current target subset: debug builds (`-g -O0`) of simple C++ examples, selected source-line breakpoints, visible locals/parameters and scalar/pointer/array/aggregate SBValues. LLDB observations are tagged `debugger-observed`. The adapter assigns frame/variable/storage IDs and labels them as trace-local identity; pointer target matches based on exact equality with one observed variable address are tagged `backend-inferred`. It does not enumerate heap allocations, establish general object lifetime, prove initialization, infer dangling pointers, or provide a complete operation history. Reference referent identity stays unknown until LLDB behavior is verified.

## Manual experiment

```sh
clang++ -std=c++20 -g -O0 -fno-omit-frame-pointer \
  packages/lldb-adapter/examples/pointer_demo.cpp \
  -o /private/tmp/vgdb-pointer-demo

lldb --batch \
  -o "command script import '$(pwd)/packages/lldb-adapter/src/lldb_driver.py'" \
  -o "vgdb-run /private/tmp/vgdb-pointer-demo '$(pwd)/packages/lldb-adapter/examples/pointer_demo.cpp'"
```

LLDB writes a command prompt before the JSON payload. The driver currently uses fixed line breakpoints and has a 32-stop cap. This does not impose a safe wall-clock or OS resource boundary.

## Host experiment result (2026-10-10)

The C++ source compiled successfully with Apple Clang 21.0.0 for arm64. LLDB resolved source breakpoints (one location each), but could not launch the debuggee: `process exited with status -1 (no such process)`. The adapter emitted an `unknown` outcome, zero snapshots, and a diagnostic; that trace passed the v0.2 validator. Therefore actual runtime frame/value/address extraction remains unverified on this host. The LLDB SB API itself is available and its `SBType` interface was checked; this release exposes `IsArrayType` but not an array-extent accessor, so array extent stays unknown.

The adapter uses LLDB's documented SB API surface for target/process/frame/value operations: [SBValue](https://lldb.llvm.org/python_api/lldb.SBValue.html), [SBProcess](https://lldb.llvm.org/python_api/lldb.SBProcess.html), [script-driven debugging](https://lldb.llvm.org/use/tutorials/script-driven-debugging.html).
