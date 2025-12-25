import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireSiteAccess } from "../middlewares/site";
import { upload } from "../middlewares/upload";
import { uploadImage } from "../controllers/upload.controller";

export const uploadRouter = Router();

uploadRouter.post("/admin/upload", requireAuth, requireSiteAccess, upload.single("file"), uploadImage);
