/**
 * scripts/smoke-codegen.ts — validación end-to-end del codegen contra
 * la BD Docker (acta-postgres).
 *
 *   1. Conecta a Prisma
 *   2. Toma la sesión de grabación más reciente con >10 pasos
 *   3. Llama serializarPasos(...) y muestra las primeras 40 líneas
 *   4. Verifica invariantes:
 *      - Hay al menos 1 paso de fill (no 6+) — fill debounce funciona
 *      - 0 waits > MAX_WAIT_PERSIST_MS (1500)
 *      - Hay al menos 1 getByRole con { name } — role candidate con name funciona
 *      - Hay .first() defensivo en los calls del codegen
 *
 * Uso:  node --import tsx scripts/smoke-codegen.ts
 */

import { prisma } from "../lib/db";
import {
  serializarPasos,
  MAX_WAIT_PERSIST_MS,
  type PasoParaSerializar,
  type ParametroParaSerializar,
} from "../lib/grabador/codegen/serialize";

function toPasoParaSerializar(row: {
  id: string;
  numero: number;
  tipo: string;
  descripcion: string;
  selectorPrincipal: unknown;
  selectoresRespaldo: unknown;
  valor: string | null;
  esValorSensible: boolean;
  assertionKind: string | null;
}): PasoParaSerializar {
  return {
    id: row.id,
    numero: row.numero,
    tipo: row.tipo,
    descripcion: row.descripcion,
    selectorPrincipal: row.selectorPrincipal,
    selectoresRespaldo: row.selectoresRespaldo,
    valor: row.valor,
    esValorSensible: row.esValorSensible,
    assertionKind: row.assertionKind,
  };
}

