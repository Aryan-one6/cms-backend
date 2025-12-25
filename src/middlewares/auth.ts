import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type JwtPayload = {
  adminId: string;
  role: "SUPER_ADMIN" | "EDITOR";
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token =
    req.cookies?.accessToken ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    (req as any).auth = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
