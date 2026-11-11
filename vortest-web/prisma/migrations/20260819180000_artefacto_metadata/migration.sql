-- AlterTable
-- Agrega la columna metadata (Json, nullable) a Artefacto; las filas existentes quedan en null.
ALTER TABLE "Artefacto" ADD COLUMN "metadata" JSONB;
