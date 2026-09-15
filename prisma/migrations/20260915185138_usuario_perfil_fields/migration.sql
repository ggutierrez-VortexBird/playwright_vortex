-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "nombre" TEXT,
ADD COLUMN     "ultimoAccesoAt" TIMESTAMPTZ(6);
