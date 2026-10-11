import scalarPointer from "../fixtures/scalar-pointer.json" with { type: "json" };
import unknownAndUnavailable from "../fixtures/unknown-and-unavailable.json" with { type: "json" };
import framesArraysReferences from "../fixtures/frames-arrays-references.json" with { type: "json" };
import type { ExecutionTrace } from "./index.ts";

export const canonicalTraces: ExecutionTrace[] = [scalarPointer as ExecutionTrace, unknownAndUnavailable as ExecutionTrace, framesArraysReferences as ExecutionTrace];
