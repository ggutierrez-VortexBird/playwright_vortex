-- AlterTable
ALTER TABLE "CasoPrueba" ADD COLUMN     "parentCaseId" TEXT;

-- AlterTable
ALTER TABLE "Ejecucion" ADD COLUMN     "storageState" JSONB;

-- AlterTable
ALTER TABLE "SesionGrabacion" ADD COLUMN     "parentCaseId" TEXT;

-- CreateIndex
CREATE INDEX "CasoPrueba_parentCaseId_idx" ON "CasoPrueba"("parentCaseId");

-- CreateIndex
CREATE INDEX "SesionGrabacion_parentCaseId_idx" ON "SesionGrabacion"("parentCaseId");

-- AddForeignKey
ALTER TABLE "CasoPrueba" ADD CONSTRAINT "CasoPrueba_parentCaseId_fkey" FOREIGN KEY ("parentCaseId") REFERENCES "CasoPrueba"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionGrabacion" ADD CONSTRAINT "SesionGrabacion_parentCaseId_fkey" FOREIGN KEY ("parentCaseId") REFERENCES "CasoPrueba"("id") ON DELETE SET NULL ON UPDATE CASCADE;
