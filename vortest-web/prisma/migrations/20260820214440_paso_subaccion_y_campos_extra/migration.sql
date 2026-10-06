-- AlterTable
ALTER TABLE "Ejecucion" ADD COLUMN     "asercionesFail" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "asercionesOk" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "asercionesTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "entorno" TEXT,
ADD COLUMN     "navegador" TEXT,
ADD COLUMN     "nodoEjecucion" TEXT,
ADD COLUMN     "sistemaOperativo" TEXT;

-- AlterTable
ALTER TABLE "PasoEjecucion" ADD COLUMN     "errorCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "logs" JSONB,
ADD COLUMN     "resultadoEsperado" TEXT,
ADD COLUMN     "resultadoObtenido" TEXT;

-- CreateTable
CREATE TABLE "PasoSubaccion" (
    "id" TEXT NOT NULL,
    "ejecucionId" TEXT NOT NULL,
    "pasoEjecucionId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'other',
    "descripcion" TEXT NOT NULL,
    "estado" "PasoEjecucionEstado" NOT NULL,
    "duracionMs" INTEGER,
    "errorMsg" TEXT,
    "logs" JSONB,
    "capturaActualId" TEXT,
    "capturaReferenciaId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasoSubaccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasoSubaccion_ejecucionId_idx" ON "PasoSubaccion"("ejecucionId");

-- CreateIndex
CREATE INDEX "PasoSubaccion_pasoEjecucionId_idx" ON "PasoSubaccion"("pasoEjecucionId");

-- AddForeignKey
ALTER TABLE "PasoSubaccion" ADD CONSTRAINT "PasoSubaccion_ejecucionId_fkey" FOREIGN KEY ("ejecucionId") REFERENCES "Ejecucion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasoSubaccion" ADD CONSTRAINT "PasoSubaccion_pasoEjecucionId_fkey" FOREIGN KEY ("pasoEjecucionId") REFERENCES "PasoEjecucion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasoSubaccion" ADD CONSTRAINT "PasoSubaccion_capturaActualId_fkey" FOREIGN KEY ("capturaActualId") REFERENCES "Artefacto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasoSubaccion" ADD CONSTRAINT "PasoSubaccion_capturaReferenciaId_fkey" FOREIGN KEY ("capturaReferenciaId") REFERENCES "Artefacto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
