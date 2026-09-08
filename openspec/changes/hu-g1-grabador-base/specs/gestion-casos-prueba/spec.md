# Delta for gestion-casos-prueba

## MODIFIED Requirements

### Requirement: Origen del caso (grabador vs script)

El sistema DEBE registrar el origen de cada `casoPrueba` mediante el enum `CasoOrigen` con valores `subirScript | grabador | mixto`. El campo `origen` DEBE tener default `subirScript` para mantener compatibilidad con casos existentes. Un caso creado por el modo grabador DEBE quedar con `origen='grabador'`. Un caso cuyo script fue editado manualmente tras la grabación DEBE pasar a `origen='mixto'`.

(Previously: el campo `origen` no existía; todos los casos eran implícitamente `subirScript`)

#### Scenario: Caso preexistente conserva origen por default

- GIVEN casos registrados antes de HU-G1 con `origen` indefinido
- WHEN se aplica la migración `hu_g21_grabador_models`
- THEN todos los casos preexistentes quedan con `origen='subirScript'` automáticamente
- AND el flujo de subida de scripts sigue funcionando sin cambios

#### Scenario: Caso grabado tiene origen='grabador'

- GIVEN una grabación finalizada con `SesionGrabacion.casoPruebaId` asignado
- WHEN se persiste el `casoPrueba` correspondiente
- THEN `casoPrueba.origen = 'grabador'`
- AND la UI de detalle del caso muestra una etiqueta "Origen: Grabador"

#### Scenario: Caso editado manualmente queda como mixto

- GIVEN un caso con `origen='grabador'`
- WHEN el usuario edita manualmente el `script` desde el editor (HU-G11)
- THEN `casoPrueba.origen` pasa a `'mixto'`
- AND la UI lo refleja en la etiqueta de origen