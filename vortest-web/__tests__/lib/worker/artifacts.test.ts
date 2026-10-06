// __tests__/lib/worker/artifacts.test.ts
// Motor Fase 1: artifacts.ts ahora solo hace la mitad de DB-linking (el
// escaneo/hash de archivos se movió a vortest-engine). Estos tests
// reemplazan a los de `collectArtifacts` (eliminada), cubriendo:
// ensureArtefacto (dedup), linkCaptureToSubaccion(Auto), la nueva
// linkCapturaTestToLastSubaccion, y el orquestador linkCollectedArtifacts.

import {
  ensureArtefacto,
  linkCaptureToSubaccion,
  linkCaptureToSubaccionAuto,
  linkCapturaTestToLastSubaccion,
  linkCollectedArtifacts,
} from "@/lib/worker/artifacts";
import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  prisma: {
    artefacto: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    },
    pasoEjecucion: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    pasoSubaccion: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

describe("ensureArtefacto", () => {
  beforeEach(() => jest.clearAllMocks());

  it("crea un nuevo Artefacto cuando no existe uno con el mismo sha256", async () => {
    (prisma.artefacto.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.artefacto.create as jest.Mock).mockResolvedValue({ id: "art-1" });

    const result = await ensureArtefacto({
      ejecucionId: "ejec-1",
      tipo: "video",
      nombre: "video.webm",
      path: "/storage/artefactos/ejec-1/video.webm",
      sha256: "abc",
      bytes: 100,
    });

    expect(result).toEqual({ artefactoId: "art-1", deduplicated: false });
    expect(prisma.artefacto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ejecucionId: "ejec-1", sha256: "abc" }),
    });
  });

  it("dedupea por sha256+ejecucionId sin crear una fila nueva", async () => {
    (prisma.artefacto.findFirst as jest.Mock).mockResolvedValue({
      id: "art-existente",
      path: "/storage/artefactos/ejec-1/video.webm",
    });

    const result = await ensureArtefacto({
      ejecucionId: "ejec-1",
      tipo: "video",
      nombre: "video.webm",
      path: "/storage/artefactos/ejec-1/video.webm",
      sha256: "abc",
      bytes: 100,
    });

    expect(result).toEqual({ artefactoId: "art-existente", deduplicated: true });
    expect(prisma.artefacto.create).not.toHaveBeenCalled();
    expect(prisma.artefacto.update).not.toHaveBeenCalled();
  });

  it("actualiza el path si el existente difiere (reintento del motor con otro nombre)", async () => {
    (prisma.artefacto.findFirst as jest.Mock).mockResolvedValue({
      id: "art-existente",
      path: "/otro/path.webm",
    });

    await ensureArtefacto({
      ejecucionId: "ejec-1",
      tipo: "video",
      nombre: "video.webm",
      path: "/storage/artefactos/ejec-1/video.webm",
      sha256: "abc",
      bytes: 100,
    });

    expect(prisma.artefacto.update).toHaveBeenCalledWith({
      where: { id: "art-existente" },
      data: { path: "/storage/artefactos/ejec-1/video.webm" },
    });
  });
});

describe("linkCaptureToSubaccion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("vincula capturaActualId al primer substep del paso", async () => {
    (prisma.pasoSubaccion.findFirst as jest.Mock).mockResolvedValue({ id: "sub-1" });

    await linkCaptureToSubaccion("ejec-1", "paso-1", "art-1", "captura-actual");

    expect(prisma.pasoSubaccion.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { capturaActualId: "art-1" },
    });
  });

  it("vincula capturaReferenciaId cuando la fase es captura-referencia", async () => {
    (prisma.pasoSubaccion.findFirst as jest.Mock).mockResolvedValue({ id: "sub-1" });

    await linkCaptureToSubaccion("ejec-1", "paso-1", "art-2", "captura-referencia");

    expect(prisma.pasoSubaccion.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { capturaReferenciaId: "art-2" },
    });
  });

  it("no hace nada si no hay ningún substep para el paso", async () => {
    (prisma.pasoSubaccion.findFirst as jest.Mock).mockResolvedValue(null);

    await linkCaptureToSubaccion("ejec-1", "paso-1", "art-1", "captura-actual");

    expect(prisma.pasoSubaccion.update).not.toHaveBeenCalled();
  });
});

