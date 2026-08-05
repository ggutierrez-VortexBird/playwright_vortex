# Exploración — HU-0.2 Convención de registro del script de Playwright

> **Cambio**: `hu0-2-convencion-de-registro-del-script-de-playwright`
> **Fase**: 1 — EXPLORER (Vorkan v2.1.0)
> **Fecha**: 2026-08-05
> **Modo de persistencia**: `hybrid` (filesystem + Engram)
> **Estado del repo**: stack planeado pero NO instalado. No existe `package.json`, ni `prisma/schema.prisma`, ni archivos `.spec.ts`. Esta fase es **solo análisis y convención**: no se escribe código ejecutable.

---

## Current State

Hoy el repositorio carece por completo de infraestructura Playwright:

- **No hay archivos `.spec.ts`** ni `.test.ts` en ninguna rama del repo.
- **No hay `playwright.config.ts`** — la convención de proyectos, proyectos de Playwright, y `testDir` aún no existe.
- **El stack está planeado, no instalado** (`openspec/config.yaml → status: stack-planned-not-installed`). La primera HU de implementación (Fase 1 del plan de ejecución) scaffoldeará Next.js + Prisma + Playwright.
- **HU-0.1 (Modelo de datos) ya definió** `casoPrueba.rutaScript` como `String` en el schema Prisma, pero el schema físico no existe todavía.
- **El worker** (Fase 3 del plan) es un proceso Node de larga vida en el mismo contenedor que la app. Debe poder disparar `npx playwright test <ruta>` sin configuración adicional por caso.

**Implicación para Fase 1**: HU-0.2 no escribe código de producción. Entrega una **convención documentada** (rutas, formatos, resolución, validación) que las HUs posteriores (HU-2.3, HU-3.1, HU-3.3) consumirán sin reinterpretar.

---

## Affected Areas

> Esta fase **no toca código**; las "áreas afectadas" son las que la convención regirá en HUs futuras.

### Áreas que la HU-0.2 nombra explícitamente
- `casoPrueba.rutaScript` (campo Prisma, HU-0.1) — **qué se almacena** aquí depende directamente de la convención que definamos.
- Directorio de scripts de Playwright en el contenedor — **dónde** el worker busca los `.spec.ts`.
- Estrategia de validación de rutas — **cuándo** se detecta que un script no existe (registro vs ejecución).

### Áreas del repo que consumirán esta convención (Fase 2–3 del plan)
- `app/(dashboard)/proyectos/[proyectoId]/casos/nuevo/page.tsx` (o similar) — formulario de registro de caso (HU-2.3). El campo "script" debe aceptar un valor que siga la convención.
- `app/api/casos/route.ts` — endpoint POST que valida `rutaScript` antes de insertar en `casoPrueba`.
- `worker/executor.ts` (o similar) — módulo que, dado un `casoPrueba.rutaScript`, resuelve la ruta absoluta y ejecuta `playwright test`.
- `worker/validator.ts` — utilidad que verifica existencia y legibilidad del archivo antes de ejecutar (HU-3.3).
- `docker-compose.dev.yml` / `Dockerfile` — debe montar o copiar los scripts al contenedor en la ruta convenida.

### Áreas documentales a congelar con esta decisión
- `documentacion/convencion-scripts-playwright.md` (a crear en Fase 4 DESIGNER) — reglas de ruta, formato, validación.
- `openspec/changes/hu0-2-convencion-de-registro-del-script-de-playwright/specs/<domain>/spec.md` (a crear en Fase 3 SPEC-WRITER) — delta spec con escenarios Given/When/Then.

### Áreas NO afectadas por esta exploración
- `documentacion/historias-usuario-playwright-vortex.md`, `plan_ejecucion_hus.md` — **NO se modifican**.
- `openspec/config.yaml` — **NO se modifica**.
- `.agents/` — no se toca.

---

## Approaches

### Eje 1 — ¿Qué se almacena en `casoPrueba.rutaScript`?

