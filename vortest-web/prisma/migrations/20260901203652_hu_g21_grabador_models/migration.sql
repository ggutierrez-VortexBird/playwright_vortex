-- CreateEnum
CREATE TYPE "CasoOrigen" AS ENUM ('subirScript', 'grabador', 'mixto');

-- AlterTable
ALTER TABLE "CasoPrueba" ADD COLUMN     "origen" "CasoOrigen" NOT NULL DEFAULT 'subirScript';

-- AlterTable
ALTER TABLE "Ejecucion" ADD COLUMN     "loteId" TEXT;

-- AlterTable
ALTER TABLE "PasoEjecucion" ADD COLUMN     "videoFinMs" INTEGER,
ADD COLUMN     "videoInicioMs" INTEGER;

-- CreateTable
CREATE TABLE "SesionGrabacion" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "casoPruebaId" TEXT,
    "nombre" TEXT NOT NULL,
    "urlInicial" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL,
    "navegador" TEXT NOT NULL DEFAULT 'chromium',
    "credencialId" TEXT,
    "storageState" JSONB,
    "token" TEXT,
    "tokenUsado" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT NOT NULL,
    "mensajeError" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SesionGrabacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasoGrabado" (
    "id" TEXT NOT NULL,
    "sesionId" TEXT NOT NULL,
    "casoPruebaId" TEXT,
    "numero" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "origen" TEXT NOT NULL DEFAULT 'grabado',
    "descripcion" TEXT NOT NULL,
    "selectorPrincipal" JSONB NOT NULL,
    "selectoresRespaldo" JSONB NOT NULL,
    "valor" TEXT,
    "esValorSensible" BOOLEAN NOT NULL DEFAULT false,
    "assertionKind" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasoGrabado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametroGrabacion" (
    "id" TEXT NOT NULL,
    "sesionId" TEXT,
    "casoPruebaId" TEXT,
    "nombre" TEXT NOT NULL,
    "valorDefecto" TEXT,
    "origen" TEXT NOT NULL,
    "credencialId" TEXT,
    "enUso" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParametroGrabacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuegoDeDatos" (
    "id" TEXT NOT NULL,
    "casoPruebaId" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "filas" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JuegoDeDatos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SesionGrabacion_proyectoId_idx" ON "SesionGrabacion"("proyectoId");

-- CreateIndex
CREATE INDEX "SesionGrabacion_usuarioId_idx" ON "SesionGrabacion"("usuarioId");

-- CreateIndex
CREATE INDEX "SesionGrabacion_estado_idx" ON "SesionGrabacion"("estado");

-- CreateIndex
CREATE INDEX "SesionGrabacion_casoPruebaId_idx" ON "SesionGrabacion"("casoPruebaId");

-- CreateIndex
CREATE INDEX "PasoGrabado_sesionId_idx" ON "PasoGrabado"("sesionId");

-- CreateIndex
CREATE INDEX "PasoGrabado_casoPruebaId_idx" ON "PasoGrabado"("casoPruebaId");

-- CreateIndex
CREATE UNIQUE INDEX "PasoGrabado_sesionId_numero_key" ON "PasoGrabado"("sesionId", "numero");

-- CreateIndex
CREATE INDEX "ParametroGrabacion_casoPruebaId_idx" ON "ParametroGrabacion"("casoPruebaId");

-- CreateIndex
CREATE UNIQUE INDEX "ParametroGrabacion_sesionId_nombre_key" ON "ParametroGrabacion"("sesionId", "nombre");

-- CreateIndex
CREATE INDEX "JuegoDeDatos_casoPruebaId_idx" ON "JuegoDeDatos"("casoPruebaId");

-- CreateIndex
CREATE INDEX "CasoPrueba_origen_idx" ON "CasoPrueba"("origen");

-- CreateIndex
CREATE INDEX "Ejecucion_loteId_idx" ON "Ejecucion"("loteId");

-- AddForeignKey
ALTER TABLE "SesionGrabacion" ADD CONSTRAINT "SesionGrabacion_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionGrabacion" ADD CONSTRAINT "SesionGrabacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionGrabacion" ADD CONSTRAINT "SesionGrabacion_casoPruebaId_fkey" FOREIGN KEY ("casoPruebaId") REFERENCES "CasoPrueba"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionGrabacion" ADD CONSTRAINT "SesionGrabacion_credencialId_fkey" FOREIGN KEY ("credencialId") REFERENCES "Credencial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasoGrabado" ADD CONSTRAINT "PasoGrabado_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "SesionGrabacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasoGrabado" ADD CONSTRAINT "PasoGrabado_casoPruebaId_fkey" FOREIGN KEY ("casoPruebaId") REFERENCES "CasoPrueba"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParametroGrabacion" ADD CONSTRAINT "ParametroGrabacion_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "SesionGrabacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParametroGrabacion" ADD CONSTRAINT "ParametroGrabacion_casoPruebaId_fkey" FOREIGN KEY ("casoPruebaId") REFERENCES "CasoPrueba"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuegoDeDatos" ADD CONSTRAINT "JuegoDeDatos_casoPruebaId_fkey" FOREIGN KEY ("casoPruebaId") REFERENCES "CasoPrueba"("id") ON DELETE CASCADE ON UPDATE CASCADE;
