# Exploration: HU-2.2 — Crear proyecto dentro de un espacio

## 1. Modelo de datos Prisma

**Estado: COMPLETO**

El modelo `Proyecto` ya existe en `prisma/schema.prisma` (líneas 85-101):

```prisma
model Proyecto {
  id             String   @id @default(uuid())
  espacioId      String
  nombre         String
  ambiente       String
  descripcion    String?
  versionSistema String?
  activo         Boolean  @default(true)
  createdAt      DateTime @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @db.Timestamptz(6)

  espacio     Espacio       @relation(fields: [espacioId], references: [id], onDelete: Restrict)
  casosPrueba CasoPrueba[]
  credenciales Credencial[]

  @@index([espacioId])
}
```

Relación: `Espacio → Proyecto` es **1:N** con `onDelete: Restrict` (cumple CA-3: no borra en cascada silencioso).

**Lo que falta:**
- Tipo TypeScript `Proyecto` y `CreateProyectoInput` en `/types/proyecto.ts` (no existe)
- Acciones en `/lib/proyectos/actions.ts` (no existe)
- API routes en `/api/proyectos/` y `/api/proyectos/[id]/` (no existen)

---

## 2. Estructura de rutas Next.js App Router

**Estado: PARCIAL**

Rutas existentes:
- `/app/(dashboard)/proyectos/page.tsx` — **Stub** (solo dice "Lista de proyectos (próximamente)")
- `/app/(dashboard)/espacios/page.tsx` — Lista de espacios con cliente completo
- `/app/(dashboard)/espacios/[id]/page.tsx` — **No existe**

**Estructura existente:**
```
app/
├── (dashboard)/
│   ├── layout.tsx          # Sidebar con navegación
│   ├── page.tsx           # Dashboard principal
│   ├── proyectos/page.tsx  # STUB - necesita implementarse
│   ├── espacios/page.tsx  # Completo
│   ├── casos/page.tsx     # Existe
│   ├── ejecuciones/page.tsx
│   └── credenciales/page.tsx
└── api/
    ├── espacios/route.ts         # GET, POST
    ├── espacios/[id]/route.ts    # GET, PUT, DELETE
    └── logout/route.ts
```

**Lo que falta:**
- `/app/(dashboard)/espacios/[id]/proyectos/page.tsx` — Página de proyectos DENTRO de un espacio
- `/app/(dashboard)/proyectos/[id]/page.tsx` — Detalle de proyecto
- `/app/api/proyectos/route.ts` — API crear/listar proyectos
- `/app/api/proyectos/[id]/route.ts` — API obtener/actualizar/eliminar proyecto

---

## 3. Componentes UI (Mockup `acta-mockups.html`)

**Patrón de tarjeta de proyecto** (mockup sección "multi-proyecto"):

```html
<div class="proj-grid">
  <button class="proj-card">
    <div class="pc-top" style="border-top-color:#C9822F">
      <div class="pc-client">Bancoomeva</div>      <!-- Nombre del espacio (chip) -->
      <div class="pc-name">Nombre del proyecto</div> <!-- Nombre proyecto -->
    </div>
    <div class="pc-stats">
      <div><div class="k">Casos</div><div class="v">5</div></div>
      <div><div class="k">Conformes</div><div class="v" style="color:var(--seal)">2</div></div>
      <div><div class="k">No conformes</div><div class="v" style="color:var(--stamp)">1</div></div>
    </div>
    <div class="pc-foot">
      <span>Ambiente QA</span>   <!-- ambiente -->
      <span>hace 2 h</span>      <!-- fecha última ejecución -->
    </div>
  </button>
</div>
```

**Tokens de diseño** (CSS custom properties):
- `--client` (#C9822F) — Color del cliente/espacio
- `--seal` (#0E6B4F) — Verde para "conforme"
- `--stamp` (#A8322A) — Rojo para "no conforme"
- `--amber` (#A9741A) — Ámbar para "reparado"

**Componente existente:**
- `components/ui/color-picker.tsx` — Existe para selección de color en espacios

---

## 4. API Routes de espacios (patrón a seguir)

**Patrón existente** (`/api/espacios/route.ts`):
1. `GET /api/espacios` — Lista espacios activos
2. `POST /api/espacios` — Crea espacio con `{ nombre, color }`

**Validación** (en `lib/espacios/actions.ts`):
- Valida que campos requeridos existan y no sean strings vacíos
- Lanza `{ status: 400, body: { error: "validation", message: "..." } }` para errores de validación
- Lanza `{ status: 404, body: { error: "not_found" } }` para no encontrado

**Eliminar** (`deleteEspacio`): Soft delete (`activo: false`) — cumple CA-3.

---

## 5. Autenticación

**Estado: Configurado con iron-session (NO Clerk)**

- Middleware usa `getIronSession` con cookie `acta_session`
- `getSession()` retorna `{ userId?: string, email?: string }`
- No hay verificación de rol en las API routes existentes (todas validan `session.userId`)

**Lo que falta para HU-2.2:**
- Verificar que el usuario tiene rol `superadmin` para crear proyectos
- Middleware no valida roles actualmente

---

## 6. Consultas para conteos de casos (CA-2, CA-4)

**CA-2:** Contar casos de prueba por proyecto:
```prisma
prisma.casoPrueba.count({ where: { proyectoId } })
```

**CA-4:** Últimas ejecuciones por proyecto requieren:
```prisma
prisma.ejecucion.groupBy({
  by: ['casoPruebaId'],
  where: { casoPrueba: { proyectoId } },
  orderBy: { finAt: 'desc' }
})
```

Esto es complejo porque:
1. Una ejecución pertenece a un `casoPrueba`, no directamente a un `proyecto`
2. Necesitas la última ejecución de CADA caso dentro del proyecto
3. Contar conformes/no conformes de esas últimas ejecuciones

---

## Hallazgos clave

| Área | Estado | Acción requerida |
|------|--------|-----------------|
| Modelo Proyecto | ✅ Existe | Ninguna |
| Tipos TypeScript | ❌ Falta | Crear `types/proyecto.ts` |
| Acciones BD | ❌ Falta | Crear `lib/proyectos/actions.ts` |
| API routes | ❌ Falta | Crear `/api/proyectos/` y `/api/proyectos/[id]/` |
| Página proyectos | ⚠️ Stub | Implementar full |
| Página proyectos por espacio | ❌ Falta | Crear `/espacios/[id]/proyectos/page.tsx` |
| Tarjeta proyecto UI | ⚠️ Mockup existe | Implementar componente React |
| Soft delete espacio | ⚠️ Ya funciona | Para CA-3, el `onDelete: Restrict` y soft-delete ya están |
| Verificación superadmin | ❌ Falta | Agregar validación de rol |

---

## Risks

1. **Complejidad en conteos de última ejecución** — La query para CA-4 (conformes/no conformes en última ejecución) puede ser costosa. Considerar materialized view o campo redundante en `Proyecto`.
2. **Rol superadmin** — No hay middleware de autorización por rol todavía.
3. **No hay workspace/context actual** — El mockup muestra un "switcher" de proyecto activo, pero no existe en el código.
