-- AlterEnum
-- Postgres requires ALTER TYPE ... ADD VALUE to run outside a transaction block.
-- Prisma applies non-concurrent enum additions automatically with IF NOT EXISTS
-- to make the migration idempotent.
ALTER TYPE "EjecucionEstado" ADD VALUE IF NOT EXISTS 'cancelado';
