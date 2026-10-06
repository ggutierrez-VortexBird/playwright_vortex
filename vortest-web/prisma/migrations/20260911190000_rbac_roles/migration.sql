-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('superadmin', 'admin', 'tester');

-- AlterTable
-- El único registro existente (admin@admin.com) ya tiene el valor 'superadmin',
-- válido en el nuevo enum, por lo que el cast USING no pierde datos reales.
ALTER TABLE "Usuario" ALTER COLUMN "rol" DROP DEFAULT,
ALTER COLUMN "rol" TYPE "Rol" USING ("rol"::"Rol"),
ALTER COLUMN "rol" SET DEFAULT 'tester';

-- CreateTable
CREATE TABLE "UsuarioProyecto" (
    "usuarioId" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuarioProyecto_pkey" PRIMARY KEY ("usuarioId","proyectoId")
);

-- CreateIndex
CREATE INDEX "UsuarioProyecto_proyectoId_idx" ON "UsuarioProyecto"("proyectoId");

-- AddForeignKey
ALTER TABLE "UsuarioProyecto" ADD CONSTRAINT "UsuarioProyecto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioProyecto" ADD CONSTRAINT "UsuarioProyecto_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
