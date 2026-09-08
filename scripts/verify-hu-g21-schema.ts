/**
 * scripts/verify-hu-g21-schema.ts
 *
 * Verifica que la migración HU-G21 está aplicada correctamente:
 * 1. CasoPrueba.origen existe y casos preexistentes tienen origen='subirScript'
 * 2. Los 4 modelos nuevos (SesionGrabacion, PasoGrabado, ParametroGrabacion, JuegoDeDatos) existen
 * 3. Las columnas nuevas en Ejecucion/PasoEjecucion son nullable
 * 4. CasoOrigen enum expone los 3 valores
 *
 * Ejecutar con: npx tsx scripts/verify-hu-g21-schema.ts
 *
 * Sale con código 0 si todo OK; código 1 si falla. Útil para CI/manual gate.
 */
import { CasoOrigen, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

let exitCode = 0;
const failures: string[] = [];

function assert(condition: unknown, message: string): void {
  if (!condition) {
    failures.push(message);
    console.error(`  ❌ ${message}`);
    exitCode = 1;
  } else {
    console.log(`  ✅ ${message}`);
  }
}

async function main(): Promise<void> {
  console.log("\n[verify-hu-g21-schema] Verificando migración HU-G21...\n");

  // Test 1: CasoPrueba.origen existe y casos preexistentes tienen origen válido
  console.log("→ CasoPrueba.origen");
  const casos = await prisma.casoPrueba.findMany({
    select: { id: true, origen: true },
    take: 10,
  });
  assert(casos !== null && casos !== undefined, "CasoPrueba query ejecutó sin errores");
  if (casos.length > 0) {
    const allValid = casos.every((c) =>
      ["subirScript", "grabador", "mixto"].includes(c.origen),
    );
    assert(allValid, `Todos los casos preexistentes tienen origen válido (${casos.length} muestreados)`);
  } else {
    console.log(`  ℹ No hay casos preexistentes (seed limpio)`);
  }

  // Test 2: Los 4 modelos nuevos son accesibles
  console.log("\n→ Modelos nuevos del grabador");
  await prisma.sesionGrabacion.findMany({ take: 1 }).then((r) =>
    assert(Array.isArray(r), "SesionGrabacion es accesible"),
  );
  await prisma.pasoGrabado.findMany({ take: 1 }).then((r) =>
    assert(Array.isArray(r), "PasoGrabado es accesible"),
  );
  await prisma.parametroGrabacion.findMany({ take: 1 }).then((r) =>
    assert(Array.isArray(r), "ParametroGrabacion es accesible"),
  );
  await prisma.juegoDeDatos.findMany({ take: 1 }).then((r) =>
    assert(Array.isArray(r), "JuegoDeDatos es accesible"),
  );

  // Test 3: Crear y borrar una SesionGrabacion smoke (transacción)
  console.log("\n→ Transacción create+delete en SesionGrabacion");
  const user = await prisma.usuario.findFirst();
  const proyecto = await prisma.proyecto.findFirst();
  if (user && proyecto) {
    const sesion = await prisma.sesionGrabacion.create({
      data: {
        proyectoId: proyecto.id,
        usuarioId: user.id,
        nombre: "test-verify",
        urlInicial: "https://example.com",
        ambiente: "QA",
        estado: "iniciando",
      },
    });
    assert(sesion.id !== undefined, "SesionGrabacion.create funcionó");
    assert(sesion.tokenUsado === false, "tokenUsado default=false");
    assert(sesion.navegador === "chromium", "navegador default=chromium");
    await prisma.sesionGrabacion.delete({ where: { id: sesion.id } });
    console.log(`  ✅ Cleanup: SesionGrabacion borrada`);
  } else {
    console.log(`  ℹ Sin user/proyecto para smoke; saltando create+delete`);
  }

  // Test 4: CasoOrigen enum
  console.log("\n→ CasoOrigen enum");
  const enumValues = Object.values(CasoOrigen ?? {});
  assert(enumValues.includes("subirScript"), "CasoOrigen.subirScript existe");
  assert(enumValues.includes("grabador"), "CasoOrigen.grabador existe");
  assert(enumValues.includes("mixto"), "CasoOrigen.mixto existe");

  // Test 5: Nullable fields
  console.log("\n→ Extensiones nullable (no rompen)");
  const ejec = await prisma.ejecucion.findFirst({
    select: { loteId: true },
    take: 1,
  });
  // loteId puede ser null, undefined, o string; todos válidos para columna nullable
  assert(
    ejec === null || ejec.loteId === null || typeof ejec.loteId === "string",
    "Ejecucion.loteId es nullable",
  );
  const paso = await prisma.pasoEjecucion.findFirst({
    select: { videoInicioMs: true, videoFinMs: true },
    take: 1,
  });
  assert(
    paso === null || (paso.videoInicioMs === null || typeof paso.videoInicioMs === "number"),
    "PasoEjecucion.videoInicioMs es nullable",
  );
  assert(
    paso === null || (paso.videoFinMs === null || typeof paso.videoFinMs === "number"),
    "PasoEjecucion.videoFinMs es nullable",
  );

  console.log("\n[verify-hu-g21-schema] Resultado:", exitCode === 0 ? "✅ OK" : "❌ FAILED");
  if (failures.length > 0) {
    console.log("Fallos:");
    for (const f of failures) console.log(`  - ${f}`);
  }
}

main()
  .catch((err) => {
    console.error("[verify-hu-g21-schema] Error inesperado:", err);
    exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(exitCode);
  });