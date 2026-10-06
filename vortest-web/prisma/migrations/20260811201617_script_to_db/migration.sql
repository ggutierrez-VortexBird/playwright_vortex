/*
  Warnings:

  - You are about to drop the column `rutaScript` on the `CasoPrueba` table. All the data in the column will be lost.
  - Added the required column `script` to the `CasoPrueba` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CasoPrueba" DROP COLUMN "rutaScript",
ADD COLUMN     "script" TEXT NOT NULL,
ADD COLUMN     "scriptFileName" TEXT;
