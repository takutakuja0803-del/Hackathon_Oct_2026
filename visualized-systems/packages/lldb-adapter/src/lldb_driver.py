"""Experimental LLDB in-process command; never an isolation boundary."""
import json
import os
import shlex
import lldb


def _text(value):
    return value if value else None


def _evidence(value, provenance="debugger-observed"):
    return {"value": value, "provenance": provenance}


def _location(file_path, line, provenance="debugger-observed"):
    if line > 0:
        return {"status": "known", "file": _evidence(file_path, provenance), "line": _evidence(line, provenance)}
    return {"status": "unknown", "reason": "LLDB did not provide a source line for this stop."}


def _safe_value(value):
    if not value.IsValid():
        return {"kind": "unavailable", "availability": {"status": "unavailable", "reason": "LLDB returned an invalid SBValue."}, "provenance": "debugger-observed"}
    err = value.GetError()
    type_obj = value.GetType()
    type_name = type_obj.GetDisplayTypeName() or type_obj.GetName() or ""
    if not err.Success():
        return {"kind": "unavailable", "availability": {"status": "error", "message": err.GetCString() or "LLDB value read failed", "code": "lldb.value-read"}, "provenance": "debugger-observed"}
    if type_obj.IsPointerType():
        raw = value.GetValue()
        addr = value.GetValueAsUnsigned(lldb.LLDB_INVALID_ADDRESS)
        if addr == lldb.LLDB_INVALID_ADDRESS:
            av = {"status": "unavailable", "reason": "LLDB could not read pointer value."}
            resolution = {"status": "unknown", "reason": "Pointer value unavailable.", "provenance": "unknown"}
        else:
            av = _evidence("0x%x" % addr)
            resolution = {"status": "unresolved", "reason": "Pointer target matching is performed after all observed storage objects are collected.", "provenance": "backend-inferred"}
        return {"kind": "pointer", "display": raw or "<pointer>", "addressValue": av, "resolution": resolution, "availability": {"status": "available"}, "provenance": "debugger-observed"}
    if type_obj.IsReferenceType():
        # SBValue often represents a C++ reference through its referent. Preserve
        # the referent value but only claim target identity if storage matching proves it.
        addr = value.GetLoadAddress()
        target = {"status": "unknown", "reason": "LLDB reference alias target identity was not established.", "provenance": "unknown"}
        return {"kind": "reference", "display": value.GetValue() or "<reference>", "target": target, "availability": {"status": "available"}, "provenance": "debugger-observed"}
    if type_obj.IsArrayType():
        children = []
        for i in range(value.GetNumChildren()):
            children.append(_variable(value.GetChildAtIndex(i), "element", "[%d]" % i))
        return {"kind": "array", "elements": children, "extent": {"status": "unknown", "reason": "This LLDB SBType API does not expose the declared array extent."}, "availability": {"status": "available"}, "provenance": "debugger-observed"}
    if type_obj.IsAggregateType():
        children = []
        for i in range(value.GetNumChildren()):
            child = value.GetChildAtIndex(i)
            children.append(_variable(child, "member", child.GetName() or "[%d]" % i))
        return {"kind": "aggregate", "children": children, "availability": {"status": "available"}, "provenance": "debugger-observed"}
    return {"kind": "scalar", "display": value.GetValue() or value.GetSummary() or "<no-display>", "encoding": "other", "availability": {"status": "available"}, "provenance": "debugger-observed"}


def _drain_output(process, method_name, limit=1024 * 1024):
    chunks = []
    total = 0
    truncated = False
    method = getattr(process, method_name)
    while total < limit:
        chunk = method(min(65536, limit - total))
        if not chunk:
            break
        if isinstance(chunk, bytes):
            chunk = chunk.decode("utf-8", errors="replace")
        chunks.append(chunk)
        total += len(chunk.encode("utf-8"))
        if total >= limit:
            truncated = bool(method(1))
            break
    return "".join(chunks), truncated


