-- Composite index to speed up the worker's per-caso lock check
-- (SELECT ... WHERE "casoPruebaId" = $1 AND "estado" IN (...) FOR UPDATE NOWAIT
-- in lib/worker/lock.ts) which previously relied on two separate single-column
-- indexes (casoPruebaId, estado) requiring a bitmap AND instead of a direct
-- index scan.
CREATE INDEX "Ejecucion_casoPruebaId_estado_idx" ON "Ejecucion"("casoPruebaId", "estado");
