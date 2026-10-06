// __tests__/lib/worker/log-cap.test.ts
// TDD RED/GREEN/TRIANGULATE for log-cap helper

import { capLogs, LogEntry } from "@/lib/worker/log-cap";

function makeEntry(msg: string, ts = "2026-08-20T10:00:00Z"): LogEntry {
  return { ts, level: "log", msg, source: "page" };
}

describe("capLogs", () => {
  it("devuelve [entry] cuando buffer es null", () => {
    const entry = makeEntry("first");
    const result = capLogs(null, entry, 200);
    expect(result).toEqual([entry]);
  });

  it("devuelve [entry] cuando buffer es undefined", () => {
    const entry = makeEntry("first");
    const result = capLogs(undefined, entry, 200);
    expect(result).toEqual([entry]);
  });

  it("append entry sin truncar cuando length < max", () => {
    const buffer = [makeEntry("a"), makeEntry("b")];
    const entry = makeEntry("c");
    const result = capLogs(buffer, entry, 5);
    expect(result).toHaveLength(3);
    expect(result[2].msg).toBe("c");
  });

  it("mantiene exactamente max entries cuando length === max", () => {
    const buffer = [makeEntry("a"), makeEntry("b")];
    const entry = makeEntry("c");
    const result = capLogs(buffer, entry, 3);
    expect(result).toHaveLength(3);
    expect(result.map((e) => e.msg)).toEqual(["a", "b", "c"]);
  });

  it("descarta el más antiguo (FIFO) cuando length > max", () => {
    const buffer = [makeEntry("a"), makeEntry("b"), makeEntry("c")];
    const entry = makeEntry("d");
    const result = capLogs(buffer, entry, 3);
    expect(result).toHaveLength(3);
    expect(result.map((e) => e.msg)).toEqual(["b", "c", "d"]);
  });

  it("funciona con max = 1", () => {
    const buffer = [makeEntry("a")];
    const entry = makeEntry("b");
    const result = capLogs(buffer, entry, 1);
    expect(result).toHaveLength(1);
    expect(result[0].msg).toBe("b");
  });

  it("funciona con max = 200 (stress simulado)", () => {
    const buffer: LogEntry[] = [];
    for (let i = 0; i < 199; i++) {
      buffer.push(makeEntry(`line-${i}`));
    }
    const entry = makeEntry("line-199");
    const result = capLogs(buffer, entry, 200);
    expect(result).toHaveLength(200);
    expect(result[199].msg).toBe("line-199");
  });

  it("trunca correctamente cuando se excede max = 200", () => {
    const buffer: LogEntry[] = [];
    for (let i = 0; i < 200; i++) {
      buffer.push(makeEntry(`line-${i}`));
    }
    const entry = makeEntry("line-200");
    const result = capLogs(buffer, entry, 200);
    expect(result).toHaveLength(200);
    expect(result[0].msg).toBe("line-1");
    expect(result[199].msg).toBe("line-200");
  });
});
