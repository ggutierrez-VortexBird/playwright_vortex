// tryClaimPendingExecution: updateMany atómico; si afecta 0 filas (cancelada entre medio) devuelve null.

import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  prisma: {
    ejecucion: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

describe("tryClaimPendingExecution (atomic claim)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna null si no hay ejecuciones pendientes", async () => {
    const { tryClaimPendingExecution } = await import("@/lib/worker/claim");
    (prisma.ejecucion.findFirst as jest.Mock).mockResolvedValue(null);

    const claimed = await tryClaimPendingExecution(prisma);

    expect(claimed).toBeNull();
    expect(prisma.ejecucion.updateMany).not.toHaveBeenCalled();
  });

  it("retorna el job claimed si updateMany afecta 1 fila", async () => {
    const { tryClaimPendingExecution } = await import("@/lib/worker/claim");
    const pending = {
      id: "ejec-1",
      casoPruebaId: "caso-1",
      estado: "pendiente",
      createdAt: new Date(),
    };
    (prisma.ejecucion.findFirst as jest.Mock).mockResolvedValue(pending);
    (prisma.ejecucion.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const claimed = await tryClaimPendingExecution(prisma);

    expect(claimed).toEqual(
      expect.objectContaining({ id: "ejec-1", estado: "corriendo" })
    );
    expect(prisma.ejecucion.updateMany).toHaveBeenCalledWith({
      where: { id: "ejec-1", estado: "pendiente" },
      data: expect.objectContaining({
        estado: "corriendo",
        inicioAt: expect.any(Date),
      }),
    });
  });

  it("retorna null si la ejecución fue cancelada entre findFirst y updateMany (race)", async () => {
    // Carrera entre detenerEjecucion y el worker
    const { tryClaimPendingExecution } = await import("@/lib/worker/claim");
    const pending = {
      id: "ejec-canceled",
      casoPruebaId: "caso-1",
      estado: "pendiente",
      createdAt: new Date(),
    };
    (prisma.ejecucion.findFirst as jest.Mock).mockResolvedValue(pending);
    // updateMany afecta 0 filas porque el estado ya cambió a 'cancelado'
    (prisma.ejecucion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    const claimed = await tryClaimPendingExecution(prisma);

    expect(claimed).toBeNull();
    // El filtro sigue siendo estricto: solo 'pendiente' → 'corriendo'
    expect(prisma.ejecucion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ estado: "pendiente" }),
      })
    );
  });
});
