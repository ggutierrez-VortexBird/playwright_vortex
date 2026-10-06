-- CreateIntentoLogin
CREATE TABLE "IntentoLogin" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "clave" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 1,
    "ventanaAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

ALTER TABLE "IntentoLogin" ADD CONSTRAINT "IntentoLogin_pkey" PRIMARY KEY ("id");
ALTER TABLE "IntentoLogin" ADD CONSTRAINT "IntentoLogin_clave_key" UNIQUE ("clave");

CREATE INDEX "IntentoLogin_ventanaAt_idx" ON "IntentoLogin"("ventanaAt");
