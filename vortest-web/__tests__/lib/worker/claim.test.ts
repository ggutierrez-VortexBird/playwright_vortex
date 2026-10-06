// __tests__/lib/worker/claim.test.ts
// Tests for HU-3 Botón Detener — atomic claim of pending execution
//
// El contrato real (lib/worker/claim.ts):
// - `tryClaimPendingExecution(db)` busca la ejecución pendiente más antigua
//   (`findFirst({where: { estado: 'pendiente' }, orderBy: createdAt: 'asc' })`)
// - Luego intenta hacer `updateMany` con filtro `{ id, estado: 'pendiente' }`
//   para marcarla como `corriendo` con `inicioAt = new Date()`.
// - Si updateMany afecta 1 fila → retorna la fila claimed.
// - Si updateMany afecta 0 filas (porque fue cancelada/tomada entre findFirst
//   y updateMany) → retorna null.
// - El caller debe iterar (loop) llamando a esta función hasta que retorne null
//   o haya reclamado una ejecución.
//
// Tests cubren:
// - AC-7 (race): si la ejecución fue cancelada entre findFirst y updateMany,
//   updateMany afecta 0 filas y retornamos null (no procesamos).
// - Happy path: updateMany afecta 1 fila y retornamos el job claimed.

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
    // AC-7: race entre detenerEjecucion y el worker.
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
