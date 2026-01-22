-- CreateEnum
CREATE TYPE "SecurityRequestType" AS ENUM ('VOID', 'REVIEW');

-- CreateEnum
CREATE TYPE "SecurityRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "customCategory" TEXT,
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ALTER COLUMN "costPrice" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "security_requests" (
    "id" TEXT NOT NULL,
    "type" "SecurityRequestType" NOT NULL,
    "status" "SecurityRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "saleId" TEXT,
    "itemName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requesterId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_requests_tenantId_status_idx" ON "security_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "security_requests_requesterId_idx" ON "security_requests"("requesterId");

-- AddForeignKey
ALTER TABLE "security_requests" ADD CONSTRAINT "security_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_requests" ADD CONSTRAINT "security_requests_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_requests" ADD CONSTRAINT "security_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_requests" ADD CONSTRAINT "security_requests_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