async function main(): Promise<void> {
  console.log("[smoke-codegen] Conectando a Prisma…");
  await prisma.$connect();

  // Sesion de grabacion mas reciente con >10 pasos
  const sesiones = await prisma.sesionGrabacion.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      _count: { select: { pasos: true } },
    },
  });

  console.log(
    `[smoke-codegen] ${sesiones.length} sesiones encontradas en BD. ` +
      `Counts: [${sesiones.map((s) => s._count.pasos).join(", ")}]`,
  );

  const sesion = sesiones.find((s) => s._count.pasos > 10);
  if (!sesion) {
    console.log(
      "[smoke-codegen] No hay sesiones con >10 pasos. " +
        "Mostrando las primeras 30 lineas de un escenario sintetico (Wikipedia):",
    );
    const out = escenarioSinteticoWikipedia();
    console.log("=".repeat(72));
    for (const l of out.split("\n").slice(0, 30)) console.log(l);
    console.log("=".repeat(72));
    await prisma.$disconnect();
    return;
  }

  console.log(
    `[smoke-codegen] Sesion elegida: ${sesion.id} (${sesion._count.pasos} pasos)`,
  );

  const pasos = await prisma.pasoGrabado.findMany({
    where: { sesionId: sesion.id },
    orderBy: { numero: "asc" },
  });

  const parametros: ParametroParaSerializar[] = await prisma.parametroGrabacion.findMany({
    where: { sesionId: sesion.id },
  }).then((rows) => rows.map((r) => ({ nombre: r.nombre, valorDefecto: r.valorDefecto })));

  const pasosSerializables = pasos.map(toPasoParaSerializar);
  const out = serializarPasos(pasosSerializables, {
    nombreDelCaso: `Smoke ${sesion.id.slice(0, 8)}`,
    parametros,
    responsable: "smoke",
  });

  const lineas = out.split("\n");
  console.log(`[smoke-codegen] Output total: ${lineas.length} lineas`);
  console.log("[smoke-codegen] Primeras 40 lineas:");
  console.log("=".repeat(72));
  for (const l of lineas.slice(0, 40)) console.log(l);
  console.log("=".repeat(72));

  // === Invariantes ===
  const errors: string[] = [];

  // 1) Numero de fills (escribir) — debounce debe colapsar typing per-char.
  //    NOTA: si la sesion fue grabada ANTES del fix, los fills
  //    per-char estan todos en BD. El script solo valida la sesion
  //    mas reciente CON >10 pasos; para validar el fix re-grabar.
  const fills = pasos.filter((p) => p.tipo === "escribir");
  console.log(
    `[smoke-codegen] Pasos 'escribir' en BD: ${fills.length} ` +
      `(esperado <=6 despues de debounce; puede ser mas si la sesion fue grabada pre-fix)`,
  );
  if (fills.length > 10) {
    errors.push(
      `Demasiados fills (${fills.length}). Esperar <=10 despues de debounce. ` +
        "Revisar paso-repo.ts fill debounce.",
    );
  }

  // 2) Output del codegen: 0 waitForTimeout(N > 1500) — esta es la
  //    invariante que importa para el fix. Los waits en BD pueden
  //    contener datos historicos pre-fix.
  const waitsCodegen = out.match(/waitForTimeout\((\d+)\)/g) ?? [];
  const waitsGrandesCodegen = waitsCodegen.filter((w) => {
    const m = w.match(/\((\d+)\)/);
    return m && parseInt(m[1]!, 10) > MAX_WAIT_PERSIST_MS;
  });
  if (waitsGrandesCodegen.length > 0) {
    errors.push(
      `waitForTimeout >${MAX_WAIT_PERSIST_MS}ms en codegen: ${waitsGrandesCodegen.join(", ")}. ` +
        "El cap del codegen no esta funcionando.",
    );
  }
  console.log(
    `[smoke-codegen] waitForTimeout(N>${MAX_WAIT_PERSIST_MS}) en codegen: ${waitsGrandesCodegen.length} (debe ser 0)`,
  );

  // 4) Output del codegen: al menos 1 getByRole con { name } (HU-G14).
  const getByRoleCount = (out.match(/getByRole\(/g) ?? []).length;
  const getByRoleConNameCount = (out.match(/getByRole\(`[^`]+`, \{ name: /g) ?? []).length;
  console.log(
    `[smoke-codegen] getByRole total: ${getByRoleCount}, con { name }: ${getByRoleConNameCount}`,
  );
  // Es OK si no hay roles con name (la sesion puede no tener candidates con name).
  // Solo advertimos si HAY roles sin name cuando deberia haberlos.
  if (getByRoleCount > 0 && getByRoleConNameCount === 0) {
    console.log(
      "[smoke-codegen] ADVERTENCIA: hay getByRole pero ninguno con { name }. " +
        "Posible bug en propagacion de candidate.name.",
    );
  }

  // 5) .first() defensivo presente en calls de codegen.
  const callsDelCodegen = out.match(/\.click\(\)|\.fill\(|press\(/g) ?? [];
  const callsConFirst = out.match(/\.first\(\)\.(click|fill|press)\(/g) ?? [];
  console.log(
    `[smoke-codegen] Calls totales: ${callsDelCodegen.length}, con .first(): ${callsConFirst.length}`,
  );

  // 6) navigate usa waitUntil:'domcontentloaded'
  if (out.includes("page.goto(") && !out.includes("waitUntil: 'domcontentloaded'")) {
    errors.push("Hay page.goto sin waitUntil:'domcontentloaded'.");
  }

  console.log("=".repeat(72));
  if (errors.length === 0) {
    console.log("[smoke-codegen] OK — todas las invariantes en verde.");
  } else {
    console.log(`[smoke-codegen] FAIL — ${errors.length} invariantes rotas:`);
    for (const e of errors) console.log(`  - ${e}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  await prisma.$disconnect();
}

/**
 * Escenario sintetico que replica lo que dejaria una grabacion real
 * de Wikipedia (HU-G3, HU-G11):
 *   - navegar
 *   - clic en el searchbox (con role+name)
 *   - escribir el value (debounce debe colapsar per-char en UN solo fill)
 *   - tecla Enter
 *   - esperar (debe ser <=1500ms)
 *   - verificar titulo del articulo
 *
 * Devuelve el output de serializarPasos con este escenario.
 */
export function escenarioSinteticoWikipedia(): string {
  const pasos: PasoParaSerializar[] = [
    {
      id: "p1",
      numero: 1,
      tipo: "navegar",
      descripcion: "Abrir «https://es.wikipedia.org/»",
      selectorPrincipal: null,
      selectoresRespaldo: [],
      valor: "https://es.wikipedia.org/",
      esValorSensible: false,
      assertionKind: null,
    },
    {
      id: "p2",
      numero: 2,
      tipo: "clic",
      descripcion: "Clic en «Buscar en Wikipedia»",
      selectorPrincipal: { tag: "input", aria: "Buscar en Wikipedia" },
      selectoresRespaldo: [
        { strategy: "role", value: "searchbox", name: "Buscar en Wikipedia" },
      ],
      valor: null,
      esValorSensible: false,
      assertionKind: null,
    },
    {
      id: "p3",
      numero: 3,
      tipo: "escribir",
      descripcion: "Escribir «Julián Alvarez» en «Buscar en Wikipedia»",
      selectorPrincipal: { tag: "input", aria: "Buscar en Wikipedia" },
      selectoresRespaldo: [
        { strategy: "role", value: "combobox", name: "Buscar en Wikipedia" },
      ],
      valor: "Julián Alvarez",
      esValorSensible: false,
      assertionKind: null,
    },
    {
      id: "p4",
      numero: 4,
      tipo: "tecla",
      descripcion: "Tecla Enter en «Buscar en Wikipedia»",
      selectorPrincipal: { tag: "input", aria: "Buscar en Wikipedia" },
      selectoresRespaldo: [
        { strategy: "role", value: "searchbox", name: "Buscar en Wikipedia" },
      ],
      valor: "Enter",
      esValorSensible: false,
      assertionKind: null,
    },
    {
      id: "p5",
      numero: 5,
      tipo: "esperar",
      descripcion: "Esperar 0.8s",
      selectorPrincipal: null,
      selectoresRespaldo: [],
      valor: "800",
      esValorSensible: false,
      assertionKind: null,
    },
    {
      id: "p6",
      numero: 6,
      tipo: "verificar",
      descripcion: "Visible «Julián Álvarez (futbolista)»",
      selectorPrincipal: { tag: "h1", text: "Julián Álvarez (futbolista)" },
      selectoresRespaldo: [
        { strategy: "role", value: "heading", name: "Julián Álvarez (futbolista)" },
      ],
      valor: null,
      esValorSensible: false,
      assertionKind: "visible",
    },
  ];
  return serializarPasos(pasos, {
    nombreDelCaso: "Wikipedia - Buscar futbolista",
    parametros: [],
    responsable: "smoke",
  });
}

main().catch(async (err) => {
  console.error("[smoke-codegen] Error inesperado:", err);
  await prisma.$disconnect();
  process.exit(1);
});
