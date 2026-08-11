# Spec: visual-identity-espacio

## Purpose

La identidad visual del espacio (color) debe ser visible y consistente en toda la UI para reducir errores de ejecutar pruebas contra el cliente/espacio equivocado. El color aparece en 4 puntos visuales claramente distinguibles: ClientBand, EspacioSwitcher, ScopeBar y ProyectoCard.

## Requirements

### Requirement: El color del espacio aparece en los 4 puntos visuales

Cuando existe un espacio activo con color definido, el sistema DEBE mostrar dicho color en:
- `ClientBand`: franja vertical de 3px en el borde izquierdo del sidebar oscuro
- `EspacioSwitcher`: marcador circular `sw-mark` de 9×9px del color junto al nombre del espacio en el dropdown
- `ScopeBar`: ícono cuadrado de 8×8px con el color del espacio activo
- `ProyectoCard`: borde superior `border-top` de 3px sólido con el color del espacio

#### Scenario: Color aparece en los 4 puntos con espacio que tiene color definido

- **Given** existe un espacio "Empresa X" con color `#C9822F`
- **And** el usuario navega a `/espacios/empresa-x/proyectos`
- **Then** el `ClientBand` muestra una franja vertical de 3px con `#C9822F`
- **And** el `EspacioSwitcher` muestra `sw-mark` circular de 9×9px con `#C9822F`
- **And** el `ScopeBar` muestra ícono de 8×8px con `#C9822F`
- **And** cada `ProyectoCard` muestra `border-top: 3px solid #C9822F`

#### Scenario: Color NO aparece cuando el espacio no tiene color definido (fallback)

- **Given** existe un espacio "Empresa Y" sin color definido (`color: null`)
- **When** el usuario navega a `/espacios/empresa-y/proyectos`
- **Then** el `ClientBand` NO muestra franja de color (comportamiento por defecto)
- **And** el `EspacioSwitcher` NO muestra `sw-mark` para ese espacio
- **And** el `ScopeBar` NO muestra ícono de color
- **And** las `ProyectoCard` NO muestran `border-top` de color

### Requirement: El cambio de color se refleja en menos de una navegación

Cuando se actualiza el color de un espacio vía `PUT /api/espacios/[id]`, el sistema DEBE propagar el nuevo color a todos los puntos visuales en la siguiente navegación sin necesidad de hard refresh.

#### Scenario: Cambio de color se refleja inmediatamente tras guardar

- **Given** el usuario tiene un espacio "Empresa Z" con color `#FF0000`
- **And** está en la página de editar espacio
- **When** cambia el color a `#00FF00` y guarda (PUT success)
- **Then** al navegar a `/espacios/empresa-z/proyectos`, todos los 4 puntos muestran `#00FF00`
- **And** no se requiere hard refresh ni limpieza de caché del navegador

### Requirement: Colores diferentes por espacio se muestran correctamente

Cuando hay múltiples espacios con colores distintos activos en diferentes contextos, cada punto visual DEBE mostrar el color correspondiente a su espacio activo.

#### Scenario: Dos espacios con colores distintos muestran sus colores correctamente

- **Given** existe espacio-A con color `#C9822F` y espacio-B con color `#2F7DC9`
- **When** el usuario está en contexto de espacio-A
- **Then** los 4 puntos visuales muestran `#C9822F`
- **When** el usuario cambia a espacio-B via `EspacioSwitcher`
- **Then** los 4 puntos visuales actualizan a `#2F7DC9`

### Requirement: El color se pasa correctamente vía props desde page.tsx

Los componentes `ClientBand`, `EspacioSwitcher`, `ScopeBar` y `ProyectoCard` DEBEN recibir `espacio.color` como prop o mediante `useParams()`/fetch para mostrar el color correcto.

#### Scenario: Page pasa color a ScopeBar y ProyectoCard

- **Given** existe un espacio con ID `espacio-uuid` y color `#C9822F`
- **When** se renderiza `/espacios/espacio-uuid/proyectos`
- **Then** la page obtiene `espacio.color` del fetch del espacio
- **And** pasa `espacioColor="#C9822F"` a `ScopeBar`
- **And** pasa `espacioColor="#C9822F"` a cada `ProyectoCard`

## Design Reference

Mockup: `documentacion/acta-mockups.html`
- Color de acento de ejemplo: `--client: #C9822F`
- `client-band`: franja 3px en borde derecho sidebar
- `sw-mark`: círculo 9×9px
- `scope-bar`: ícono 8×8px
- `border-top`: 3px solid en tarjeta proyecto
