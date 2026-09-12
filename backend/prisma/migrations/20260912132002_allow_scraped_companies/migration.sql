/*
  Warnings:

  - A unique constraint covering the columns `[sourceKey]` on the table `Company` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_ownerId_fkey";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "sourceKey" TEXT,
ALTER COLUMN "ownerId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Company_sourceKey_key" ON "Company"("sourceKey");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
