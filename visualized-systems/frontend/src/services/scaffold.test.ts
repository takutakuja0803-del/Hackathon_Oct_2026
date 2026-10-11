import { describe, it, expect } from "vitest";
import { parseScaffold } from "./scaffold";

describe("parseScaffold", () => {
  it("reads the ast_explain JSON shape, even inside code fences", () => {
    const text =
      '```json\n{"eli5":{"english":"x becomes 10","native":"x se convierte en 10"},' +
      '"steps":[{"line":2,"code":"int x = 5;","english":"Makes a box x holding 5.","native":"Crea una caja x con 5."}]}\n```';
    const result = parseScaffold(text);
    expect(result.eli5.native).toBe("x se convierte en 10");
    expect(result.steps).toEqual([
      { line: 2, code: "int x = 5;", english: "Makes a box x holding 5.", native: "Crea una caja x con 5." },
    ]);
  });

  it("rejects replies with nothing to show", () => {
    expect(() => parseScaffold("Sorry, I cannot help.")).toThrow();
    expect(() => parseScaffold('{"eli5":{},"steps":[]}')).toThrow();
  });
});
