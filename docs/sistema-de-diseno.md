# Sistema de diseño

La interfaz de vorTest es una herramienta de trabajo para QA: densa en información, sobria y con la marca en los lugares que importan (acciones principales, navegación activa, foco). Todo sale de un solo lugar.

## Marca

El logo tiene dos tonos y la interfaz los respeta:

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `m3-primary` | `#135C65` teal "vor" | `#7CCBD1` | Botón principal, enlaces, estado seleccionado. |
| `m3-primary-container` | `#0B2E33` | `#06191C` | Menú lateral, avatar. |
| `m3-secondary-container` | `#EEAA0B` ámbar "Test" | `#EEAA0B` | Marca de ítem activo, foco sobre el menú, relleno con texto oscuro. |
| `m3-secondary` | `#8A5700` | `#F2BC45` | Ámbar cuando tiene que ser texto (el ámbar puro no alcanza contraste sobre blanco). |

Colores sólidos, sin degradados. Los títulos van en tinta (`m3-on-surface`), no en color: el teal se reserva para lo accionable. El menú lateral usa `public/logo-oscuro.png`, una versión del logo con el teal aclarado para fondo oscuro.

## Dónde viven los tokens

- **Valores**: [`vortest-web/app/tokens.css`](../vortest-web/app/tokens.css). Colores como canales RGB (`--m3-primary: 19 92 101`) para que Tailwind acepte opacidad (`bg-m3-primary/10`). Incluye tema claro, tema oscuro y tokens de movimiento y radio.
- **Utilidades**: [`tailwind.config.ts`](../vortest-web/tailwind.config.ts) sólo expone esos valores (`bg-m3-*`, `text-m3-*`, `z-modal`, `duration-base`…). Los nombres de los tokens están en [`lib/design-tokens.ts`](../vortest-web/lib/design-tokens.ts), que también usa `cn()` para resolver conflictos de clases.
- **Regla**: nada de hex sueltos en componentes. Las excepciones a propósito son el fondo del reproductor de video y del editor de código (siempre oscuros) y los colores que elige el usuario para sus espacios.

## Tema oscuro

`prefers-color-scheme` por defecto, con selector manual en el menú de usuario (Claro · Oscuro · Sistema) guardado en `localStorage`. Un script en `<head>` aplica la elección antes del primer pintado para que no parpadee. Los tokens redefinen sus valores bajo `[data-theme="dark"]`; los componentes no tienen variantes `dark:`.

## Tipografía

**Archivo** (con eje de ancho) para todo el texto; los títulos de página usan su corte semiexpandido (`font-wide`), que recuerda las letras anchas del logo. **JetBrains Mono** para códigos de caso, IDs y scripts. Se cargan con `next/font` (sin peticiones que bloqueen el render).

| Token | Tamaño / interlínea | Uso |
|---|---|---|
| `text-display-md` · `text-display` | 28/36 · 24/32 | Cifras grandes. |
| `text-headline-lg` · `md` · `sm` | 20/28 · 18/24 · 16/22 | Títulos de página, de sección, de tarjeta. |
| `text-body-lg` · `md` · `sm` · `xs` | 16/24 · 14/20 · 13/18 · 12/16 | Texto corrido. `body-md` es el tamaño base. |
| `text-label-lg` · `md` · `sm` · `xs` | 14 · 13 · 12 · 11 | Botones, etiquetas, badges. 11 px es el mínimo. |

## Espaciado, radios, sombras y capas

- Espaciado: escala de Tailwind (múltiplos de 4 px).
- Radios: `rounded-sm` 8 px (controles chicos), `rounded-md` 12 px (botones, campos), `rounded-lg` 16 px (tarjetas, modales).
- Sombras: `shadow-card`, `shadow-card-hover`, `shadow-modal`, teñidas con el tono de la marca.
- Capas (`z-*`): `sticky` 20 · `dropdown` 30 · `overlay` 40 · `modal` 50 · `toast` 60 · `tooltip` 70.

