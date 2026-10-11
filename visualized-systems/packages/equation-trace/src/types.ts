export const EQUATION_TRACE_VERSION = "0.1" as const;

export type TransformationKind =
  | "base-function"
  | "vertical-shift"
  | "horizontal-shift"
  | "vertical-scale"
  | "horizontal-scale"
  | "reflection-x"
  | "reflection-y"
  | "composition"
  | "unknown";

export interface MathTransformation {
  kind: TransformationKind;
  parameter?: number;
  description: string;
  targetFunction?: string;
}

export interface PlottedPoint {
  x: number;
  y: number;
}

export interface CurveSnapshot {
  name: string;
  expression: string;
  color?: string;
  isCurrent: boolean;
  points?: PlottedPoint[];
}

export interface EquationStep {
  index: number;
  sourceLine: number; // 1-based line in equation source
  rawText: string;
  functionName: string; // e.g. "f", "g", "h"
  parameterName: string; // e.g. "x"
  expressionText: string; // e.g. "x^2", "f(x) + 3"
  dependencies: string[]; // e.g. ["f"]
  targetFunction?: string; // e.g. "f"
  transformations: MathTransformation[];
  explanation: string;
  activeCurve: CurveSnapshot;
  referenceCurves: CurveSnapshot[]; // prior curves for educational context
}

export interface EquationDiagnostic {
  severity: "error" | "warning";
  code: string;
  message: string;
  line?: number;
}

export interface EquationTrace {
  schemaVersion: typeof EQUATION_TRACE_VERSION;
  traceId: string;
  source: {
    text: string;
    lines: string[];
  };
  steps: EquationStep[];
  diagnostics: EquationDiagnostic[];
}