def _variable(value, role, fallback_name=None, frame_id="frame:unknown:0"):
    name = value.GetName() or fallback_name or ""
    type_obj = value.GetType()
    type_name = type_obj.GetDisplayTypeName() or type_obj.GetName() or ""
    if not name:
        name_field = {"status": "unavailable", "reason": "LLDB did not provide a variable name."}
    else:
        name_field = _evidence(name)
    if not type_name:
        type_field = {"status": "unavailable", "reason": "LLDB did not provide a type name."}
    else:
        type_field = _evidence(type_name)
    address = value.GetLoadAddress()
    variable = {
        "id": frame_id + ":var:" + role + ":" + (name or "unnamed"),
        "name": name_field,
        "type": type_field,
        "role": role,
        "value": _safe_value(value),
    }
    if address != lldb.LLDB_INVALID_ADDRESS and not type_obj.IsReferenceType():
        variable["address"] = _evidence("0x%x" % address)
        # Identity is derived from frame activation + variable identity, never from address.
        variable["storageId"] = frame_id + ":storage:" + role + ":" + (name or "unnamed")
    return variable


class _FrameIdentityTracker:
    def __init__(self):
        self.stack_outer_to_inner = []
        self.next_id = 0

    def assign(self, functions_inner_to_outer):
        current = list(reversed(functions_inner_to_outer))
        common = 0
        while common < len(current) and common < len(self.stack_outer_to_inner) and current[common][0] == self.stack_outer_to_inner[common][0]:
            common += 1
        self.stack_outer_to_inner = self.stack_outer_to_inner[:common]
        for function_name, _ in current[common:]:
            self.stack_outer_to_inner.append((function_name, "frame-activation-%d" % self.next_id))
            self.next_id += 1
        return list(reversed([entry[1] for entry in self.stack_outer_to_inner]))


def _snapshot(process, source, index, frame_tracker):
    thread = process.GetSelectedThread()
    descriptors = []
    if thread.IsValid():
        for frame_index in range(thread.GetNumFrames()):
            current = thread.GetFrameAtIndex(frame_index)
            function = current.GetFunctionName() or current.GetDisplayFunctionName() or ""
            descriptors.append((function, current))
    frame_ids = frame_tracker.assign([name for name, _ in descriptors])
    frames = []
    storage_by_id = {}
    for frame_index, (function, current) in enumerate(descriptors):
        line_entry = current.GetLineEntry()
        line = line_entry.GetLine() if line_entry.IsValid() else 0
        file_spec = line_entry.GetFileSpec() if line_entry.IsValid() else lldb.SBFileSpec()
        file_path = file_spec.GetPath() if file_spec.IsValid() else source
        frame_id = frame_ids[frame_index] if frame_index < len(frame_ids) else "frame-unknown-%d" % frame_index
        variables = []
        for v in current.GetVariables(True, True, True, True):
            vv = _variable(v, "parameter" if v.GetValueType() == lldb.eValueTypeVariableArgument else "local", frame_id=frame_id)
            variables.append(vv)
            sid = vv.get("storageId")
            if sid:
                address = vv.get("address")
                storage_by_id[sid] = {
                    "id": sid,
                    "kind": "stack",
                    "address": address,
                    "type": vv["type"] if isinstance(vv["type"], dict) and "value" in vv["type"] else None,
                    "lifetime": "unknown",
                    "provenance": "backend-inferred",
                }
        frames.append({
            "id": frame_id,
            "functionName": _evidence(function) if function else {"status": "unavailable", "reason": "LLDB did not resolve function name."},
            "location": _location(file_path, line),
            "variables": variables,
        })
    # Conservatively resolve pointer values to exactly one observed variable address.
    addresses = {}
    for sid, storage in storage_by_id.items():
        a = storage.get("address", {}).get("value")
        if a: addresses.setdefault(a.lower(), []).append(sid)
    for fr in frames:
        for var in fr["variables"]:
            val = var["value"]
            if val.get("kind") != "pointer" or not isinstance(val.get("addressValue"), dict) or "value" not in val["addressValue"]:
                continue
            target_addr = val["addressValue"]["value"].lower()
            matches = addresses.get(target_addr, [])
            if len(matches) == 1:
                val["resolution"] = {"status": "resolved", "targetStorageId": matches[0], "offsetBytes": 0, "provenance": "backend-inferred"}
            elif target_addr in ("0x0", "0x0000000000000000"):
                val["resolution"] = {"status": "null", "provenance": "debugger-observed"}
            else:
                val["resolution"] = {"status": "unresolved", "reason": "No unique observed storage object begins at the pointer value.", "provenance": "backend-inferred"}
    stop_desc = process.GetStopDescription(256) or "LLDB stopped"
    reason = "unknown"
    if thread.IsValid() and thread.GetStopReason() == lldb.eStopReasonBreakpoint: reason = "breakpoint"
    elif thread.IsValid() and thread.GetStopReason() == lldb.eStopReasonPlanComplete: reason = "step"
    loc = frames[0]["location"] if frames else {"status": "unknown", "reason": "No frames at stop."}
    stdout, stdout_truncated = _drain_output(process, "GetSTDOUT")
    stderr, stderr_truncated = _drain_output(process, "GetSTDERR")
    notes = ["LLDB selected line stops only; this is not a complete C++ operation history.", "Storage records cover observed frame variables only; heap census and object lifetime are unknown.", "Pointer resolution is an inference from exact address equality with observed variable storage."]
    if stdout_truncated or stderr_truncated:
        notes.append("Captured process output reached the 1 MiB per-stop limit and may be truncated.")
    return {
        "index": index,
        "location": loc,
        "stop": {"reason": reason, "description": stop_desc},
        "frames": frames,
        "storage": list(storage_by_id.values()),
        "stdout": stdout, "stderr": stderr,
        "observations": {"completeness": "partial", "notes": notes},
    }


