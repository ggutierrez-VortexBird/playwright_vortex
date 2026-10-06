-- ACTA-Plan-Pivot-Playwright-Codegen (V2).
--
-- SesionGrabacion ahora persiste el .spec.ts crudo que escribe `npx
-- playwright codegen` como single source of truth, en vez de derivar
-- pasos granulares con nuestro serializador custom.  Las nuevas columnas:
--
-- * specCode (TEXT, nullable): contenido completo del .spec.ts tal cual
--   lo emitió codegen — política ZERO modificación.
-- * codegenFilePath (TEXT, nullable): path absoluto al archivo en OS
--   tempdir para debug/replay.
--
-- Ambos nullable porque las sesiones legacy del V1 (HU-G21) no los tienen,
-- y porque una sesión recién creada todavía no tiene código persistido
-- hasta que el QA empiece a grabar.

-- AlterTable
ALTER TABLE "SesionGrabacion" ADD COLUMN "specCode" TEXT;
ALTER TABLE "SesionGrabacion" ADD COLUMN "codegenFilePath" TEXT;
