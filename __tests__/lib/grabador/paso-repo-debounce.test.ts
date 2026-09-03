/**
 * Tests para los fixes de paso-repo round 2:
 *   1) Fill debounce con selector key ESTABLE (aria||testId||name||tag)
 *   2) Wait cap a MAX_WAIT_PERSIST_MS (1500) → waits mayores NO se persisten
 *   3) Wait dedupe sigue funcionando con el cap
 *
 * Mockeamos Prisma para no tocar la BD.
 */

import { persistirPaso, MAX_WAIT_PERSIST_MS } from "@/lib/grabador/paso-repo";
import type { EventoDom } from "@/lib/grabador/translator";

const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    pasoGrabado: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function inputEvt(over: Partial<EventoDom> = {}): EventoDom {
  return {
    type: "input",
    target: { tag: "input", aria: "Usuario", name: "user", testId: "user-input" },
    value: "a",
    timestamp: Date.now(),
    deltaFromPreviousMs: 0,
    isPassword: false,
    ...over,
  };
}

function waitEvt(deltaMs: number, over: Partial<EventoDom> = {}): EventoDom {
  return {
    type: "wait",
    target: null,
    value: null,
    timestamp: Date.now(),
    deltaFromPreviousMs: deltaMs,
    isPassword: false,
    ...over,
  };
}

