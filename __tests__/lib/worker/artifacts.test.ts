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
      create: jest.fn(),
    },
    pasoEjecucion: {
      findMany: jest.fn(),
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
});
