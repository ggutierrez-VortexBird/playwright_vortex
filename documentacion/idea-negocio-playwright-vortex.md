# ACTA — Idea de negocio

## Problema

Hoy, correr y documentar pruebas automatizadas de frontend con Playwright depende de su interfaz nativa o de scripts sueltos, sin un lugar centralizado donde:

- Ordenar esas pruebas por cliente y proyecto.
- Dejar evidencia formal, estandarizada y auditable de que una prueba se ejecutó y qué pasó paso a paso.
- Presentar esa evidencia a un cliente o a un área de cumplimiento sin tener que armarla manualmente cada vez.

## Propuesta de valor

Una plataforma propia para ejecutar y organizar pruebas automatizadas, estructurada en cuatro niveles jerárquicos:

1. **Empresa** — cada cliente tiene su espacio aislado.
2. **Proyecto** — cada empresa agrupa uno o varios proyectos.
3. **Caso de prueba** — cada proyecto agrupa sus casos de prueba.
4. **Ejecución** — cada caso de prueba acumula su historial de ejecuciones.

Cada ejecución genera automáticamente un **Acta de ejecución de pruebas**: un documento formal con la evidencia (resultado paso a paso, artefactos, metadatos), pensado para ser presentable como respaldo ante el cliente o ante control interno — no solo un log técnico.

## Cómo se cargan los casos de prueba

No existe un sistema intermedio que reciba una definición (JSON, formulario, etc.) y la traduzca en una prueba. El caso de prueba se carga **directamente como su archivo `.spec.ts` de Playwright**, tal cual — lo que se carga es el archivo de test mismo, no se sube un JSON ni se rellena un formulario. La plataforma no abstrae ni reinterpreta la prueba: la ejecuta, la ordena dentro de la jerarquía empresa → proyecto → caso, y produce la evidencia.

Esto define el foco del producto: el valor no está en "crear pruebas visualmente", sino en **organizar, ejecutar y dejar evidencia formal** de pruebas que ya se saben escribir en Playwright.

## Usuarios y acceso

- **Fase 1:** un único usuario, superusuario, con acceso total a todos los espacios (empresas/proyectos).
- La aplicación debe diseñarse desde el inicio con el concepto de "espacios" como unidad de aislamiento — no como un añadido posterior — para poder extenderse más adelante a más usuarios y, eventualmente, segmentar permisos por espacio. Esa segmentación no es parte del alcance de negocio actual; es solo una restricción de diseño a tener en cuenta.

## Qué queda fuera del alcance actual

- **Gestión de credenciales:** es una función de apoyo, no un pilar del negocio.
- **Retención de evidencia y cumplimiento normativo:** decisiones a resolver más adelante, no parte de la idea central.
- **Multi-tenant real / segmentación de permisos:** contemplado como posibilidad futura, no como requisito de esta fase.

## Síntesis

Una herramienta interna, autocontenida, para ejecutar pruebas Playwright ya existentes de forma organizada por cliente y proyecto, y convertir cada ejecución en una pieza de evidencia formal (el "acta") que sirva como respaldo ante clientes o auditoría — sin capas intermedias de abstracción sobre la prueba en sí.

## Concepto central

ACTA es una herramienta interna que ejecuta pruebas Playwright ya escritas por el equipo y deja, de cada ejecución, una pieza de evidencia formal (el "acta") organizada por empresa y proyecto.

## Para quién es esta herramienta

ACTA es una **herramienta interna de Vortexbird**. La usa el equipo de Vortexbird para correr sus propias pruebas. El cliente no accede a la plataforma: cuando corresponde, recibe el acta como documento (PDF) generado por la herramienta, no la herramienta misma.

## La evidencia es ejecutable

Un acta no es un documento armado a mano a partir de notas y capturas sueltas: es el resultado trazable de que la prueba **puede volver a correrse** y validarse de nuevo contra el mismo caso y el mismo ambiente. Esta propiedad — la posibilidad de re-correr y re-validar — es lo que diferencia el acta de ACTA de un simple informe en prosa con pegado de pantallazos.

## Ejecución y acta

Una ejecución produce un acta; un acta pertenece a una ejecución. La relación es 1-a-1: cada ejecución finalizada tiene su acta asociada, y el acta se puede regenerar a partir de su ejecución sin perder identidad (mismo identificador, mismos metadatos base, evidencia actualizada).

## Política de retención de evidencia

La política de retención a 5 años con almacenamiento inmutable que aparece en el mockup del acta es una **propuesta aspiracional**. Hoy está fuera del alcance de negocio — se resolverá cuando exista un compromiso formal con el cliente sobre el periodo y las condiciones de conservación. Hasta entonces, la plataforma persiste los artefactos según lo definido en su Fase 8 (volumen persistente) sin promesa formal de inmutabilidad ni de plazo de retención.
