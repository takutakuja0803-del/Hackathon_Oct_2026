import type { ExecutionTrace, TraceDiagnostic } from '../../execution-trace/src/index.ts';

export interface RawArrayElementRecord {
  name: string;
  address: string;
  sizeBytes: number;
  scalarValue: number;
}

export interface RawVariableRecord {
  name: string;
  type: string;
  role: string;
  address: string;
  sizeBytes: number;
  isPointer: boolean;
  pointerValue?: string;
  isNull?: boolean;
  isReference?: boolean;
  refTargetName?: string;
  isArray?: boolean;
  arrayExtent?: number;
  arrayElements?: RawArrayElementRecord[];
  hasScalar: boolean;
  scalarValue?: number;
}

export interface RawFrameRecord {
  id: string;
  functionName: string;
  locationLine: number;
  variables: RawVariableRecord[];
}

export interface RawStepRecord {
  index: number;
  line: number;
  description: string;
  frames: RawFrameRecord[];
}

export interface ParsedFunction {
  name: string;
  returnType: string;
  parameters: Array<{ name: string; type: string }>;
  startLine: number;
  endLine: number;
  statements: ParsedStatement[];
}

export interface ParsedStatement {
  kind:
    | 'declaration'
    | 'assignment'
    | 'deref_assignment'
    | 'reference_declaration'
    | 'array_declaration'
    | 'array_assignment'
    | 'return'
    | 'expression';
  line: number;
  rawText: string;
  varName?: string;
  varType?: string;
  expr?: string;
  isPointer?: boolean;
  isReference?: boolean;
  refTargetName?: string;
  isArray?: boolean;
  arrayExtent?: number;
  arrayIndex?: string;
  description: string;
}

export interface TraceOptions {
  timeoutMs?: number;
  standard?: string;
  compilerPath?: string;
}

export interface TraceResult {
  success: boolean;
  trace?: ExecutionTrace;
  diagnostics: TraceDiagnostic[];
  error?: string;
}