| Enfoque | Pros | Contras | Esfuerzo |
|---|---|---|---|
| **A. Ruta relativa desde un root configurado** (ej: `bancoomeva/transferencia.spec.ts`) | Portátil entre entornos (dev, prod). Cambiar el servidor o el volumen no invalida la DB. Ruta corta y legible en UI. | Requiere variable de entorno `PLAYWRIGHT_SCRIPTS_ROOT` o convención de directorio fijo. | Bajo |
| **B. Ruta absoluta en el contenedor** (ej: `/app/playwright-scripts/bancoomeva/transferencia.spec.ts`) | Sin ambigüedad: lo que está en la DB es exactamente lo que abre el worker. | No portátil: si el contenedor prod monta el volumen en `/data/scripts`, todas las rutas de dev quedan rotas. Expone estructura interna del filesystem. | Bajo |
| **C. Referencia por proyecto + nombre de test** (ej: `bancoomeva#transferencia-de-saldo`) | Abstrae la ubicación física; permite mover archivos sin tocar la DB. | Requiere un `playwright.config.ts` con proyectos definidos y un índice de test names. Overkill para MVP. | Alto |
| **D. URL o identificador externo** (ej: `git://repo/tests/transferencia.spec.ts`) | Desacopla totalmente el almacenamiento. | Añade complejidad de fetch/clone/cache. No es lo que pide la HU ("ubicación en disco"). | Alto |

**Recomendación**: **A — ruta relativa desde un root configurado**.

- El campo `rutaScript` almacena una **ruta relativa** en formato POSIX (`/` como separador, sin leading slash).
- El worker resuelve la ruta absoluta concatenando `process.env.PLAYWRIGHT_SCRIPTS_ROOT` (default: `/app/playwright-scripts`) + `rutaScript`.
- Ejemplo: `rutaScript = "bancoomeva/auth/login.spec.ts"` → worker ejecuta `npx playwright test /app/playwright-scripts/bancoomeva/auth/login.spec.ts`.

**Rationale**: La HU pide "ubicación en disco" pero también "sin ambigüedad" y "sin configuración adicional" para el worker. Un root por convención + ruta relativa cumple ambas: el worker sabe dónde buscar sin configuración por caso, y la DB no acopla rutas absolutas del filesystem.

---

### Eje 2 — Convención de directorios en disco

| Enfoque | Pros | Contras | Esfuerzo |
|---|---|---|---|
| **A. Plano** — todos los `.spec.ts` en `PLAYWRIGHT_SCRIPTS_ROOT/` | Simple, sin jerarquía. | Caos cuando hay decenas de casos. Colisiones de nombre. Difícil de navegar. | Bajo |
| **B. Por espacio/proyecto** — `<espacio-slug>/<proyecto-slug>/caso.spec.ts` | Organización natural que refleja la jerarquía de ACTA. Fácil de validar (¿existe el directorio del proyecto?). | Requiere que los slugs sean estables; cambiar nombre de proyecto no debe romper rutas. | Bajo |
| **C. Por requerimiento (REQ)** — `REQ-XXXX/caso.spec.ts` | Alineado con los códigos `CP-XXXX-YY`. | Un proyecto puede tener múltiples REQ; la jerarquía no refleja la organización de ACTA. | Medio |

**Recomendación**: **B — por espacio/proyecto**, con una variante simplificada.

- Estructura:
  ```
  PLAYWRIGHT_SCRIPTS_ROOT/
  ├── <espacio-slug>/
  │   └── <proyecto-slug>/
  │       └── <caso>.spec.ts
  ```
- El `espacio-slug` y `proyecto-slug` son derivados del nombre (kebab-case, únicos), no del `id` UUID.
- **Alternativa aceptable para MVP**: si la organización por espacio/proyecto añade fricción al deploy de scripts, se puede simplificar a `PLAYWRIGHT_SCRIPTS_ROOT/<proyecto-slug>/<caso>.spec.ts` y dejar el espacio implícito.
- **Regla dura**: el `casoPrueba.rutaScript` **no incluye** el root. Solo guarda `<proyecto-slug>/<caso>.spec.ts` (o con espacio: `<espacio-slug>/<proyecto-slug>/<caso>.spec.ts`).

---

### Eje 3 — Formato del archivo `.spec.ts`

| Enfoque | Pros | Contras | Esfuerzo |
|---|---|---|---|
| **A. Playwright estándar** (`@playwright/test`, `test()`, `expect()`) | Cero barrera de entrada. Los equipos ya escriben tests así. El worker corre `npx playwright test <ruta>` directamente. | Ninguno significativo para MVP. | Bajo |
| **B. Playwright con metadatos exportados** (ej: `export const meta = { id: 'CP-AUTH-01', ... }`) | Permite validar que el archivo corresponde al caso registrado. | Requiere parsear el TS o ejecutarlo para leer exports. Añade complejidad sin valor en MVP. | Medio |
| **C. Formato propio (DSL)** | Control total sobre la ejecución. | Contradice el principio de ACTA: "cargar el caso directamente, sin sistema intermedio que las traduzca". | Alto |

