-- AlterTable
ALTER TABLE "mini_apps" ADD COLUMN     "apiAllowlist" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "mini_app_endpoints" (
    "id" TEXT NOT NULL,
    "miniAppId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "url" TEXT NOT NULL,
    "headers" JSONB NOT NULL DEFAULT '{}',
    "bodyTemplate" JSONB,
    "responseMap" JSONB NOT NULL DEFAULT '{}',
    "timeoutMs" INTEGER NOT NULL DEFAULT 8000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mini_app_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mini_app_endpoints_miniAppId_name_key" ON "mini_app_endpoints"("miniAppId", "name");

-- AddForeignKey
ALTER TABLE "mini_app_endpoints" ADD CONSTRAINT "mini_app_endpoints_miniAppId_fkey" FOREIGN KEY ("miniAppId") REFERENCES "mini_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
