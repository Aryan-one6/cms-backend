-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "resetExpires" TIMESTAMP(3),
ADD COLUMN     "resetToken" TEXT;