**Recomendación**: **A — Playwright estándar, sin metadatos obligatorios**.

- El archivo DEBE ser un test de Playwright válido: importa `@playwright/test`, define al menos un `test()` con `expect()`.
- La extensión DEBE ser `.spec.ts` o `.test.ts` (`.spec.ts` preferido por convención del proyecto).
- El worker ejecuta: `npx playwright test <ruta-absoluta> --reporter=json --output=<dir-artefactos>`.
- **No se exige** `export const meta`, `export default`, ni ningún contrato adicional en el archivo.

**Validación mínima de formato** (HU-2.3, HU-3.3):
- El archivo existe.
- El archivo termina en `.spec.ts` o `.test.ts`.
- (Opcional, fase 2) El archivo contiene al menos una ocurrencia de la palabra `test(` o `import { test }`.

---

### Eje 4 — Estrategia de validación de rutas

| Enfoque | Pros | Contras | Esfuerzo |
|---|---|---|---|
| **A. Solo en ejecución (lazy)** | Mínimo código. El worker detecta el error y marca `errorMotor`. | El usuario puede registrar casos con rutas rotas y no enterarse hasta ejecutar. | Bajo |
| **B. En registro (eager) + en ejecución (fallback)** | El usuario recibe feedback inmediato al crear el caso. Doble red de seguridad. | Requiere acceso al filesystem desde el Server Action / API route de registro. | Bajo |
| **C. En registro asíncrono (scan periódico)** | No bloquea el formulario de registro. | Complejidad innecesaria para MVP. | Medio |

**Recomendación**: **B — eager en registro + lazy en ejecución como fallback**.

- **Al registrar** (HU-2.3): el Server Action / API route verifica que `path.join(PLAYWRIGHT_SCRIPTS_ROOT, rutaScript)` existe y es legible. Si no, rechaza con error 400 explícito: `"El script no existe en la ruta configurada: <ruta>"`.
- **Al ejecutar** (HU-3.3): el worker vuelve a verificar antes de lanzar Playwright. Si el archivo desapareció entre el registro y la ejecución, marca la ejecución como `errorMotor` con mensaje descriptivo.
- **En listado** (HU-2.4): se puede mostrar un indicador visual (pill `p-idle` con tooltip) si el script no está accesible, aunque el caso esté registrado.

**Nota sobre HU-0.2 CA #2**: "Dado un intento de registrar un caso con una ruta inválida o inexistente, entonces el sistema debe **poder detectarlo** (aunque la validación en UI se implemente en la Fase 2)."
- Esto significa que HU-0.2 debe **documentar y validar la convención** (path resolution + validación existe), pero **no exige** que la UI de Fase 2 ya la use. La función de validación puede vivir en `lib/script-validation.ts` y ser importada por la UI cuando se implemente HU-2.3.

---

### Eje 5 — Resolución de rutas en el worker

| Enfoque | Pros | Contras | Esfuerzo |
|---|---|---|---|
| **A. `path.resolve(ROOT, rutaScript)`** | Estándar Node.js. Funciona en Linux (contenedor). | En Windows (dev local sin Docker) puede producir backslashes; pero el target runtime es Linux. | Bajo |
| **B. `path.posix.join(ROOT, rutaScript)`** | Garantiza forward slashes, coherente con Playwright CLI. | Ligeramente más verboso. | Bajo |
| **C. Playwright config con `testDir`** | Playwright descubre tests automáticamente. | Requiere un `playwright.config.ts` por proyecto o global. Overkill para MVP. | Medio |

**Recomendación**: **B — `path.posix.join` para resolución, verificación con `fs.access`**.

- Resolución: `const absolutePath = path.posix.join(ROOT, rutaScript)`.
- Validación: `await fs.access(absolutePath, fs.constants.R_OK)`.
- Ejecución: `execa('npx', ['playwright', 'test', absolutePath, ...flags])` (o `spawn` para streaming).

---

### Eje 6 — Convención de naming del archivo

| Enfoque | Pros | Contras | Esfuerzo |
|---|---|---|---|
| **A. Nombre libre** (`cualquier-cosa.spec.ts`) | Flexibilidad total. | Sin consistencia; difícil de inferir desde la UI. | Bajo |
| **B. Coincide con `casoPrueba.codigo`** (`CP-AUTH-01.spec.ts`) | Trazabilidad directa: código = nombre de archivo. | Los códigos tienen mayúsculas y guiones; Playwright no se queja, pero puede ser verboso. | Bajo |
| **C. Coincide con slug del nombre** (`consulta-de-saldo.spec.ts`) | Legible en filesystem. | No garantiza unicidad sin incluir el código. | Bajo |

