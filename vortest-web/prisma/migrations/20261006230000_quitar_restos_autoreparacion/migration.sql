-- Quita restos de la auto-reparación (eliminada del producto): valor 'reparado' de los enums y columnas sin uso. Verificado sin datos antes de migrar.
-- AlterEnum
BEGIN;
CREATE TYPE "EjecucionEstado_new" AS ENUM ('pendiente', 'corriendo', 'paso', 'fallo', 'errorMotor', 'cancelado');
ALTER TABLE "Ejecucion" ALTER COLUMN "estado" TYPE "EjecucionEstado_new" USING ("estado"::text::"EjecucionEstado_new");
ALTER TYPE "EjecucionEstado" RENAME TO "EjecucionEstado_old";
ALTER TYPE "EjecucionEstado_new" RENAME TO "EjecucionEstado";
DROP TYPE "public"."EjecucionEstado_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PasoEjecucionEstado_new" AS ENUM ('paso', 'fallo');
ALTER TABLE "PasoEjecucion" ALTER COLUMN "estado" TYPE "PasoEjecucionEstado_new" USING ("estado"::text::"PasoEjecucionEstado_new");
ALTER TABLE "PasoSubaccion" ALTER COLUMN "estado" TYPE "PasoEjecucionEstado_new" USING ("estado"::text::"PasoEjecucionEstado_new");
ALTER TYPE "PasoEjecucionEstado" RENAME TO "PasoEjecucionEstado_old";
ALTER TYPE "PasoEjecucionEstado_new" RENAME TO "PasoEjecucionEstado";
DROP TYPE "public"."PasoEjecucionEstado_old";
COMMIT;

-- AlterTable
ALTER TABLE "IntentoLogin" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PasoEjecucion" DROP COLUMN "selfHealed";

-- AlterTable
ALTER TABLE "PasoGrabado" DROP COLUMN "selectoresRespaldo";

