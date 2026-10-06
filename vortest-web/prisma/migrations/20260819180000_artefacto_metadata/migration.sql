-- AlterTable
-- HU-4.5: agrega columna metadata (Json, nullable) a Artefacto.
-- Es opcional, no afecta filas existentes de HU-4.2 (quedan en null).
ALTER TABLE "Artefacto" ADD COLUMN "metadata" JSONB;
