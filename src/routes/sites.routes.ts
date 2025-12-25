import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireSiteAccess } from "../middlewares/site";
import {
  createSite,
  createToken,
  deleteToken,
  listSites,
  listTokens,
  addDomain,
  listDomains,
  verifyDomain,
  refreshDomainToken,
} from "../controllers/sites.controller";

export const sitesRouter = Router();

sitesRouter.get("/admin/sites", requireAuth, listSites);
sitesRouter.post("/admin/sites", requireAuth, createSite);
sitesRouter.get("/admin/sites/:id/tokens", requireAuth, requireSiteAccess, listTokens);
sitesRouter.post("/admin/sites/:id/tokens", requireAuth, requireSiteAccess, createToken);
sitesRouter.delete(
  "/admin/sites/:siteId/tokens/:tokenId",
  requireAuth,
  requireSiteAccess,
  deleteToken
);

sitesRouter.get("/admin/sites/:id/domains", requireAuth, requireSiteAccess, listDomains);
sitesRouter.post("/admin/sites/:id/domains", requireAuth, requireSiteAccess, addDomain);
sitesRouter.post(
  "/admin/sites/:id/domains/:domainId/verify",
  requireAuth,
  requireSiteAccess,
  verifyDomain
);
sitesRouter.post(
  "/admin/sites/:id/domains/:domainId/refresh-token",
  requireAuth,
  requireSiteAccess,
  refreshDomainToken
);
