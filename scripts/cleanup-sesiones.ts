#!/usr/bin/env node
/**
 * HU-GR-1 — Cron de limpieza de sesiones de grabación antiguas.
 *
 * Borra las `SesionGrabacion` en estados terminales ('descartada' o
 * 'guardada') cuya `updatedAt` supera el umbral de retención
 * (default: 7 días). El borrado es en cascada — los `PasoGrabado`
 * asociados se eliminan automáticamente por el FK en schema.prisma.
 *
 * Uso:
 *   node --import tsx scripts/cleanup-sesiones.ts
 *
 * Variables de entorno:
 *   SESIONES_RETENTION_DAYS — días antes de purgar (default 7).
 *
 * El script está pensado para correr como cron diario en el host que
 * aloja Next.js (no necesita scheduler externo). Se recomienda:
 *
 *   0 3 * * *  cd /ruta/al/repo/playwright_vortex && \
 *             node --import tsx scripts/cleanup-sesiones.ts \
 *             >> /var/log/acta-cleanup.log 2>&1
 *
 * Exit codes:
 *   0 — éxito (incluso si no había nada que borrar)
 *   1 — error de conexión a DB
 */

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

async function main(): Promise {
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
  .catch(async (err) => {
    console.error("[cleanup-sesiones] Error:", err);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  });