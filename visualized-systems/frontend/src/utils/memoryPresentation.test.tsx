import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GOLDEN_FIXTURES } from "../fixtures";
import { presentChanges, valueText } from "./memoryPresentation";
import { StackFrameSection } from "../components/MemoryView/StackFrameSection";
import { MemoryBox } from "../components/MemoryView/MemoryBox";
import { ArrayMemoryBox } from "../components/MemoryView/ArrayMemoryBox";
import type { Variable } from "@visualized-gdb/execution-trace";
describe("memory presentation preserves canonical facts", () => {
  it("explains pointers with variable names, not storage IDs", () => {
    const t = GOLDEN_FIXTURES[1].trace;
    expect(presentChanges(t.steps[1], t.steps[0]).messages).toContain(
      "p points to x.",
    );
  });
  it("highlights the same scalar identity after dereference", () => {
    const t = GOLDEN_FIXTURES[2].trace;
    const p = presentChanges(t.steps[2], t.steps[1]);
    expect(p.messages).toContain("x changed from 5 to 10.");
    expect([...p.changed]).toEqual(["var-main-x"]);
  });
  it("tracks individual array elements and names their parent", () => {
    const t = GOLDEN_FIXTURES[4].trace;
    const p = presentChanges(t.steps[1], t.steps[0]);
    expect(p.messages).toContain("arr[1] changed from 2 to 9.");
    expect(
      p.changed.has("var-arr-1") ||
        [...p.changed].some((id) => id.includes("1")),
    ).toBe(true);
  });
  it("keeps unknown, unavailable and errors distinct", () => {
    for (const [status, text] of [
      ["unknown", "Unknown"],
      ["unavailable", "Unavailable"],
      ["error", "Read error"],
    ] as const) {
      const value =
        status === "error"
          ? {
              kind: "unavailable" as const,
              availability: { status, message: "read failed" },
              provenance: "unknown" as const,
            }
          : {
              kind: "unavailable" as const,
              availability: { status, reason: "not observed" },
              provenance: "unknown" as const,
            };
      expect(valueText(value)).toBe(text);
      const html = renderToStaticMarkup(
        <MemoryBox name="x" type="int" value={value} />,
      );
      expect(html).toContain(text);
      expect(html).not.toContain("Uninitialized");
      expect(html).toContain("Address unknown");
    }
  });
  it("retains unresolved reference visibility without creating storage", () => {
    const t = GOLDEN_FIXTURES[3].trace;
    const step = structuredClone(t.steps[1]);
    const ref = step.frames[0].variables.find(
      (v) => v.value.kind === "reference",
    )!;
    ref.value = {
      kind: "reference",
      display: "r",
      target: {
        status: "unknown",
        reason: "unobserved",
        provenance: "unknown",
      },
      availability: { status: "available" },
      provenance: "unknown",
    };
    const html = renderToStaticMarkup(
      <StackFrameSection
        frames={step.frames}
        storageObjects={step.storage}
        slots={new Map([[step.frames[0].id, ["var-main-x"]]])}
      />,
    );
    expect(html).toContain("alias target unknown");
    expect(html).not.toContain(`data-var-id="${ref.id}"`);
  });
  it("does not guess array addresses or a missing declared extent", () => {
    const v: Variable = structuredClone(
      GOLDEN_FIXTURES[4].trace.steps[0].frames[0].variables[0],
    );
    if (v.value.kind !== "array") throw Error("array fixture");
    v.value.extent = { status: "unknown", reason: "not observed" };
    v.value.elements.forEach((e) => {
      delete e.address;
    });
    const html = renderToStaticMarkup(<ArrayMemoryBox variable={v} />);
    expect(html).toContain("Unknown");
    expect(html).toContain("Address unknown");
    expect(html).not.toContain("+4B");
  });
  it("reports ended lifetime and preserves dangling address until null", () => {
    const t = GOLDEN_FIXTURES[7].trace;
    expect(presentChanges(t.steps[1], t.steps[0]).messages).toContain(
      "The allocation’s lifetime ended.",
    );
    const pointer = t.steps[1].frames[0].variables[0];
    expect(valueText(pointer.value)).toBe("0x3000");
    expect(valueText(t.steps[2].frames[0].variables[0].value)).toBe("nullptr");
  });
});