**Recomendación**: **A — nombre libre, con guía de estilo sugerida**.

- El sistema **no impone** el nombre del archivo. El usuario sube o referencia un `.spec.ts` con el nombre que tenga.
- **Guía de estilo sugerida** (documental, no enforceada): `kebab-case`, descriptivo, opcionalmente prefijado con el REQ (ej: `REQ-2481-consulta-saldo.spec.ts`).
- La unicidad del caso en ACTA la garantiza `casoPrueba.codigo` (UK por proyecto), no el nombre del archivo.
- **Razón**: ACTA es un "orquestador" de tests ya escritos. No debe dictar cómo se nombran los archivos en los repositorios de los clientes.

---

### Resumen de decisiones de la convención

| Aspecto | Decisión |
|---|---|
| Qué se guarda en `rutaScript` | Ruta relativa POSIX desde `PLAYWRIGHT_SCRIPTS_ROOT` |
| Root por defecto | `/app/playwright-scripts` (configurable vía `process.env.PLAYWRIGHT_SCRIPTS_ROOT`) |
| Estructura de directorios | `<proyecto-slug>/<nombre-libre>.spec.ts` (MVP); opcional `<espacio-slug>/` en fase futura |
| Formato del archivo | Playwright estándar (`.spec.ts` o `.test.ts`, mínimo un `test()`) |
| Validación en registro | `fs.access` desde Server Action / API; rechazo 400 si no existe |
| Validación en ejecución | `fs.access` desde worker; `errorMotor` si no existe |
| Resolución de ruta | `path.posix.join(ROOT, rutaScript)` |
| Nombre del archivo | Libre; guía sugerida kebab-case |
| Ejecución del worker | `npx playwright test <ruta-absoluta> --reporter=json --output=<dir>` |

---

## Recommendation

**Sí, estamos listos para abrir Fase 2 (PROPOSER).**

La decisión de fondo es: **ACTA no es un IDE ni un traductor de tests**. La convención debe ser lo suficientemente simple para que un equipo externo entienda, sin fricción, cómo vincular su `.spec.ts` existente con un caso en la plataforma.

Las decisiones no negociables para HU-0.2 son:

1. **`rutaScript` = ruta relativa** — no absoluta, no URL, no identificador abstracto.
2. **`PLAYWRIGHT_SCRIPTS_ROOT` = env var con default** — el worker resuelve sin configuración por caso.
3. **Validación doble: eager (registro) + lazy (ejecución)** — cumple CA #2 de HU-0.2 y CA de HU-3.3.
4. **Formato = Playwright estándar** — sin metadatos obligatorios, sin DSL propio.
5. **Extensión = `.spec.ts` preferida** — `.test.ts` aceptada por compatibilidad.

---

## Risks

1. **Stack no instalado** — la convención se documenta pero no se puede probar con un archivo real hasta la primera HU de implementación. El criterio de aceptación #1 de HU-0.2 ("el worker puede localizarlo y ejecutarlo sin configuración adicional") queda en **TODO** para la fase de implementación.
2. **Deploy de scripts al contenedor** — la convención asume que los `.spec.ts` ya están en `PLAYWRIGHT_SCRIPTS_ROOT` cuando el contenedor arranca. Si el flujo de deploy es "subir archivo por UI", la convención sigue válida pero hay que agregar un paso de persistencia en disco (fuera del scope de HU-0.2).
3. **Playwright config por proyecto** — si en el futuro cada proyecto necesita su propio `playwright.config.ts` (navegador distinto, `baseURL` diferente), la ejecución del worker cambia de `npx playwright test <ruta>` a `npx playwright test --config=<config-del-proyecto>`. Esto no rompe la convención de `rutaScript`, pero sí el comando de ejecución. **Documentar como extensión futura**.
4. **Rutas con `..` o symlinks** — `rutaScript` debe validarse con una regex que rechace `..`, leading `/`, y caracteres de control. Riesgo de path traversal si no se sanitiza.
5. **Cambio de `proyecto-slug`** — si se renombra un proyecto y su slug cambia, las rutas relativas almacenadas quedan rotas. Recomendación: los slugs son inmutables (o se generan una vez y no cambian). Documentar en convención.
6. **Windows en desarrollo local** — `path.posix.join` funciona bien, pero si un desarrollador corre ACTA sin Docker en Windows, las rutas absolutas finales pueden tener problemas. La respuesta es: **el runtime soportado es Linux/Docker**; dev local sin Docker es "best effort".

