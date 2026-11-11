-- AlterEnum
-- ALTER TYPE ... ADD VALUE corre fuera de una transacción; Prisma lo aplica con IF NOT EXISTS.
ALTER TYPE "EjecucionEstado" ADD VALUE IF NOT EXISTS 'cancelado';