describe("linkCaptureToSubaccionAuto", () => {
  beforeEach(() => jest.clearAllMocks());

  it("vincula si el substep aún no tiene capturaActualId", async () => {
    (prisma.pasoSubaccion.findFirst as jest.Mock).mockResolvedValue({ id: "sub-1", capturaActualId: null });

    await linkCaptureToSubaccionAuto("ejec-1", "paso-1", "art-1");

    expect(prisma.pasoSubaccion.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { capturaActualId: "art-1" },
    });
  });

  it("no sobrescribe si ya tiene capturaActualId", async () => {
    (prisma.pasoSubaccion.findFirst as jest.Mock).mockResolvedValue({
      id: "sub-1",
      capturaActualId: "ya-existe",
    });

    await linkCaptureToSubaccionAuto("ejec-1", "paso-1", "art-1");

    expect(prisma.pasoSubaccion.update).not.toHaveBeenCalled();
  });
});

describe("linkCapturaTestToLastSubaccion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("no hace nada si no hay ningún token", async () => {
    await linkCapturaTestToLastSubaccion("ejec-1", 1, null, null);
    expect(prisma.pasoEjecucion.findUnique).not.toHaveBeenCalled();
  });

  it("vincula al último substep sin captura del paso", async () => {
    (prisma.pasoEjecucion.findUnique as jest.Mock).mockResolvedValue({ id: "paso-1" });
    (prisma.pasoSubaccion.findFirst as jest.Mock).mockResolvedValue({ id: "sub-3" });

    await linkCapturaTestToLastSubaccion("ejec-1", 2, "art-actual", "art-ref");

    expect(prisma.pasoEjecucion.findUnique).toHaveBeenCalledWith({
      where: { ejecucionId_numero: { ejecucionId: "ejec-1", numero: 2 } },
      select: { id: true },
    });
    expect(prisma.pasoSubaccion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ejecucionId: "ejec-1", pasoEjecucionId: "paso-1", capturaActualId: null },
        orderBy: { numero: "desc" },
      })
    );
    expect(prisma.pasoSubaccion.update).toHaveBeenCalledWith({
      where: { id: "sub-3" },
      data: { capturaActualId: "art-actual", capturaReferenciaId: "art-ref" },
    });
  });

  it("no falla si no se encuentra el paso", async () => {
    (prisma.pasoEjecucion.findUnique as jest.Mock).mockResolvedValue(null);

    await linkCapturaTestToLastSubaccion("ejec-1", 99, "art-1", null);

    expect(prisma.pasoSubaccion.findFirst).not.toHaveBeenCalled();
  });
});

describe("linkCollectedArtifacts", () => {
  beforeEach(() => jest.clearAllMocks());

  it("vincula por fase explícita cuando el ref trae phase", async () => {
    (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([{ id: "paso-1", numero: 1 }]);
    (prisma.pasoSubaccion.findFirst as jest.Mock).mockResolvedValue({ id: "sub-1" });

    await linkCollectedArtifacts("ejec-1", [
      { artefactoId: "art-1", pasoNumero: 1, phase: "captura-actual" },
    ]);

    expect(prisma.pasoSubaccion.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { capturaActualId: "art-1" },
    });
  });

  it("usa la heurística automática cuando el ref no trae phase", async () => {
    (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([{ id: "paso-1", numero: 1 }]);
    (prisma.pasoSubaccion.findFirst as jest.Mock).mockResolvedValue({
      id: "sub-1",
      capturaActualId: null,
    });

    await linkCollectedArtifacts("ejec-1", [{ artefactoId: "art-1", pasoNumero: 1, phase: null }]);

    expect(prisma.pasoSubaccion.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { capturaActualId: "art-1" },
    });
  });

  it("ignora refs sin pasoNumero (ej. el video, que no pertenece a un paso)", async () => {
    await linkCollectedArtifacts("ejec-1", [{ artefactoId: "art-video", pasoNumero: null, tipo: "video" } as any]);

    expect(prisma.pasoEjecucion.findMany).not.toHaveBeenCalled();
  });
});
