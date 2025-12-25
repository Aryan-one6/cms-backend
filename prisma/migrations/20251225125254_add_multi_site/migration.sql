-- DropForeignKey
ALTER TABLE "SiteDomain" DROP CONSTRAINT "SiteDomain_siteId_fkey";

-- AlterTable
ALTER TABLE "SiteDomain" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "SiteDomain" ADD CONSTRAINT "SiteDomain_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
