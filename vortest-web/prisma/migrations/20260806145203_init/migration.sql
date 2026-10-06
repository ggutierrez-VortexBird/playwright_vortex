-- CreateEnum
CREATE TYPE "EjecucionEstado" AS ENUM ('pendiente', 'corriendo', 'paso', 'fallo', 'reparado', 'errorMotor');

-- CreateEnum
CREATE TYPE "PasoEjecucionEstado" AS ENUM ('paso', 'fallo', 'reparado');

-- CreateEnum
CREATE TYPE "ArtefactoTipo" AS ENUM ('video', 'captura', 'trace');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'superadmin',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Espacio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Espacio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioEspacio" (
    "usuarioId" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuarioEspacio_pkey" PRIMARY KEY ("usuarioId","espacioId")
);

-- CreateTable
CREATE TABLE "Proyecto" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL,
    "descripcion" TEXT,
    "versionSistema" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasoPrueba" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rutaScript" TEXT NOT NULL,
    "responsableId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CasoPrueba_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ejecucion" (
    "id" TEXT NOT NULL,
    "casoPruebaId" TEXT NOT NULL,
    "estado" "EjecucionEstado" NOT NULL,
    "inicioAt" TIMESTAMP(3),
    "finAt" TIMESTAMP(3),
    "duracionMs" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Ejecucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasoEjecucion" (
    "id" TEXT NOT NULL,
    "ejecucionId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" "PasoEjecucionEstado" NOT NULL,
    "duracionMs" INTEGER,
    "selfHealed" BOOLEAN NOT NULL DEFAULT false,
    "errorMsg" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasoEjecucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artefacto" (
    "id" TEXT NOT NULL,
    "ejecucionId" TEXT NOT NULL,
    "tipo" "ArtefactoTipo" NOT NULL,
    "path" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artefacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acta" (
    "id" TEXT NOT NULL,
    "ejecucionId" TEXT NOT NULL,
    "consecutivo" TEXT NOT NULL,
    "rutaPdf" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Acta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credencial" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" BYTEA NOT NULL,
    "sesionVenceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Credencial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsecutivoAnual" (
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL,

    CONSTRAINT "ConsecutivoAnual_pkey" PRIMARY KEY ("anio")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_email_idx" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "UsuarioEspacio_espacioId_idx" ON "UsuarioEspacio"("espacioId");

-- CreateIndex
CREATE INDEX "Proyecto_espacioId_idx" ON "Proyecto"("espacioId");

-- CreateIndex
CREATE INDEX "CasoPrueba_responsableId_idx" ON "CasoPrueba"("responsableId");

-- CreateIndex
CREATE INDEX "CasoPrueba_proyectoId_idx" ON "CasoPrueba"("proyectoId");

-- CreateIndex
CREATE UNIQUE INDEX "CasoPrueba_proyectoId_codigo_key" ON "CasoPrueba"("proyectoId", "codigo");

-- CreateIndex
CREATE INDEX "Ejecucion_casoPruebaId_idx" ON "Ejecucion"("casoPruebaId");

-- CreateIndex
CREATE INDEX "Ejecucion_estado_idx" ON "Ejecucion"("estado");

-- CreateIndex
CREATE INDEX "PasoEjecucion_ejecucionId_idx" ON "PasoEjecucion"("ejecucionId");

-- CreateIndex
CREATE UNIQUE INDEX "PasoEjecucion_ejecucionId_numero_key" ON "PasoEjecucion"("ejecucionId", "numero");

-- CreateIndex
CREATE INDEX "Artefacto_ejecucionId_idx" ON "Artefacto"("ejecucionId");

-- CreateIndex
CREATE INDEX "Artefacto_tipo_idx" ON "Artefacto"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Acta_ejecucionId_key" ON "Acta"("ejecucionId");

-- CreateIndex
CREATE UNIQUE INDEX "Acta_consecutivo_key" ON "Acta"("consecutivo");

-- CreateIndex
CREATE INDEX "Credencial_proyectoId_idx" ON "Credencial"("proyectoId");

-- AddForeignKey
ALTER TABLE "UsuarioEspacio" ADD CONSTRAINT "UsuarioEspacio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioEspacio" ADD CONSTRAINT "UsuarioEspacio_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "Espacio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proyecto" ADD CONSTRAINT "Proyecto_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "Espacio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoPrueba" ADD CONSTRAINT "CasoPrueba_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoPrueba" ADD CONSTRAINT "CasoPrueba_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ejecucion" ADD CONSTRAINT "Ejecucion_casoPruebaId_fkey" FOREIGN KEY ("casoPruebaId") REFERENCES "CasoPrueba"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasoEjecucion" ADD CONSTRAINT "PasoEjecucion_ejecucionId_fkey" FOREIGN KEY ("ejecucionId") REFERENCES "Ejecucion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artefacto" ADD CONSTRAINT "Artefacto_ejecucionId_fkey" FOREIGN KEY ("ejecucionId") REFERENCES "Ejecucion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acta" ADD CONSTRAINT "Acta_ejecucionId_fkey" FOREIGN KEY ("ejecucionId") REFERENCES "Ejecucion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credencial" ADD CONSTRAINT "Credencial_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
