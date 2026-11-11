#!/usr/bin/env node
// Borra sesiones de grabación terminales (descartada/guardada) más viejas que SESIONES_RETENTION_DAYS (default 7); pensado para cron diario.

import { prisma } from "../lib/db";

const DEFAULT_RETENTION_DAYS = 7;

function readRetentionDays(): number {
  const v = process.env.SESIONES_RETENTION_DAYS;
  if (!v) return DEFAULT_RETENTION_DAYS;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) {
    console.warn(
      `[cleanup-sesiones] SESIONES_RETENTION_DAYS inválido (${v}), usando default ${DEFAULT_RETENTION_DAYS}`,
    );
    return DEFAULT_RETENTION_DAYS;
  }
  return n;
}

async function main(): Promise<void> {
  const days = readRetentionDays();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  console.log(
    `[cleanup-sesiones] Purgando SesionGrabacion en estado 'descartada'/'guardada' con updatedAt < ${cutoff.toISOString()} (>${days} días)`,
  );

  // 1. Cuenta cuántos se van a borrar (para el log).
  const count = await prisma.sesionGrabacion.count({
    where: {
      estado: { in: ["descartada", "guardada"] },
      updatedAt: { lt: cutoff },
    },
  });

  if (count === 0) {
    console.log("[cleanup-sesiones] Nada que purgar.");
    return;
  }

  // 2. Borra. Cascade en PasoGrabado / ParametroGrabacion.
  const result = await prisma.sesionGrabacion.deleteMany({
    where: {
      estado: { in: ["descartada", "guardada"] },
      updatedAt: { lt: cutoff },
    },
  });

  console.log(
    `[cleanup-sesiones] Purga completada: ${result.count} sesiones eliminadas (cascade: PasoGrabado + ParametroGrabacion).`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err: unknown) => {
    console.error("[cleanup-sesiones] Error:", err);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  });