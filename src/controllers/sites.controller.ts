import { Request, Response } from "express";
import { z } from "zod";
import slugify from "slugify";
import crypto from "crypto";
import { prisma } from "../config/prisma";
import { JwtPayload } from "../middlewares/auth";
import { SiteContext } from "../middlewares/site";
import { ApiTokenRole, Prisma, SiteRole } from "@prisma/client";
import dns from "dns/promises";

const createSiteSchema = z.object({
  name: z.string().min(2),
  domains: z.array(z.string()).optional(),
  defaultLocale: z.string().optional(),
  settingsJson: z.record(z.string(), z.any()).optional(),
});

const createTokenSchema = z.object({
  name: z.string().min(2),
  role: z.nativeEnum(ApiTokenRole).optional().default(ApiTokenRole.READ_ONLY),
  expiresAt: z.string().optional(),
});

const addDomainSchema = z.object({
  domain: z.string().min(3),
});

async function ensureUniqueSiteSlug(base: string) {
  let slug = slugify(base, { lower: true, strict: true });
  let i = 1;

  while (true) {
    const exists = await prisma.site.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${slugify(base, { lower: true, strict: true })}-${i++}`;
  }
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generatePlainToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function listSites(req: Request, res: Response) {
  const auth = (req as any).auth as JwtPayload;

  const memberships = await prisma.adminSiteMembership.findMany({
    where: { adminId: auth.adminId },
    include: { site: { include: { siteDomains: true } } },
  });

  const memberSites = memberships.map((m) => ({
    ...m.site,
    siteDomains: m.site.siteDomains,
    membershipRole: m.role,
  }));

  if (auth.role === "SUPER_ADMIN") {
    const allSites = await prisma.site.findMany({ include: { siteDomains: true } });
    const merged = new Map<string, any>();
    for (const site of [
      ...memberSites,
      ...allSites.map((s) => ({ ...s, membershipRole: SiteRole.OWNER })),
    ]) {
      merged.set(site.id, site);
    }
    return res.json({ sites: Array.from(merged.values()) });
  }

  return res.json({ sites: memberSites });
}

export async function createSite(req: Request, res: Response) {
  const auth = (req as any).auth as JwtPayload;
  const parsed = createSiteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const slug = await ensureUniqueSiteSlug(parsed.data.name);
  const site = await prisma.site.create({
    data: {
      name: parsed.data.name,
      slug,
      domains: parsed.data.domains ?? [],
      defaultLocale: parsed.data.defaultLocale,
      settingsJson:
        parsed.data.settingsJson === undefined ? undefined : (parsed.data.settingsJson as Prisma.InputJsonValue),
    },
  });

  await prisma.adminSiteMembership.create({
    data: { adminId: auth.adminId, siteId: site.id, role: SiteRole.OWNER },
  });

  res.status(201).json({ site: { ...site, membershipRole: SiteRole.OWNER } });
}

export async function listTokens(req: Request, res: Response) {
  const auth = (req as any).auth as JwtPayload;
  const site = (req as any).site as SiteContext | undefined;
  if (!site) return res.status(400).json({ message: "Site context missing" });

  if (auth.role !== "SUPER_ADMIN" && site.membershipRole !== SiteRole.OWNER) {
    return res.status(403).json({ message: "Only owners can view tokens" });
  }

  const tokens = await prisma.apiToken.findMany({
    where: { siteId: site.siteId },
    select: {
      id: true,
      name: true,
      role: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ tokens });
}

export async function createToken(req: Request, res: Response) {
  const auth = (req as any).auth as JwtPayload;
  const site = (req as any).site as SiteContext | undefined;
  if (!site) return res.status(400).json({ message: "Site context missing" });

  if (auth.role !== "SUPER_ADMIN" && site.membershipRole !== SiteRole.OWNER) {
    return res.status(403).json({ message: "Only owners can create tokens" });
  }

  const parsed = createTokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const plain = generatePlainToken();
  const hashed = hashToken(plain);

  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;

  const token = await prisma.apiToken.create({
    data: {
      siteId: site.siteId,
      name: parsed.data.name,
      role: parsed.data.role ?? ApiTokenRole.READ_ONLY,
      expiresAt,
      hashed,
    },
    select: {
      id: true,
      name: true,
      role: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  res.status(201).json({ token, plainToken: plain });
}

export async function deleteToken(req: Request, res: Response) {
  const auth = (req as any).auth as JwtPayload;
  const site = (req as any).site as SiteContext | undefined;
  if (!site) return res.status(400).json({ message: "Site context missing" });

  if (auth.role !== "SUPER_ADMIN" && site.membershipRole !== SiteRole.OWNER) {
    return res.status(403).json({ message: "Only owners can delete tokens" });
  }

  const token = await prisma.apiToken.findUnique({ where: { id: req.params.tokenId } });
  if (!token || token.siteId !== site.siteId) return res.status(404).json({ message: "Not found" });

  await prisma.apiToken.delete({ where: { id: token.id } });
  res.json({ ok: true });
}

function normalizeDomain(domain: string) {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

function generateDomainToken() {
  return crypto.randomBytes(16).toString("hex");
}

export async function listDomains(req: Request, res: Response) {
  const site = (req as any).site as SiteContext | undefined;
  if (!site) return res.status(400).json({ message: "Site context missing" });

  const domains = await prisma.siteDomain.findMany({
    where: { siteId: site.siteId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ domains });
}

export async function addDomain(req: Request, res: Response) {
  const auth = (req as any).auth as JwtPayload;
  const site = (req as any).site as SiteContext | undefined;
  if (!site) return res.status(400).json({ message: "Site context missing" });
  if (auth.role !== "SUPER_ADMIN" && site.membershipRole !== SiteRole.OWNER) {
    return res.status(403).json({ message: "Only owners can manage domains" });
  }

  const parsed = addDomainSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const domain = normalizeDomain(parsed.data.domain);
  const token = generateDomainToken();

  const record = await prisma.siteDomain.upsert({
    where: { siteId_domain: { siteId: site.siteId, domain } },
    update: { verificationToken: token, status: "PENDING" },
    create: {
      siteId: site.siteId,
      domain,
      verificationToken: token,
      status: "PENDING",
    },
  });

  // keep domains array in sync for backwards compatibility
  await prisma.site.update({
    where: { id: site.siteId },
    data: {
      domains: {
        push: domain,
      },
    },
  }).catch(() => {
    /* ignore array sync errors */
  });

  res.status(201).json({ domain: record });
}

export async function refreshDomainToken(req: Request, res: Response) {
  const auth = (req as any).auth as JwtPayload;
  const site = (req as any).site as SiteContext | undefined;
  if (!site) return res.status(400).json({ message: "Site context missing" });
  if (auth.role !== "SUPER_ADMIN" && site.membershipRole !== SiteRole.OWNER) {
    return res.status(403).json({ message: "Only owners can manage domains" });
  }

  const domain = await prisma.siteDomain.findUnique({ where: { id: req.params.domainId } });
  if (!domain || domain.siteId !== site.siteId) return res.status(404).json({ message: "Not found" });

  const updated = await prisma.siteDomain.update({
    where: { id: domain.id },
    data: { verificationToken: generateDomainToken(), status: "PENDING", verifiedAt: null },
  });

  res.json({ domain: updated });
}

export async function verifyDomain(req: Request, res: Response) {
  const auth = (req as any).auth as JwtPayload;
  const site = (req as any).site as SiteContext | undefined;
  if (!site) return res.status(400).json({ message: "Site context missing" });
  if (auth.role !== "SUPER_ADMIN" && site.membershipRole !== SiteRole.OWNER) {
    return res.status(403).json({ message: "Only owners can verify domains" });
  }

  const domain = await prisma.siteDomain.findUnique({ where: { id: req.params.domainId } });
  if (!domain || domain.siteId !== site.siteId) return res.status(404).json({ message: "Not found" });

  // DNS TXT check: sapphire-site-verification=<token>
  try {
    const txtRecords = await dns.resolveTxt(domain.domain);
    const flat = txtRecords.flat().map((t) => t.toString());
    const match = flat.some((entry) => entry.includes(domain.verificationToken));

    if (!match) {
      await prisma.siteDomain.update({
        where: { id: domain.id },
        data: { status: "FAILED" },
      });
      return res.status(400).json({
        message: "Verification token not found in DNS TXT records",
        expected: `TXT sapphire-site-verification=${domain.verificationToken}`,
      });
    }
  } catch (err: any) {
    await prisma.siteDomain.update({
      where: { id: domain.id },
      data: { status: "FAILED" },
    });
    return res.status(400).json({ message: "DNS lookup failed", detail: err?.message });
  }

  const updated = await prisma.siteDomain.update({
    where: { id: domain.id },
    data: { status: "VERIFIED", verifiedAt: new Date() },
  });

  res.json({ domain: updated });
}