describe("paso-repo — fill debounce with stable selector key", () => {
  it("collapses 5 consecutive inputs on same field into ONE step (UPDATE)", async () => {
    // Primer findFirst (debounce check): null → no lastFill
    // Segundo findFirst (max numero): numero = 1
    mockFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ numero: 1 });

    const createdFill = {
      id: "fill-1",
      sesionId: "ses-1",
      numero: 2,
      tipo: "escribir",
      origen: "grabado",
      descripcion: "Escribir «j» en «Usuario»",
      selectorPrincipal: { tag: "input", aria: "Usuario", name: "user", testId: "user-input" },
      selectoresRespaldo: [],
      valor: "j",
      esValorSensible: false,
      createdAt: new Date(),
    };
    mockCreate.mockResolvedValueOnce(createdFill);

    await persistirPaso(
      inputEvt({ target: { tag: "input", aria: "Usuario" }, value: "j" }),
      "ses-1",
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Segundo input: el debounce debe matchear por selector key estable.
    // findFirst para lastFill devuelve el creado recien.
    mockFindFirst.mockResolvedValueOnce(createdFill);
    const updated = {
      ...createdFill,
      valor: "julian alva",
      descripcion: "Escribir «julian alva» en «Usuario»",
    };
    mockUpdate.mockResolvedValueOnce(updated);

    const result = await persistirPaso(
      inputEvt({
        target: { tag: "input", aria: "Usuario" },
        value: "julian alva",
      }),
      "ses-1",
    );

    // UPDATE no INSERT.
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1); // sin cambio
    expect(result?.valor).toBe("julian alva");
  });

  it("debounce key uses testId when aria is missing", async () => {
    mockFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ numero: 0 });
    const fill = {
      id: "f1",
      sesionId: "ses-1",
      numero: 1,
      tipo: "escribir",
      origen: "grabado",
      descripcion: "Escribir «admin»",
      selectorPrincipal: { tag: "input", testId: "username-input" },
      selectoresRespaldo: [],
      valor: "admin",
      esValorSensible: false,
      createdAt: new Date(),
    };
    mockCreate.mockResolvedValueOnce(fill);
    await persistirPaso(
      inputEvt({
        target: { tag: "input", testId: "username-input" },
        value: "admin",
      }),
      "ses-1",
    );

    // Segundo input, mismo testId pero ARIA llega vacia — debe seguir matcheando.
    mockFindFirst.mockResolvedValueOnce(fill);
    mockUpdate.mockResolvedValueOnce({ ...fill, valor: "admin@example.com" });
    await persistirPaso(
      inputEvt({
        target: { tag: "input", testId: "username-input" },
        value: "admin@example.com",
      }),
      "ses-1",
    );
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("does NOT collapse when selector key differs (different field)", async () => {
    // Primer input: aria="Usuario" → crea fill.
    mockFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ numero: 0 });
    mockCreate.mockResolvedValueOnce({
      id: "f1",
      sesionId: "ses-1",
      numero: 1,
      tipo: "escribir",
      origen: "grabado",
      descripcion: "Escribir «a» en «Usuario»",
      selectorPrincipal: { tag: "input", aria: "Usuario" },
      selectoresRespaldo: [],
      valor: "a",
      esValorSensible: false,
      createdAt: new Date(),
    });
    await persistirPaso(
      inputEvt({ target: { tag: "input", aria: "Usuario" }, value: "a" }),
      "ses-1",
    );

    // Segundo input: aria="Clave" — selector key DIFERENTE → NO debounce,
    // debe buscar max numero y crear.
    mockFindFirst.mockResolvedValueOnce({ numero: 1 }); // max numero
    mockCreate.mockResolvedValueOnce({
      id: "f2",
      sesionId: "ses-1",
      numero: 2,
      tipo: "escribir",
      origen: "grabado",
      descripcion: "Escribir «x» en «Clave»",
      selectorPrincipal: { tag: "input", aria: "Clave" },
      selectoresRespaldo: [],
      valor: "x",
      esValorSensible: false,
      createdAt: new Date(),
    });
    await persistirPaso(
      inputEvt({ target: { tag: "input", aria: "Clave" }, value: "x" }),
      "ses-1",
    );

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("treats same field case-insensitively (USER == user)", async () => {
    mockFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ numero: 0 });
    const fill = {
      id: "f1",
      sesionId: "ses-1",
      numero: 1,
      tipo: "escribir",
      origen: "grabado",
      descripcion: "Escribir «a» en «USER»",
      selectorPrincipal: { tag: "input", aria: "USER" },
      selectoresRespaldo: [],
      valor: "a",
      esValorSensible: false,
      createdAt: new Date(),
    };
    mockCreate.mockResolvedValueOnce(fill);
    await persistirPaso(
      inputEvt({ target: { tag: "input", aria: "USER" }, value: "a" }),
      "ses-1",
    );

    // Mismo aria pero lowercase — debe debounc-ear.
    mockFindFirst.mockResolvedValueOnce(fill);
    mockUpdate.mockResolvedValueOnce({ ...fill, valor: "admin" });
    await persistirPaso(
      inputEvt({ target: { tag: "input", aria: "user" }, value: "admin" }),
      "ses-1",
    );
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("paso-repo — wait cap to MAX_WAIT_PERSIST_MS", () => {
  it("exports MAX_WAIT_PERSIST_MS = 1500", () => {
    expect(MAX_WAIT_PERSIST_MS).toBe(1500);
  });

  it("discards wait events with delta > MAX_WAIT_PERSIST_MS (returns null, no DB write)", async () => {
    const result = await persistirPaso(waitEvt(13000), "ses-1");
    expect(result).toBeNull();
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("persists wait events with delta <= MAX_WAIT_PERSIST_MS", async () => {
    mockFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ numero: 0 });
    mockCreate.mockResolvedValueOnce({
      id: "w1",
      sesionId: "ses-1",
      numero: 1,
      tipo: "esperar",
      origen: "auto",
      descripcion: "Esperar 1.0s",
      selectorPrincipal: null,
      selectoresRespaldo: [],
      valor: "1000",
      esValorSensible: false,
      createdAt: new Date(),
    });
    const result = await persistirPaso(waitEvt(1000), "ses-1");
    expect(result?.valor).toBe("1000");
  });

  it("wait dedupe still works (consecutive waits merge into the bigger)", async () => {
    // Primer wait de 800ms → crea.
    mockFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ numero: 0 });
    mockCreate.mockResolvedValueOnce({
      id: "w1",
      sesionId: "ses-1",
      numero: 1,
      tipo: "esperar",
      origen: "auto",
      descripcion: "Esperar 0.8s",
      selectorPrincipal: null,
      selectoresRespaldo: [],
      valor: "800",
      esValorSensible: false,
      createdAt: new Date(),
    });
    await persistirPaso(waitEvt(800), "ses-1");

    // Segundo wait de 1300ms (mayor) → merge al bigger.
    mockFindFirst.mockResolvedValueOnce({
      id: "w1",
      valor: "800",
    });
    mockUpdate.mockResolvedValueOnce({
      id: "w1",
      valor: "1300",
    });
    await persistirPaso(waitEvt(1300), "ses-1");
  });
});

