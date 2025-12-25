import { Request, Response } from "express";
import { uploadToS3, buildLocalUrl, buildUploadKey } from "../config/storage";
import path from "path";

export async function uploadImage(req: Request, res: Response) {
  const file = (req as any).file as Express.Multer.File | undefined;

  if (!file) return res.status(400).json({ message: "No file uploaded" });

  const origin = process.env.APP_ORIGIN || `${req.protocol}://${req.get("host") || "localhost"}`;
  const filename = file.filename;

  const useS3 =
    process.env.S3_BUCKET &&
    process.env.S3_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY;

  try {
    if (useS3) {
      const key = buildUploadKey(filename);
      const s3Result = await uploadToS3({
        localPath: path.resolve(file.destination, file.filename),
        key,
        contentType: file.mimetype,
      });
      return res.json({ url: s3Result.url, absoluteUrl: s3Result.url, storage: "s3" });
    }

    const { relative, absolute } = buildLocalUrl(filename, origin);
    res.json({ url: relative, absoluteUrl: absolute, storage: "local" });
  } catch (err: any) {
    console.error("Upload failed", err);
    res.status(500).json({ message: "Upload failed", detail: err?.message });
  }
}
