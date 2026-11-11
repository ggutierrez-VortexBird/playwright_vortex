// POST /api/internal/artefactos/upload, con el guard de X-Internal-Secret.

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

// El código importa el `default` de fs/promises, distinto del namespace que ve jest.mock; se espía `(fsPromises as any).default`.
const fsPromisesDefault = (fsPromises as unknown as { default: { mkdir: jest.Mock } }).default;

// createWriteStream devuelve un Writable real: pipeline() necesita un sink verdadero.
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

// El File de jsdom no implementa .stream(): Readable.fromWeb devuelve un Readable real y vacío.
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
// El stream mockeado está vacío: el hash y el tamaño verificados por la ruta son los de un archivo de 0 bytes.
const SHA_VACIO = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

// file.stream() solo necesita no fallar; su valor de retorno es irrelevante.
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
        sha256: SHA_VACIO,
        bytes: "0",
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
      expect.stringContaining(require("path").join("storage", "artefactos", "550e8400-e29b-41d4-a716-446655440001", "e3b0c44298fc-video.webm"))
    );
    expect(ensureArtefacto).toHaveBeenCalledWith(
      expect.objectContaining({
        ejecucionId: "550e8400-e29b-41d4-a716-446655440001",
        tipo: "video",
        nombre: "video.webm",
        sha256: SHA_VACIO,
        bytes: 0,
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
        sha256: SHA_VACIO,
        bytes: "0",
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
        sha256: SHA_VACIO,
        bytes: "0",
        file,
      }
    );

    const res = await POST(request as any);
    expect(res.status).toBe(500);
  });

  it("rechaza con 400 y borra el archivo si el hash o el tamaño no coinciden", async () => {
    const rm = jest.spyOn(fsPromisesDefault as unknown as { rm: () => Promise<void> }, "rm").mockResolvedValue(undefined);
    const file = new File(["contenido"], "video.webm");

    const request = createMockRequest(
      { "x-internal-secret": ENGINE_SECRET },
      {
        ejecucionId: "550e8400-e29b-41d4-a716-446655440004",
        fileName: "video.webm",
        tipo: "video",
        sha256: "a".repeat(64),
        bytes: "9",
        file,
      }
    );

    const res = await POST(request as any);
    expect(res.status).toBe(400);
    expect(rm).toHaveBeenCalled();
    expect(ensureArtefacto).not.toHaveBeenCalled();
  });

  it("rechaza con 400 un sha256 con formato inválido", async () => {
    const file = new File(["x"], "video.webm");
    const request = createMockRequest(
      { "x-internal-secret": ENGINE_SECRET },
      {
        ejecucionId: "550e8400-e29b-41d4-a716-446655440005",
        fileName: "video.webm",
        tipo: "video",
        sha256: "abc123",
        bytes: "1",
        file,
      }
    );

    const res = await POST(request as any);
    expect(res.status).toBe(400);
    expect(ensureArtefacto).not.toHaveBeenCalled();
  });
});