def vgdb_run(debugger, command, result, internal_dict):
    args = shlex.split(command)
    if len(args) != 2:
        result.SetError("usage: vgdb-run <binary> <source-file>")
        return
    binary, source = args
    target = debugger.CreateTarget(binary)
    if not target.IsValid():
        result.SetError("LLDB could not create target")
        return
    source = os.path.abspath(source)
    source_lines = open(source, encoding="utf-8").read().splitlines()
    breakpoint_summary = []
    for line_number, text in enumerate(source_lines, 1):
        stripped = text.strip()
        if stripped and not stripped.startswith(("//", "/*", "*", "}")):
            bp = target.BreakpointCreateByLocation(source, line_number)
            breakpoint_summary.append({"line": line_number, "locations": bp.GetNumLocations(), "enabled": bp.IsEnabled()})
    error = lldb.SBError()
    launch_info = lldb.SBLaunchInfo([])
    launch_info.SetWorkingDirectory(os.getcwd())
    process = target.Launch(launch_info, error)
    if not process.IsValid():
        result.SetError("LLDB failed to launch target: " + (error.GetCString() or "no SBError detail"))
        return
    steps = []
    seen = set()
    frame_tracker = _FrameIdentityTracker()
    limit = 32
    stop_count = 0
    while process.GetState() == lldb.eStateStopped and stop_count < limit:
        stop_count += 1
        snapshot = _snapshot(process, source, len(steps), frame_tracker)
        key = (snapshot["location"].get("line", {}).get("value", {}).get("value"), tuple((v["id"], v["value"].get("display")) for f in snapshot["frames"] for v in f["variables"]))
        if key not in seen:
            seen.add(key)
            steps.append(snapshot)
        process.Continue()
    final_state = process.GetState()
    exit_status = process.GetExitStatus()
    outcome = "completed" if final_state == lldb.eStateExited and exit_status >= 0 else ("runtime-error" if final_state == lldb.eStateCrashed else ("limit-reached" if stop_count >= limit else ("stopped" if steps else "unknown")))
    trace = {
        "schemaVersion": "0.2",
        "traceId": "lldb-experiment",
        "source": {"language": "cpp", "standard": "c++20", "text": open(source, encoding="utf-8").read()},
        "producer": {"kind": "lldb", "name": "Apple LLDB", "version": lldb.SBDebugger.GetVersionString(), "target": target.GetTriple()},
        "outcome": outcome,
        "steps": steps,
        "diagnostics": [{"severity": "warning", "code": "experiment.unisolated-native", "message": "Experimental local native execution. This adapter is not a sandbox and is not a safe public execution service.", "provenance": "backend-inferred"}],
    }
    if not steps:
        trace["diagnostics"].append({"severity": "error", "code": "lldb.no-snapshots", "message": "No selected line breakpoint snapshot was captured. Breakpoints: %s; process state=%s exit status=%s launch error=%s" % (breakpoint_summary, final_state, exit_status, error.GetCString() or "none"), "provenance": "debugger-observed"})
    result.PutCString(json.dumps(trace, indent=2))


def __lldb_init_module(debugger, internal_dict):
    debugger.HandleCommand("command script add -f lldb_driver.vgdb_run vgdb-run")