## Movimiento

`duration-fast` 120 ms · `duration-base` 200 ms · `duration-slow` 320 ms con `ease-standard`. El movimiento responde a acciones (abrir, confirmar, aparecer un paso nuevo); no hay animaciones decorativas. Con `prefers-reduced-motion` todo se reduce a casi cero.

## Componentes base (`components/ui/`)

| Componente | Para qué |
|---|---|
| `Button` / `ButtonLink` | Variantes `primary`, `secondary`, `tonal`, `danger`, `ghost`; tamaños `sm`, `md`; `icon`; `loading` + `loadingText` (deshabilita y muestra spinner). |
| `Field` + `Input` / `Select` / `Textarea` | Etiqueta, ayuda y error enlazados (`aria-describedby`, `aria-invalid`); el asterisco de obligatorio va por CSS. |
| `Alert` | Mensaje en línea por tono; los errores se anuncian (`role="alert"`). |
| `useToast()` | Avisos efímeros con acción opcional; se pausan con el puntero o el foco. Montado en el layout del dashboard. |
| `Modal` | Escape, clic afuera, foco atrapado. Con `hayCambios` pide confirmación antes de cerrar y perder lo escrito. |
| `ConfirmDialog` | Confirmación de acciones destructivas; el foco empieza en "Cancelar". |
| `StatusBadge` / `EstadoBadge` | Estado con color **más ícono más texto**. `EstadoBadge` toma un estado del dominio. |
| `Card`, `CardHeader`, `CardBody` | Superficie base. |
| `Tabs` | Pestañas accesibles (flechas, Inicio, Fin). |
| `Spinner`, `Skeleton`, `TableSkeleton` | Carga. Cada ruta tiene su `loading.tsx` con la forma de su pantalla. |
| `EmptyState` | Estado vacío con llamada a la acción. |
| `ErrorBoundaryView` | Vista de los `error.tsx`: mensaje en español, código de soporte, Reintentar e Ir al inicio. |
| `Icon` | Material Symbols. Siempre decorativo (`aria-hidden`); el glifo se pinta con `::before`, así el nombre del ícono no queda en el texto. |
| `PageHeader` | Título, migas, acciones de la página. |

## Estados del dominio

Un único mapa en [`lib/ejecuciones/estado.ts`](../vortest-web/lib/ejecuciones/estado.ts). Ninguna pantalla define sus propias etiquetas.

| Estado | Etiqueta | Tono | Ícono |
|---|---|---|---|
| `pendiente` | En cola | info | `schedule` |
| `corriendo` | Ejecutando | info | `progress_activity` (gira) |
| `paso` | Conforme | éxito | `check_circle` |
| `fallo` | No conforme (· paso N) | error | `cancel` |
| `errorMotor` | Error del motor | advertencia | `report` |
| `cancelado` | Cancelada | neutro | `block` |

## Accesibilidad

Objetivo WCAG 2.1 AA, verificado con axe-core en las pantallas principales, en tema claro y oscuro.

- Contraste ≥ 4.5:1 en todo el texto. Sobre colores elegidos por el usuario, una capa negra calculada (`lib/color.ts`) oscurece lo justo para que el texto blanco cumpla.
- Foco visible en todo (ámbar sobre el menú, `m3-secondary` en el resto).
- "Saltar al contenido" como primer elemento enfocable; el menú móvil queda `inert` mientras está cerrado.
- El estado nunca depende sólo del color; los gráficos tienen alternativa textual.
- Escape cierra menús, selectores, modales y el menú móvil.

## Textos

Español neutro, con tuteo ("Revisa", "Intenta de nuevo"). Las acciones dicen lo que hacen y el aviso usa el mismo verbo ("Guardar credencial" → "Credencial guardada"). Los errores explican qué pasó y cómo seguir, sin códigos internos ni números HTTP a la vista. El vocabulario del resultado es siempre "Conforme / No conforme".
