import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkUrlCodeParam,
  normalizeMathSnippet,
  registerPostMessageListener,
  type ExternalCodePayload,
} from "./extensionBridge";
import { traceEquations } from "@visualized-gdb/equation-trace";

describe("Extension Bridge (Visualized Systems)", () => {
  let listeners: ((event: any) => void)[] = [];

  beforeEach(() => {
    listeners = [];
    (globalThis as any).window = {
      location: new URL("http://localhost:5173/"),
      addEventListener: vi.fn((event: string, cb: any) => {
        if (event === "message") listeners.push(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: any) => {
        if (event === "message") {
          listeners = listeners.filter((l) => l !== cb);
        }
      }),
    };
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it("extracts raw C++ code from ?code= query param", () => {
    (globalThis as any).window.location = new URL(
      "http://localhost:5173/?code=" + encodeURIComponent("int x = 5;")
    );

    const payload = checkUrlCodeParam();
    expect(payload).not.toBeNull();
    expect(payload?.code).toBe("int x = 5;");
    expect(payload?.mode).toBe("gdb");
  });

  it("extracts base64 encoded C++ code from ?code= query param", () => {
    const raw = "int main() { return 0; }";
    const b64 = Buffer.from(raw).toString("base64");
    (globalThis as any).window.location = new URL(`http://localhost:5173/?code=${b64}`);

    const payload = checkUrlCodeParam();
    expect(payload).not.toBeNull();
    expect(payload?.code).toBe(raw);
    expect(payload?.mode).toBe("gdb");
  });

  it("extracts equations code from ?mode=equations&equations= param", () => {
    const eq = "f(x) = x^2\ng(x) = f(x) + 3";
    (globalThis as any).window.location = new URL(
      `http://localhost:5173/?mode=equations&equations=${encodeURIComponent(eq)}`
    );

    const payload = checkUrlCodeParam();
    expect(payload).not.toBeNull();
    expect(payload?.code).toBe(eq);
    expect(payload?.mode).toBe("equations");
  });

  it("listens for postMessage events for both GDB and Equations", () => {
    const received: ExternalCodePayload[] = [];
    const cleanup = registerPostMessageListener((p) => received.push(p));

    // Dispatch VGDB_LOAD_CODE
    listeners.forEach((fn) =>
      fn({
        data: {
          type: "VGDB_LOAD_CODE",
          payload: { code: "int y = 10;", title: "GDB Snippet" },
        },
      })
    );

    // Dispatch VEQ_LOAD_CODE
    listeners.forEach((fn) =>
      fn({
        data: {
          type: "VEQ_LOAD_CODE",
          payload: { code: "f(x) = sin(x)", title: "Sine Wave" },
        },
      })
    );

    expect(received).toHaveLength(2);
    expect(received[0].code).toBe("int y = 10;");
    expect(received[0].mode).toBe("gdb");

    expect(received[1].code).toBe("f(x) = sin(x)");
    expect(received[1].mode).toBe("equations");

    cleanup();
  });

  it("decodes the Lecture Lens deep link: UTF-8 base64 ?eq=, language and local API", () => {
    const eq = "y = x² − 3 // résumé";
    const b64 = Buffer.from(eq, "utf-8").toString("base64");
    const params = new URLSearchParams({
      from: "lecture-lens",
      enc: "b64",
      api: "http://localhost:5173",
      mode: "equations",
      eq: b64,
      lang: "French",
    });
    (globalThis as any).window.location = new URL(`http://localhost:5174/?${params}`);

    const payload = checkUrlCodeParam();
    expect(payload?.mode).toBe("equations");
    expect(payload?.code).toBe(eq);
    expect(payload?.language).toBe("French");
    expect(payload?.apiBase).toBe("http://localhost:5173");
  });

  it("ignores a non-local API server in the URL", () => {
    (globalThis as any).window.location = new URL(
      "http://localhost:5174/?code=" + encodeURIComponent("int x = 1;") + "&api=https://example.com"
    );
    expect(checkUrlCodeParam()?.apiBase).toBeUndefined();
  });

  it("accepts the VISUALIZE_SNIPPET postMessage shape", () => {
    const received: ExternalCodePayload[] = [];
    const cleanup = registerPostMessageListener((p) => received.push(p));
    listeners.forEach((fn) =>
      fn({ data: { type: "VISUALIZE_SNIPPET", payload: "f(x) = x^2", mode: "math" } })
    );
    expect(received[0]).toMatchObject({ code: "f(x) = x^2", mode: "equations" });
    cleanup();
  });

  it("normalizes highlighted LaTeX and y = ... lines into traceable equations", () => {
    const input = "$y = \\frac{1}{2}x^2$\ny = \\sin(x) \\cdot 3\ng(x) = x + 1";
    const out = normalizeMathSnippet(input);
    expect(out.split("\n")).toHaveLength(3);
    expect(out).toBe("f(x) = (1)/(2)x^2\nh(x) = sin(x) * 3\ng(x) = x + 1");
    const trace = traceEquations(out);
    expect(trace.diagnostics).toHaveLength(0);
    expect(trace.steps).toHaveLength(3);
  });
});
