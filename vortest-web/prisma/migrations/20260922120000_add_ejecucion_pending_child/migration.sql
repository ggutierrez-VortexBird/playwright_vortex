-- Persiste en DB la relación padre→hijo en espera para que sobreviva al cruce de proceso web → consumer.
ALTER TABLE "Ejecucion" ADD COLUMN "pendingChildEjecucionId" TEXT;
