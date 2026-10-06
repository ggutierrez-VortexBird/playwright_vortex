// __tests__/app/api/internal/artefactos/upload/route.test.ts
// Motor Fase 1 — POST /api/internal/artefactos/upload
// Mismo patrón de mock de multipart que __tests__/app/api/casos/route.test.ts
// (Map-backed FormData), y mismo patrón de guard que
// __tests__/app/api/grabador/sesiones/route.test.ts para X-Internal-Secret.

import { POST } from "@/app/api/internal/artefactos/upload/route";
import { ensureArtefacto } from "@/lib/worker/artifacts";
import { prisma } from "@/lib/db";
import * as fsPromises from "fs/promises";
import * as fs from "fs";

jest.mock("@/lib/worker/artifacts", () => ({
  ensureArtefacto: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    ejecucion: {
      findUnique: jest.fn(),
    },
  },
}));

// Mismo detalle que __tests__/lib/worker/script-temp.test.ts (ya eliminado
// junto con writeTempScript, pero el gotcha sigue vigente): `fs/promises`
// expone tanto propiedades nombradas como un `default` — el código bajo
// test (`import fsPromises from 'fs/promises'`) recibe el `default`, un
// objeto DISTINTO del namespace que ve `jest.mock('fs/promises', factory)`.
// La forma que funciona de verdad bajo next/jest es `jest.spyOn` sobre
// `(fsPromises as any).default`.
const fsPromisesDefault = (fsPromises as unknown as { default: { mkdir: jest.Mock } }).default;

// `fs.createWriteStream` devuelve un Writable de Node REAL (no un plain
// object) — pipeline() necesita un sink que implemente el protocolo de
// verdad; un objeto fake haría fallar (o directamente no ejecutar) el
// pipeline real.
jest.mock("fs", () => {
  const { Writable } = jest.requireActual("stream");
  return {
    createWriteStream: jest.fn().mockImplementation(
      () =>
        new Writable({
          write(_chunk: unknown, _enc: unknown, callback: (err?: Error) => void) {
            callback();
          },
        })
    ),
  };
});

// jsdom's global File (usado por otros tests de este repo, ej.
// __tests__/app/api/casos/route.test.ts) no implementa `.stream()` — a
// diferencia del File nativo de Node en runtime real. Mockeamos
// `Readable.fromWeb` para que, sin importar qué le pasemos, devuelva un
// Readable de Node REAL y vacío (`push(null)` de entrada) — así el
// `pipeline()` real (no mockeado) de stream/promises corre de verdad contra
// streams válidos en vez de reventar contra un objeto fake.
jest.mock("stream", () => {
  const actual = jest.requireActual("stream");
  return {
    ...actual,
    Readable: {
      ...actual.Readable,
      fromWeb: jest.fn().mockImplementation(() => {
        const readable = new actual.Readable();
        readable.push(null);
        return readable;
      }),
    },
  };
});

const ENGINE_SECRET = "test-engine-secret-32-characters!!";

// jsdom's global File no implementa `.stream()` (a diferencia del File
// nativo de Node en runtime real). Como Readable.fromWeb está mockeado
// arriba para ignorar su input, solo necesitamos que `file.stream()` no
// tire — el valor de retorno es irrelevante para estos tests.
if (typeof File !== "undefined" && typeof File.prototype.stream !== "function") {
  (File.prototype as unknown as { stream: () => unknown }).stream = function stream() {
    return {};
  };
}

function createMockRequest(
  headers: Record<string, string>,
  fields: Record<string, string | File>
): Request {
  const formData = new Map<string, string | File>();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return {
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
    formData: jest.fn().mockResolvedValue({
      get: (key: string) => formData.get(key) ?? null,
    }),
  } as unknown as Request;
}

