-- 1) Enums for site + tokens
DO $$ BEGIN
  CREATE TYPE "SiteRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ApiTokenRole" AS ENUM ('READ_ONLY', 'READ_WRITE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2) Create Site table if missing
CREATE TABLE IF NOT EXISTS "Site" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "defaultLocale" TEXT,
  "settingsJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Site_slug_key" ON "Site"("slug");

-- 3) Add columns as nullable so we can backfill
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "siteId" TEXT;
ALTER TABLE "Tag" ADD COLUMN IF NOT EXISTS "siteId" TEXT;

-- 4) Create Site/Membership/ApiToken tables
CREATE TABLE IF NOT EXISTS "AdminSiteMembership" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "role" "SiteRole" NOT NULL DEFAULT 'EDITOR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSiteMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApiToken" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "hashed" TEXT NOT NULL,
  "role" "ApiTokenRole" NOT NULL DEFAULT 'READ_ONLY',
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- 5) Create a default site and backfill existing data
INSERT INTO "Site" ("id","name","slug","domains","createdAt","updatedAt")
VALUES ('default-site','Default Site','default-site',ARRAY[]::TEXT[], now(), now())
ON CONFLICT ("slug") DO NOTHING;

UPDATE "BlogPost" SET "siteId" = 'default-site' WHERE "siteId" IS NULL;
UPDATE "Tag" SET "siteId" = 'default-site' WHERE "siteId" IS NULL;

-- 6) Enforce NOT NULL and add constraints/uniques
ALTER TABLE "BlogPost" ALTER COLUMN "siteId" SET NOT NULL;
ALTER TABLE "Tag" ALTER COLUMN "siteId" SET NOT NULL;

-- unique scopes
ALTER TABLE "BlogPost" DROP CONSTRAINT IF EXISTS "BlogPost_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "BlogPost_siteId_slug_key" ON "BlogPost"("siteId","slug");

ALTER TABLE "Tag" DROP CONSTRAINT IF EXISTS "Tag_slug_key";
ALTER TABLE "Tag" DROP CONSTRAINT IF EXISTS "Tag_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_siteId_slug_key" ON "Tag"("siteId","slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_siteId_name_key" ON "Tag"("siteId","name");

-- FKs
ALTER TABLE "BlogPost" DROP CONSTRAINT IF EXISTS "BlogPost_siteId_fkey";
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tag" DROP CONSTRAINT IF EXISTS "Tag_siteId_fkey";
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminSiteMembership" DROP CONSTRAINT IF EXISTS "AdminSiteMembership_adminId_fkey";
ALTER TABLE "AdminSiteMembership" ADD CONSTRAINT "AdminSiteMembership_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminSiteMembership" DROP CONSTRAINT IF EXISTS "AdminSiteMembership_siteId_fkey";
ALTER TABLE "AdminSiteMembership" ADD CONSTRAINT "AdminSiteMembership_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "AdminSiteMembership_adminId_siteId_key" ON "AdminSiteMembership"("adminId","siteId");

ALTER TABLE "ApiToken" DROP CONSTRAINT IF EXISTS "ApiToken_siteId_fkey";
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain verification table
DO $$ BEGIN
  CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "SiteDomain" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "verificationToken" TEXT NOT NULL,
  "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SiteDomain_siteId_domain_key" ON "SiteDomain"("siteId","domain");

ALTER TABLE "SiteDomain" DROP CONSTRAINT IF EXISTS "SiteDomain_siteId_fkey";
ALTER TABLE "SiteDomain" ADD CONSTRAINT "SiteDomain_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
