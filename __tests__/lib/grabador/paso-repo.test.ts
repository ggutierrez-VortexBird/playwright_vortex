/**
 * Tests for lib/grabador/paso-repo.ts — persistence with password masking.
 *
 * Covers HU-G3 (panel de pasos) and HU-GR-1 partial (password credential
 * masking MUST survive the DB persistence layer).
 *
 * Two layers under test:
 *   1. `mapearEventoAPaso` (pure function): builds the Prisma create payload
 *      from an EventoDom. Verified in isolation, no DB.
 *   2. `persistirPaso` (side-effecting): reads max(numero)+1, inserts row,
 *      handles unique collisions.
 *
 * SECURITY cases are mandatory — these tests would FAIL the build if a
 * future refactor accidentally persists a password in clear text.
 */

import { mapearEventoAPaso, persistirPaso } from "@/lib/grabador/paso-repo";
import type { EventoDom } from "@/lib/grabador/translator";

// Mock prisma
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

function baseEvento(overrides: Partial<EventoDom> = {}): EventoDom {
  return {
    type: "click",
    target: { tag: "button", text: "Ingresar" },
    value: null,
    timestamp: 1_700_000_000_000,
    deltaFromPreviousMs: 0,
    ...overrides,
  };
}

describe("lib/grabador/paso-repo — mapearEventoAPaso (pure)", () => {
  it("maps a click event to a 'clic' paso with sensible default selectors", () => {
    const payload = mapearEventoAPaso(
      baseEvento({ type: "click", target: { tag: "button", text: "Ingresar" } }),
      1,
      "ses-1",
    );

    expect(payload.sesionId).toBe("ses-1");
    expect(payload.numero).toBe(1);
    expect(payload.tipo).toBe("clic");
    expect(payload.origen).toBe("grabado");
    expect(payload.descripcion).toBe("Clic en «Ingresar»");
    expect(payload.valor).toBeNull();
    expect(payload.esValorSensible).toBe(false);
    expect(payload.selectorPrincipal).toEqual({
      tag: "button",
      text: "Ingresar",
      aria: null,
      testId: null,
      name: null,
    });
  });

  it("maps a non-password input and persists the plain value", () => {
    const payload = mapearEventoAPaso(
      baseEvento({
        type: "input",
        target: { tag: "input", aria: "Usuario" },
        value: "admin@example.com",
        isPassword: false,
      }),
      2,
      "ses-1",
    );

    expect(payload.tipo).toBe("escribir");
    expect(payload.valor).toBe("admin@example.com");
    expect(payload.esValorSensible).toBe(false);
    expect(payload.descripcion).toContain("admin@example.com");
  });

  it("SECURITY: password event always sets valor=null and esValorSensible=true", () => {
    const payload = mapearEventoAPaso(
      baseEvento({
        type: "input",
        target: { tag: "input", aria: "Contraseña" },
        value: "super-secret-password",
        isPassword: true,
      }),
      3,
      "ses-1",
    );

    expect(payload.valor).toBeNull();
    expect(payload.esValorSensible).toBe(true);
    expect(payload.descripcion).toContain("••••••");
    // Critical: the plain value MUST NEVER appear in the payload.
    expect(payload.descripcion).not.toContain("super-secret-password");
    expect(payload.valor).not.toBe("super-secret-password");
  });

  it("SECURITY: defensive layer — even if value arrives non-null for password, we mask it", () => {
    // Belt-and-suspenders: even if the worker accidentally passes a value
    // for a password field, we still strip it.
    const payload = mapearEventoAPaso(
      baseEvento({
        type: "input",
        target: { tag: "input", aria: "pwd" },
        value: "leaked",
        isPassword: true,
      }),
      4,
      "ses-1",
    );
    expect(payload.valor).toBeNull();
    expect(payload.esValorSensible).toBe(true);
  });

  it("maps a wait event to 'auto' origin (HU-G4)", () => {
    const payload = mapearEventoAPaso(
      baseEvento({
        type: "wait",
        target: null,
        deltaFromPreviousMs: 1500,
      }),
      5,
      "ses-1",
    );

    expect(payload.tipo).toBe("esperar");
    expect(payload.origen).toBe("auto");
    expect(payload.descripcion).toBe("Esperar 1.5s");
    // FIX: para waits el valor persistido es el delta (String) para que
    // el codegen emita `waitForTimeout(N)` real. Antes era null.
    expect(payload.valor).toBe("1500");
  });

  it("maps a navigate event", () => {
    const payload = mapearEventoAPaso(
      baseEvento({
        type: "navigate",
        url: "https://example.com/login",
      }),
      6,
      "ses-1",
    );

    expect(payload.tipo).toBe("navegar");
    expect(payload.descripcion).toBe("Abrir «https://example.com/login»");
  });

  it("builds selectoresRespaldo from non-empty target fields", () => {
    const payload = mapearEventoAPaso(
      baseEvento({
        type: "click",
        target: {
          tag: "button",
          text: "OK",
          aria: "OK button",
          testId: "btn-ok",
        },
      }),
      7,
      "ses-1",
    );

    expect(Array.isArray(payload.selectoresRespaldo)).toBe(true);
    const strategies = (payload.selectoresRespaldo as Array<{ strategy: string }>).map(
      (s) => s.strategy,
    );
    expect(strategies).toContain("testid");
    expect(strategies).toContain("aria-label");
    expect(strategies).toContain("text");
  });

  it("returns empty selectoresRespaldo for null target (wait/navigate)", () => {
    const payload = mapearEventoAPaso(
      baseEvento({ type: "wait", target: null, deltaFromPreviousMs: 1000 }),
      8,
      "ses-1",
    );
    expect(payload.selectorPrincipal).toBeNull();
    expect(payload.selectoresRespaldo).toEqual([]);
  });
});

