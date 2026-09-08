/**
 * Tests de POST /api/grabador/sesiones/[id]/guardar.
 *
 * Cubre lo agregado sobre el comportamiento V2 original:
 *   - Guardar con el script tal cual lo escribió el grabador (comportamiento
 *     previo, sin cambios).
 *   - Guardar con un script editado a mano en la pantalla de revisión — el
 *     texto editado gana sobre el specCode crudo.
 *   - "Guardar y ejecutar": encola una Ejecucion y redirige a
 *     /ejecuciones/[id] en vez de /casos/[id].
 *   - Si encolar la ejecución falla, el caso queda guardado igual — no se
 *     pierde el guardado por un fallo aparte.
 */

import { POST } from "@/app/api/grabador/sesiones/[id]/guardar/route";
import { getSession, requireSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dispararEjecucion } from "@/lib/ejecuciones/actions";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      }),
  },
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
  requireSuperadmin: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    sesionGrabacion: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    casoPrueba: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/ejecuciones/actions", () => ({
  dispararEjecucion: jest.fn(),
}));

const mockSession = { userId: "user-1", email: "a@b.com" };

function makeRequest(body?: unknown): Request {
  return {
    text: jest.fn().mockResolvedValue(body === undefined ? "" : JSON.stringify(body)),
  } as unknown as Request;
}

function makeParams(id = "ses-1") {
  return { params: Promise.resolve({ id }) };
}

const baseSesion = {
  id: "ses-1",
  usuarioId: "user-1",
  nombre: "Mi caso",
  proyectoId: "proy-1",
  estado: "activa",
  specCode: "import { test } from '@playwright/test';\n\ntest('test', async () => {});",
  codegenFilePath: "/tmp/x.spec.ts",
};

const casoCreado = { id: "caso-1" };

beforeEach(() => {
  jest.clearAllMocks();
  (getSession as jest.Mock).mockResolvedValue(mockSession);
  (requireSuperadmin as jest.Mock).mockResolvedValue(undefined);
  (prisma.sesionGrabacion.findUnique as jest.Mock).mockResolvedValue(baseSesion);
  (prisma.casoPrueba.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
    const tx = {
      casoPrueba: { create: jest.fn().mockResolvedValue(casoCreado) },
      sesionGrabacion: { update: jest.fn().mockResolvedValue({}) },
    };
    return cb(tx);
  });
});

describe("POST /api/grabador/sesiones/[id]/guardar", () => {
  it("guarda con el specCode crudo cuando no se manda script editado", async () => {
    const res = await POST(makeRequest({}), makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.casoPruebaId).toBe("caso-1");
    expect(data.redirectTo).toBe("/casos/caso-1");
    expect(dispararEjecucion).not.toHaveBeenCalled();
  });

  it("usa el script editado en vez del specCode cuando viene en el body", async () => {
    let scriptGuardado: string | undefined;
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
      const tx = {
        casoPrueba: {
          create: jest.fn().mockImplementation(({ data }) => {
            scriptGuardado = data.script;
            return Promise.resolve(casoCreado);
          }),
        },
        sesionGrabacion: { update: jest.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });

    const editado = "import { test } from '@playwright/test';\n// editado a mano";
    const res = await POST(makeRequest({ script: editado }), makeParams());

    expect(res.status).toBe(200);
    expect(scriptGuardado).toBe(editado);
  });

  it("rechaza con no_spec_code si el script editado viene vacío y no hay specCode", async () => {
    (prisma.sesionGrabacion.findUnique as jest.Mock).mockResolvedValue({
      ...baseSesion,
      specCode: null,
    });
    const res = await POST(makeRequest({ script: "   " }), makeParams());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("no_spec_code");
  });

  it("guardar y ejecutar: encola la ejecución y redirige a /ejecuciones/[id]", async () => {
    (dispararEjecucion as jest.Mock).mockResolvedValue({ id: "ej-1", estado: "pendiente" });

    const res = await POST(makeRequest({ ejecutar: true }), makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(dispararEjecucion).toHaveBeenCalledWith("caso-1");
    expect(data.ejecucionId).toBe("ej-1");
    expect(data.redirectTo).toBe("/ejecuciones/ej-1");
    expect(data.casoPruebaId).toBe("caso-1");
  });

  it("guardar y ejecutar: si falla encolar, el caso queda guardado y avisa aparte", async () => {
    (dispararEjecucion as jest.Mock).mockRejectedValue(new Error("YA_EXISTE_EJECUCION_EN_CURSO"));

    const res = await POST(makeRequest({ ejecutar: true }), makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.casoPruebaId).toBe("caso-1");
    expect(data.redirectTo).toBe("/casos/caso-1");
    expect(data.ejecucionError).toBe("YA_EXISTE_EJECUCION_EN_CURSO");
  });

  it("responde 401 si no hay sesión", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });
    const res = await POST(makeRequest({}), makeParams());
    expect(res.status).toBe(401);
  });

  it("responde 403 si no es superadmin", async () => {
    (requireSuperadmin as jest.Mock).mockRejectedValue(new Error("forbidden"));
    const res = await POST(makeRequest({}), makeParams());
    expect(res.status).toBe(403);
  });

  it("responde 404 si la sesión no existe", async () => {
    (prisma.sesionGrabacion.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await POST(makeRequest({}), makeParams());
    expect(res.status).toBe(404);
  });

  it("responde 400 si la sesión ya está guardada", async () => {
    (prisma.sesionGrabacion.findUnique as jest.Mock).mockResolvedValue({
      ...baseSesion,
      estado: "guardada",
    });
    const res = await POST(makeRequest({}), makeParams());
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("cannot_save");
  });

  it("responde 400 si el body no es JSON válido", async () => {
    const badRequest = {
      text: jest.fn().mockResolvedValue("{ esto no es json"),
    } as unknown as Request;
    const res = await POST(badRequest, makeParams());
    expect(res.status).toBe(400);
  });
});
