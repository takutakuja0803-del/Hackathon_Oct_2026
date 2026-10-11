import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkUrlCodeParam,
  registerPostMessageListener,
  type ExternalCodePayload,
} from "./extensionBridge";

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
});