describe("lib/grabador/paso-repo — persistirPaso (DB side effects)", () => {
  it("uses max(numero)+1 as the new numero when table is empty", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({
      id: "paso-1",
      sesionId: "ses-1",
      numero: 1,
      tipo: "clic",
      origen: "grabado",
      descripcion: "Clic en «Ingresar»",
      selectorPrincipal: {},
      selectoresRespaldo: [],
      valor: null,
      esValorSensible: false,
      createdAt: new Date(),
    });

    const result = await persistirPaso(
      baseEvento({ type: "click" }),
      "ses-1",
    );

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { sesionId: "ses-1" },
      orderBy: { numero: "desc" },
      select: { numero: true },
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockCreate.mock.calls[0][0];
    expect(createArgs.data.numero).toBe(1);
    expect(createArgs.data.sesionId).toBe("ses-1");
    expect(result?.id).toBe("paso-1");
    expect(result?.numero).toBe(1);
  });

  it("increments from the highest existing numero", async () => {
    // Primer findFirst: debounce check (no lastFill, devuelve null).
    // Segundo findFirst: max(numero)+1 query.
    mockFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ numero: 5 });
    mockCreate.mockResolvedValueOnce({
      id: "paso-6",
      sesionId: "ses-1",
      numero: 6,
      tipo: "escribir",
      origen: "grabado",
      descripcion: "Escribir «admin» en «Usuario»",
      selectorPrincipal: {},
      selectoresRespaldo: [],
      valor: "admin",
      esValorSensible: false,
      createdAt: new Date(),
    });

    await persistirPaso(
      baseEvento({
        type: "input",
        target: { aria: "Usuario" },
        value: "admin",
      }),
      "ses-1",
    );

    const createArgs = mockCreate.mock.calls[0][0];
    expect(createArgs.data.numero).toBe(6);
  });

  it("persists password events with valor=null and esValorSensible=true in the DB payload", async () => {
    mockFindFirst.mockResolvedValueOnce({ numero: 1 });
    mockCreate.mockResolvedValueOnce({
      id: "paso-2",
      sesionId: "ses-1",
      numero: 2,
      tipo: "escribir",
      origen: "grabado",
      descripcion: "Escribir «••••••» (credencial) en «Contraseña»",
      selectorPrincipal: {},
      selectoresRespaldo: [],
      valor: null,
      esValorSensible: true,
      createdAt: new Date(),
    });

    await persistirPaso(
      baseEvento({
        type: "input",
        target: { tag: "input", aria: "Contraseña" },
        value: "cleartext-pwd",
        isPassword: true,
      }),
      "ses-1",
    );

    const createArgs = mockCreate.mock.calls[0][0];
    expect(createArgs.data.valor).toBeNull();
    expect(createArgs.data.esValorSensible).toBe(true);
    expect(createArgs.data.descripcion).toContain("••••••");
  });

  it("skips wait events with delta 0 (no-op on session start)", async () => {
    const result = await persistirPaso(
      baseEvento({
        type: "wait",
        target: null,
        deltaFromPreviousMs: 0,
      }),
      "ses-1",
    );

    expect(result).toBeNull();
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("retries on Prisma P2002 unique constraint violation (race condition)", async () => {
    // First read returns 5; second read (after P2002) returns 6.
    mockFindFirst
      .mockResolvedValueOnce({ numero: 5 })
      .mockResolvedValueOnce({ numero: 6 });
    mockCreate
      .mockRejectedValueOnce({ code: "P2002" })
      .mockResolvedValueOnce({
        id: "paso-7",
        sesionId: "ses-1",
        numero: 7,
        tipo: "clic",
        origen: "grabado",
        descripcion: "Clic en «OK»",
        selectorPrincipal: {},
        selectoresRespaldo: [],
        valor: null,
        esValorSensible: false,
        createdAt: new Date(),
      });

    const result = await persistirPaso(
      baseEvento({ type: "click", target: { text: "OK" } }),
      "ses-1",
    );

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result?.numero).toBe(7);
  });

  it("persists wait events as origen='auto'", async () => {
    // Primer findFirst: debounce check (no lastWait → null).
    // Segundo findFirst: max(numero)+1 query.
    mockFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ numero: 0 });
    mockCreate.mockResolvedValueOnce({
      id: "paso-1",
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

    await persistirPaso(
      baseEvento({
        type: "wait",
        target: null,
        deltaFromPreviousMs: 1000,
      }),
      "ses-1",
    );

    const createArgs = mockCreate.mock.calls[0][0];
    expect(createArgs.data.origen).toBe("auto");
    expect(createArgs.data.tipo).toBe("esperar");
  });
});