/**
 * FIX crítico ronda 3 (HU-2026-09-02): selectorPrincipal no incluía el campo
 * `name`, así que `lastSelKey` siempre caía a `sp.tag = "input"` mientras
 * `newSelKey` decía "user-name" (de evento.target.name). NUNCA matcheaban
 * → 1 INSERT por keystroke en vez de 1 UPDATE.
 *
 * Estos tests prueban el caso real de saucedemo (input con `name="user-name"`
 * sin aria/testid) y otros campos que solo exponen `name`.
 */
describe("paso-repo — debounce con selector key estable (incluye name)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper: input event con solo `name` (caso real saucedemo)
  function saucedemoUserNameInputEvt(value: string): EventoDom {
    return {
      type: "input",
      target: { tag: "input", name: "user-name" }, // sin aria, sin testId
      value,
      timestamp: Date.now(),
      deltaFromPreviousMs: 0,
      isPassword: false,
    };
  }

  it("saucedemo-like: 6 keystrokes sobre input[name=user-name] colapsan a 1 UPDATE", async () => {
    // Primer keystroke → no hay previous fill → INSERT
    mockFindFirst.mockResolvedValueOnce(null); // findFirst(max numero)
    mockCreate.mockResolvedValueOnce({
      id: "p1",
      numero: 1,
      valor: "a",
    });
    await persistirPaso(saucedemoUserNameInputEvt("a"), "ses-sua");

    // 5 keystrokes siguientes → UPDATE del mismo row
    for (let i = 0; i < 5; i++) {
      // Primer findFirst (en el debounce) busca último escribir
      mockFindFirst.mockResolvedValueOnce({
        id: "p1",
        valor: ["a", "af", "aff", "affd", "affda"][i],
        selectorPrincipal: { tag: "input", name: "user-name" }, // ← AHORA tiene name
      });
      mockUpdate.mockResolvedValueOnce({ id: "p1" });
      await persistirPaso(
        saucedemoUserNameInputEvt(["af", "aff", "affd", "affda", "affdad"][i]),
        "ses-sua",
      );
    }

    // 1 INSERT + 5 UPDATE = 6 operaciones totales
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(5);
    // El ÚLTIMO valor escrito debe ser "affdad"
    expect(mockUpdate.mock.calls[4]![0]).toEqual(
      expect.objectContaining({
        where: { id: "p1" },
        data: expect.objectContaining({ valor: "affdad" }),
      }),
    );
  });

  it("input con `name` diferente NO se confunde con otro (no matchea selector key)", async () => {
    // Primer fill: user-name
    mockFindFirst.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({ id: "p1", numero: 1 });
    await persistirPaso(saucedemoUserNameInputEvt("admin"), "ses-1");

    // Segundo fill: OTRO campo (password) — su selector key debería ser
    // DIFERENTE (password) y por lo tanto INSERT, no UPDATE.
    mockFindFirst.mockResolvedValueOnce({
      id: "p1",
      selectorPrincipal: { tag: "input", name: "user-name" },
    });
    // No hay mockUpdate esperado. Si lo llaman, el test falla.
    mockCreate.mockResolvedValueOnce({ id: "p2", numero: 2 });
    await persistirPaso(
      {
        type: "input",
        target: { tag: "input", name: "password" },
        value: "secret",
        timestamp: Date.now(),
        deltaFromPreviousMs: 0,
        isPassword: true, // ← es password
      },
      "ses-1",
    );

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
