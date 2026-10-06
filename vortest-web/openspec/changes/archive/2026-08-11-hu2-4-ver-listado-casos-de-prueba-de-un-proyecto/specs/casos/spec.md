# Delta: Ver listado de casos de prueba de un proyecto

## MODIFIED Requirements

### Requirement: Ver listado de casos con detalle de última ejecución y pasos

El sistema DEBE mostrar cada caso de prueba con su código, nombre, responsable, script, estado de última ejecución, fecha de última ejecución y conteo de pasos de la última ejecución. Los botones de Editar y Eliminar DEBEN revelarse al hacer hover sobre la fila y ser accesibles en dispositivos táctiles sin capacidad hover.

(Previously: caso listing without pasosCount column and buttons always visible)

#### Scenario: Caso con ejecuciones muestra pasosCount

- GIVEN a proyecto "P1" with a caso "C1" that has a latest Ejecucion with 5 pasos
- WHEN the user views the caso list for proyecto "P1"
- THEN the row for "C1" shows a "Pasos" column with value "5"
- AND the Edit/Eliminar buttons are hidden until hover

#### Scenario: Caso sin ejecuciones muestra 0 pasos

- GIVEN a proyecto "P1" with a caso "C2" that has no ejecuciones
- WHEN the user views the caso list for proyecto "P1"
- THEN the row for "C2" shows a "Pasos" column with value "0"
- AND the Edit/Eliminar buttons are hidden until hover

#### Scenario: Hover revela botones de acción

- GIVEN a user with edit permissions viewing the caso list with canEdit=true
- WHEN the user hovers over a caso row (device supports hover)
- THEN the Edit and Eliminar buttons become visible within that row
- AND moving the cursor away hides the buttons again

#### Scenario: Mobile fallback — tap para revelar botones

- GIVEN a user on a touch device (hover: none) viewing the caso list with canEdit=true
- WHEN the user taps a caso row
- THEN the Edit and Eliminar buttons become visible within that row
- AND tapping outside the buttons hides them again

#### Scenario: Sin permisos de edición no muestra columna Acciones

- GIVEN a user without edit permissions (canEdit=false)
- WHEN the user views the caso list
- THEN the Acciones column is not rendered
- AND no Edit/Eliminar buttons appear

#### Scenario: Listado vacío muestra mensaje

- GIVEN a proyecto "P1" with no casos de prueba
- WHEN the user views the caso list for proyecto "P1"
- THEN a message "No hay casos de prueba" is displayed
- AND no table is rendered
