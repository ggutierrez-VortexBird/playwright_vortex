-- SesionGrabacion persiste el .spec.ts crudo de codegen (specCode) y su ruta (codegenFilePath), ambos nullable.

-- AlterTable
ALTER TABLE "SesionGrabacion" ADD COLUMN "specCode" TEXT;
ALTER TABLE "SesionGrabacion" ADD COLUMN "codegenFilePath" TEXT;
