// __tests__/lib/worker/artifacts.test.ts
// Tests for HU-4.2 — Worker artifact collection

import { collectArtifacts } from "@/lib/worker/artifacts";
import { prisma } from "@/lib/db";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

jest.mock("@/lib/db", () => ({
  prisma: {
    artefacto: {
      create: jest.fn().mockImplementation((args: any) =>
        Promise.resolve({ id: `art-${args.data.nombre}`, ...args.data })
      ),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    pasoEjecucion: {
      findMany: jest.fn(),
    },
    pasoSubaccion: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
  },
}));

jest.mock("fs", () => ({
  readdirSync: jest.fn(),
  mkdirSync: jest.fn(),
  renameSync: jest.fn(),
  createReadStream: jest.fn(),
  statSync: jest.fn().mockImplementation((filePath: string) => {
    // Si el path contiene "subdir" o "chromium", es un directorio
    const isDir = filePath.includes("subdir") || filePath.includes("chromium");
    return {
      size: 1024,
      isDirectory: () => isDir,
    };
  }),
}));

jest.mock("crypto", () => ({
  createHash: jest.fn(),
}));

function mockHash(hexDigest: string) {
  const hashMock = {
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue(hexDigest),
  };
  (crypto.createHash as jest.Mock).mockReturnValue(hashMock);
  return hashMock;
}

function mockReadStream(content: Buffer) {
  const eventHandlers: Record<string, ((chunk: Buffer) => void)[]> = {};
  const streamMock = {
    on: jest.fn((event: string, cb: (chunk: Buffer) => void) => {
      if (!eventHandlers[event]) eventHandlers[event] = [];
      eventHandlers[event].push(cb);
    }),
    _emit: (event: string, data: Buffer) => {
      (eventHandlers[event] || []).forEach((cb) => cb(data));
    },
  };
  (fs.createReadStream as jest.Mock).mockReturnValue(streamMock);
  // Emit data and end synchronously when created
  setTimeout(() => {
    streamMock._emit("data", content);
    streamMock._emit("end", Buffer.alloc(0));
  }, 0);
  return streamMock;
}

describe("collectArtifacts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("no hace nada cuando no hay archivos en el directorio de salida", async () => {
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    await collectArtifacts("ejec-1", "/tmp/output/ejec-1");

    expect(prisma.artefacto.create).not.toHaveBeenCalled();
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it("inserta un artefacto de video y mueve el archivo", async () => {
    (fs.readdirSync as jest.Mock).mockReturnValue(["video.webm"]);
    (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([]);
    mockHash("abc123");
    mockReadStream(Buffer.from("fake-video-data"));

    await collectArtifacts("ejec-1", "/tmp/output/ejec-1");

    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join("storage", "artefactos", "ejec-1")),
      { recursive: true }
    );
    const renameCall = (fs.renameSync as jest.Mock).mock.calls[0];
    expect(renameCall[0]).toContain("video.webm");
    expect(renameCall[1]).toContain(path.join("storage", "artefactos", "ejec-1", "video.webm"));
    expect(prisma.artefacto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ejecucionId: "ejec-1",
          tipo: "video",
          nombre: "video.webm",
          sha256: "abc123",
          pasoEjecucionId: null,
        }),
      })
    );
  });

  it("mapea pasoEjecucionId usando heurística de nombre de archivo", async () => {
    (fs.readdirSync as jest.Mock).mockReturnValue(["step-2-screenshot.png"]);
    (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([
      { id: "paso-1", numero: 1, descripcion: "Primer paso" },
      { id: "paso-2", numero: 2, descripcion: "Segundo paso" },
    ]);
    mockHash("def456");
    mockReadStream(Buffer.from("fake-image-data"));

    await collectArtifacts("ejec-1", "/tmp/output/ejec-1");

    expect(prisma.artefacto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ejecucionId: "ejec-1",
          tipo: "captura",
          nombre: "step-2-screenshot.png",
          pasoEjecucionId: "paso-2",
        }),
      })
    );
  });

  it("continúa procesando cuando un archivo falla", async () => {
    (fs.readdirSync as jest.Mock).mockReturnValue(["video.webm", "bad.png"]);
    (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([]);
    mockHash("abc123");
    (fs.createReadStream as jest.Mock)
      .mockImplementationOnce(() => {
        const streamMock = {
          on: jest.fn((event: string, cb: (err?: Error) => void) => {
            if (event === "error") {
              setTimeout(() => cb(new Error("read error")), 0);
            }
          }),
        };
        return streamMock;
      })
      .mockImplementationOnce(() => {
        const streamMock = {
          on: jest.fn((event: string, cb: (chunk?: Buffer) => void) => {
            setTimeout(() => {
              if (event === "data") cb(Buffer.from("ok"));
              if (event === "end") cb(Buffer.alloc(0));
            }, 0);
          }),
        };
        return streamMock;
      });

    await collectArtifacts("ejec-1", "/tmp/output/ejec-1");

    // Should still create the second artifact even though first failed
    expect(prisma.artefacto.create).toHaveBeenCalledTimes(1);
  });

  it("detecta fase captura-actual y crea Artefacto con metadata.phase", async () => {
    (fs.readdirSync as jest.Mock).mockReturnValue(["step-2-actual.png"]);
    (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([
      { id: "paso-1", numero: 1, descripcion: "Primer paso" },
      { id: "paso-2", numero: 2, descripcion: "Segundo paso" },
    ]);
    mockHash("hash-actual");
    mockReadStream(Buffer.from("fake-actual"));

    await collectArtifacts("ejec-1", "/tmp/output/ejec-1");

    expect(prisma.artefacto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nombre: "step-2-actual.png",
          metadata: expect.objectContaining({ phase: "captura-actual" }),
        }),
      })
    );
  });

  it("detecta fase captura-referencia y actualiza FK en PasoSubaccion", async () => {
    (fs.readdirSync as jest.Mock).mockReturnValue(["step-1-reference.png"]);
    (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([
      { id: "paso-1", numero: 1, descripcion: "Primer paso" },
    ]);
    (prisma.pasoSubaccion.findFirst as jest.Mock).mockResolvedValue({
      id: "sub-1",
      pasoEjecucionId: "paso-1",
      numero: 1,
    });
    mockHash("hash-ref");
    mockReadStream(Buffer.from("fake-reference"));

    await collectArtifacts("ejec-1", "/tmp/output/ejec-1");

    expect(prisma.artefacto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ phase: "captura-referencia" }),
        }),
      })
    );
    expect(prisma.pasoSubaccion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: { capturaReferenciaId: expect.any(String) },
      })
    );
  });

  it("vincula captura automática de Playwright (test-name-1.png) al primer substep", async () => {
    // Playwright naming: test-title-1.png, test-title-2.png (automatic screenshots)
    (fs.readdirSync as jest.Mock).mockReturnValue(["test-navigate-to-login-1.png"]);
    (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([
      { id: "paso-1", numero: 1, descripcion: "Navegar al login" },
    ]);
    (prisma.pasoSubaccion.findFirst as jest.Mock).mockResolvedValue({
      id: "sub-1",
      pasoEjecucionId: "paso-1",
      numero: 1,
      capturaActualId: null, // No tiene captura aún
    });
    mockHash("hash-auto-1");
    mockReadStream(Buffer.from("fake-auto-screenshot"));

    await collectArtifacts("ejec-1", "/tmp/output/ejec-1");

    expect(prisma.pasoSubaccion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: { capturaActualId: expect.any(String) },
      })
    );
  });

  it("no sobrescribe capturaActualId si ya existe (captura automática)", async () => {
    (fs.readdirSync as jest.Mock).mockReturnValue(["test-action-1.png"]);
    (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([
      { id: "paso-1", numero: 1, descripcion: "Click botón" },
    ]);
    // Substep ya tiene captura (de toHaveScreenshot)
    (prisma.pasoSubaccion.findFirst as jest.Mock).mockResolvedValue({
      id: "sub-1",
      pasoEjecucionId: "paso-1",
      numero: 1,
      capturaActualId: "existing-capture", // Ya tiene captura
    });
    mockHash("hash-auto-1");
    mockReadStream(Buffer.from("fake-auto-screenshot"));

    await collectArtifacts("ejec-1", "/tmp/output/ejec-1");

    // No debe actualizar porque ya tiene captura
    expect(prisma.pasoSubaccion.update).not.toHaveBeenCalled();
  });

  it("salta archivo gracefully cuando renameSync falla (Windows EPERM)", async () => {
    (fs.readdirSync as jest.Mock).mockReturnValue(["step-1-actual.png"]);
    (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([]);
    mockHash("hash-actual");
    mockReadStream(Buffer.from("fake-actual"));
    let renameCalls = 0;
    (fs.renameSync as jest.Mock).mockImplementation(() => {
      renameCalls++;
      if (renameCalls === 1) {
        const err: any = new Error("EPERM");
        err.code = "EPERM";
        throw err;
      }
      if (renameCalls === 2) {
        const err: any = new Error("EBUSY");
        err.code = "EBUSY";
        throw err;
      }
      // 3rd call succeeds
    });

    await collectArtifacts("ejec-1", "/tmp/output/ejec-1");

    // Should retry and eventually succeed or skip gracefully
    expect(fs.renameSync).toHaveBeenCalledTimes(3);
    expect(prisma.artefacto.create).toHaveBeenCalledTimes(1);
  });
});
