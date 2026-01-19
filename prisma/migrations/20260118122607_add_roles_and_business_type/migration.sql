-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('RETAIL', 'RESTAURANT', 'SALON', 'PHARMACY', 'GROCERY', 'ELECTRONICS', 'CLOTHING', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'MANAGER';
ALTER TYPE "Role" ADD VALUE 'OWNER';

-- AlterTable
ALTER TABLE "tenant_applications" ADD COLUMN     "businessType" "BusinessType" NOT NULL DEFAULT 'RETAIL';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "businessType" "BusinessType" NOT NULL DEFAULT 'RETAIL';
