-- DropIndex
DROP INDEX "Ejecucion_casoPruebaId_idx";

-- DropIndex
DROP INDEX "Ejecucion_estado_idx";

-- DropIndex
DROP INDEX "PasoEjecucion_ejecucionId_idx";

-- DropIndex
DROP INDEX "PasoSubaccion_pasoEjecucionId_idx";

-- CreateIndex
CREATE INDEX "Ejecucion_estado_inicioAt_idx" ON "Ejecucion"("estado", "inicioAt");

-- CreateIndex
CREATE INDEX "Ejecucion_casoPruebaId_finAt_idx" ON "Ejecucion"("casoPruebaId", "finAt");

-- CreateIndex
CREATE INDEX "Ejecucion_createdAt_idx" ON "Ejecucion"("createdAt");

-- CreateIndex
CREATE INDEX "PasoSubaccion_pasoEjecucionId_numero_idx" ON "PasoSubaccion"("pasoEjecucionId", "numero");

