/*
  Warnings:

  - Added the required column `nombre` to the `Artefacto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Artefacto" ADD COLUMN     "nombre" TEXT NOT NULL,
ADD COLUMN     "pasoEjecucionId" TEXT;

-- AlterTable
ALTER TABLE "Ejecucion" ADD COLUMN     "errorMsg" TEXT;

-- CreateIndex
CREATE INDEX "Artefacto_pasoEjecucionId_idx" ON "Artefacto"("pasoEjecucionId");

-- AddForeignKey
ALTER TABLE "Artefacto" ADD CONSTRAINT "Artefacto_pasoEjecucionId_fkey" FOREIGN KEY ("pasoEjecucionId") REFERENCES "PasoEjecucion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
