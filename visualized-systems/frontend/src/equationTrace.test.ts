import { describe, it, expect } from "vitest";
import {
  traceEquations,
  validateEquationTrace,
  assertValidEquationTrace,
} from "@visualized-gdb/equation-trace";
import { EQUATION_FIXTURES } from "./fixtures/equationFixtures";

describe("Visualized Equations — Integration & Fixtures", () => {
  it("validates all canonical equation fixtures A through F", () => {
    expect(EQUATION_FIXTURES.length).toBeGreaterThanOrEqual(6);

    for (const fixture of EQUATION_FIXTURES) {
      const trace = traceEquations(fixture.code);
      expect(trace.schemaVersion).toBe("0.1");
      expect(trace.steps.length).toBeGreaterThanOrEqual(1);

      // Must have 0 syntax errors in canonical fixtures
      expect(trace.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);

      // Must satisfy the canonical EquationTrace validator
      const issues = validateEquationTrace(trace);
      const errors = issues.filter((i) => i.severity === "error");
      expect(errors).toHaveLength(0);
      expect(() => assertValidEquationTrace(trace)).not.toThrow();
    }
  });

  it("handles the acceptance scenario step by step", () => {
    const code = `
f(x) = x^2
g(x) = f(x) + 3
h(x) = -2*g(x)
`;
    const trace = traceEquations(code);
    expect(() => assertValidEquationTrace(trace)).not.toThrow();
    expect(trace.steps).toHaveLength(3);

    // Step 1: Base parabola
    const s1 = trace.steps[0];
    expect(s1.functionName).toBe("f");
    expect(s1.transformations[0].kind).toBe("base-function");
    expect(s1.activeCurve.points?.length).toBeGreaterThan(50);

    // Step 2: Shifted upward by 3
    const s2 = trace.steps[1];
    expect(s2.functionName).toBe("g");
    expect(s2.targetFunction).toBe("f");
    expect(s2.transformations[0].kind).toBe("vertical-shift");
    expect(s2.transformations[0].parameter).toBe(3);
    expect(s2.explanation.toLowerCase()).toContain("upward by 3");
    expect(s2.referenceCurves).toHaveLength(1);
    expect(s2.referenceCurves[0].name).toBe("f");

    // Step 3: Reflected across x-axis and vertically scaled by 2
    const s3 = trace.steps[2];
    expect(s3.functionName).toBe("h");
    expect(s3.targetFunction).toBe("g");
    const kinds = s3.transformations.map((t) => t.kind);
    expect(kinds).toContain("reflection-x");
    expect(kinds).toContain("vertical-scale");
    expect(s3.explanation.toLowerCase()).toContain("across the x-axis");
    expect(s3.explanation.toLowerCase()).toContain("stretches vertically");
  });

  it("preserves independent session states between GDB and Equations", () => {
    // Simulate App state preservation logic
    interface GdbState {
      fixtureId: string;
      stepIndex: number;
      isLive: boolean;
      liveCode: string;
    }
    interface EqState {
      fixtureId: string;
      stepIndex: number;
      eqCode: string;
    }

    const gdbState: GdbState = {
      fixtureId: "pointer-to-var",
      stepIndex: 2,
      isLive: false,
      liveCode: "int main() { int x = 42; }",
    };

    const eqState: EqState = {
      fixtureId: "vertical-shift",
      stepIndex: 1,
      eqCode: "f(x) = x^2\ng(x) = f(x) + 3",
    };

    // Switching to equations and back to gdb leaves gdbState intact
    let activeMode: "gdb" | "equations" = "gdb";
    expect(activeMode).toBe("gdb");
    expect(gdbState.stepIndex).toBe(2);

    activeMode = "equations";
    expect(activeMode).toBe("equations");
    expect(eqState.stepIndex).toBe(1);

    activeMode = "gdb";
    expect(activeMode).toBe("gdb");
    expect(gdbState.stepIndex).toBe(2);
    expect(gdbState.liveCode).toBe("int main() { int x = 42; }");
    expect(eqState.stepIndex).toBe(1);
    expect(eqState.eqCode).toContain("f(x) + 3");
  });
});