describe("POST /api/internal/artefactos/upload", () => {
  const originalSecret = process.env.ENGINE_INTERNAL_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENGINE_INTERNAL_SECRET = ENGINE_SECRET;
    jest.spyOn(fsPromisesDefault, "mkdir").mockResolvedValue(undefined as never);
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue({ id: "550e8400-e29b-41d4-a716-446655440001" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env.ENGINE_INTERNAL_SECRET = originalSecret;
  });

  it("retorna 401 si falta X-Internal-Secret", async () => {
    const request = createMockRequest({}, {});
    const res = await POST(request as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "unauthorized" });
  });

  it("retorna 401 si el secret no matchea", async () => {
    const request = createMockRequest({ "x-internal-secret": "wrong" }, {});
    const res = await POST(request as any);
    expect(res.status).toBe(401);
  });

  it("retorna 400 si faltan campos requeridos", async () => {
    const request = createMockRequest(
      { "x-internal-secret": ENGINE_SECRET },
      { ejecucionId: "550e8400-e29b-41d4-a716-446655440001" }
    );
    const res = await POST(request as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation");
  });

  it("retorna 400 si tipo no es uno de los valores válidos", async () => {
    const file = new File(["contenido"], "video.webm");
    const request = createMockRequest(
      { "x-internal-secret": ENGINE_SECRET },
      {
        ejecucionId: "550e8400-e29b-41d4-a716-446655440001",
        fileName: "video.webm",
        tipo: "gif",
        sha256: "abc123",
        bytes: "9",
        file,
      }
    );
    const res = await POST(request as any);
    expect(res.status).toBe(400);
  });

  it("sube el archivo, llama ensureArtefacto y retorna 200 con artefactoId", async () => {
    (ensureArtefacto as jest.Mock).mockResolvedValue({ artefactoId: "art-1", deduplicated: false });
    const file = new File(["contenido"], "video.webm");

    const request = createMockRequest(
      { "x-internal-secret": ENGINE_SECRET },
      {
        ejecucionId: "550e8400-e29b-41d4-a716-446655440001",
        fileName: "video.webm",
        tipo: "video",
        sha256: "abc123",
        bytes: "9",
        metadata: JSON.stringify({ stepNum: 2 }),
        file,
      }
    );

    const res = await POST(request as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ artefactoId: "art-1", deduplicated: false });

    expect(fsPromisesDefault.mkdir).toHaveBeenCalled();
    expect(fs.createWriteStream).toHaveBeenCalledWith(
      expect.stringContaining(require("path").join("storage", "artefactos", "550e8400-e29b-41d4-a716-446655440001", "video.webm"))
    );
    expect(ensureArtefacto).toHaveBeenCalledWith(
      expect.objectContaining({
        ejecucionId: "550e8400-e29b-41d4-a716-446655440001",
        tipo: "video",
        nombre: "video.webm",
        sha256: "abc123",
        bytes: 9,
        metadata: { stepNum: 2 },
      })
    );
  });

  it("sanitiza fileName con path traversal antes de escribir a disco", async () => {
    (ensureArtefacto as jest.Mock).mockResolvedValue({ artefactoId: "art-2", deduplicated: false });
    const file = new File(["x"], "evil.png");

    const request = createMockRequest(
      { "x-internal-secret": ENGINE_SECRET },
      {
        ejecucionId: "550e8400-e29b-41d4-a716-446655440002",
        fileName: "../../etc/evil.png",
        tipo: "captura",
        sha256: "def456",
        bytes: "1",
        file,
      }
    );

    const res = await POST(request as any);
    expect(res.status).toBe(200);
    expect(ensureArtefacto).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "evil.png" })
    );
    const writtenPath = (fs.createWriteStream as jest.Mock).mock.calls[0][0] as string;
    expect(writtenPath).not.toContain("..");
  });

  it("retorna 500 si ensureArtefacto lanza", async () => {
    (ensureArtefacto as jest.Mock).mockRejectedValue(new Error("db down"));
    const file = new File(["x"], "video.webm");

    const request = createMockRequest(
      { "x-internal-secret": ENGINE_SECRET },
      {
        ejecucionId: "550e8400-e29b-41d4-a716-446655440003",
        fileName: "video.webm",
        tipo: "video",
        sha256: "abc",
        bytes: "1",
        file,
      }
    );

    const res = await POST(request as any);
    expect(res.status).toBe(500);
  });
});
