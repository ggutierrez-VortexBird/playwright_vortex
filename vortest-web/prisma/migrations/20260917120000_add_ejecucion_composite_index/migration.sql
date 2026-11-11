-- Índice compuesto para acelerar la consulta de ejecuciones en curso por caso (lib/worker/lock.ts).
CREATE INDEX "Ejecucion_casoPruebaId_estado_idx" ON "Ejecucion"("casoPruebaId", "estado");