---

## Ready for Proposal

**Yes — listo para Fase 2 (PROPOSER).**

### Lo que Fase 2 (sdd-propose) debe entregar
- `proposal.md` con la decisión de cada eje y la justificación (este análisis es la base).
- Vinculación a la HU-0.2 textual (criterios de aceptación).
- Plan de rollback: trivial (no hay código todavía).

### Lo que Fase 3 (sdd-spec) debe entregar
- `specs/<domain>/spec.md` con escenarios Given/When/Then para los **2 criterios de aceptación** de HU-0.2, en español.
- Escenarios de validación: ruta válida, ruta inexistente, ruta con `..`, extensión incorrecta.

### Lo que Fase 4 (sdd-design) debe entregar
- `design.md` con la firma de la función de validación (ej: `validateScriptPath(relativePath: string): Promise<{ valid: boolean; absolutePath?: string; error?: string }>`).
- Convención documentada en `documentacion/convencion-scripts-playwright.md`.

### Decisiones confirmadas en Checkpoint 1 (2026-08-05)

| # | Decisión | Opción elegida | Justificación |
|---|----------|----------------|---------------|
| 1 | Estructura de directorios | **B** — `espacio-slug/proyecto-slug/` | Jerarquía natural que refleja ACTA, sin colisiones entre proyectos de espacios distintos. |
| 2 | Extensiones aceptadas | **B** — `.spec.ts` preferida, `.test.ts` aceptada | Cero fricción con equipos que migren desde Jest/Vitest; validación regex mínima. |
| 3 | `PLAYWRIGHT_SCRIPTS_ROOT` | **A** — volumen montado en Docker | ACTA consume scripts escritos por equipos externos; un volumen permite actualizar sin rebuild. |

### Bloqueos que la próxima fase debe resolver
1. ~~¿Se incluye `espacio-slug` en la ruta relativa o solo `proyecto-slug`?~~ → **Resuelto: B**
2. ~~¿Se acepta `.test.ts` además de `.spec.ts`?~~ → **Resuelto: B**
3. ~~¿El `PLAYWRIGHT_SCRIPTS_ROOT` se monta como volumen en Docker o se copia en build?~~ → **Resuelto: A**

### Bandeja de salida para HU-0.2
- Crear checkpoint 1 al cerrar la proposal.
- El usuario debe dar visto bueno **antes** de pasar a SPEC-WRITER.

---

## Apéndice — Ejemplo completo de la convención en acción

### Escenario feliz

```
# En el contenedor
PLAYWRIGHT_SCRIPTS_ROOT=/app/playwright-scripts

# Archivo en disco
/app/playwright-scripts/bancoomeva/interoperabilidad/login.spec.ts

# Valor en DB (casoPrueba.rutaScript)
"bancoomeva/interoperabilidad/login.spec.ts"

# Resolución en worker
const ROOT = process.env.PLAYWRIGHT_SCRIPTS_ROOT ?? '/app/playwright-scripts';
const absolute = path.posix.join(ROOT, caso.rutaScript);
// → /app/playwright-scripts/bancoomeva/interoperabilidad/login.spec.ts

# Ejecución
npx playwright test /app/playwright-scripts/bancoomeva/interoperabilidad/login.spec.ts \
  --reporter=json \
  --output=/app/artefactos/ejecucion-<id>
```

### Escenario de error (ruta inexistente)

```
# Valor en DB
"bancoomeva/interoperabilidad/login.spec.ts"

# Pero el archivo fue renombrado o borrado
# Worker detecta:
await fs.access(absolutePath, fs.constants.R_OK);
// → Error: ENOENT

# Resultado: ejecución con estado = 'errorMotor'
// Mensaje: "Script no encontrado: /app/playwright-scripts/bancoomeva/interoperabilidad/login.spec.ts"
```

---

## skill_resolution

- `sdd-explore` — propia skill de la fase, leyó y cumplió.
- `sdd-phase-common` (shared) — leída para cargar convención de persistencia hybrid y return envelope.
- `openspec-convention` (shared) — leída para path `openspec/changes/<change>/explore/exploration.md`.

---

## artifacts_written

- Este archivo: `openspec/changes/hu0-2-convencion-de-registro-del-script-de-playwright/explore/exploration.md`
- `state.yaml` se actualizará con `explore.completed: true`.
- Engram: observación `sdd/hu0-2-convencion-registro-script/explore`.
