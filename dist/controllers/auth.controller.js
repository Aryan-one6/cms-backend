"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.me = me;
exports.logout = logout;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma_1 = require("../config/prisma");
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
async function login(req, res) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    const { email, password } = parsed.data;
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        return res.status(500).json({ message: "JWT secret is not configured" });
    }
    const expiresIn = process.env.JWT_EXPIRES_IN ?? "7d";
    const admin = await prisma_1.prisma.adminUser.findUnique({ where: { email } });
    if (!admin)
        return res.status(401).json({ message: "Invalid credentials" });
    const ok = await bcrypt_1.default.compare(password, admin.passwordHash);
    if (!ok)
        return res.status(401).json({ message: "Invalid credentials" });
    const token = jsonwebtoken_1.default.sign({ adminId: admin.id, role: admin.role }, jwtSecret, { expiresIn });
    // cookie-based auth (best for admin panel)
    res.cookie("accessToken", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.json({
        admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    });
}
async function me(req, res) {
    const auth = req.auth;
    const admin = await prisma_1.prisma.adminUser.findUnique({
        where: { id: auth.adminId },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    return res.json({ admin });
}
async function logout(_req, res) {
    res.clearCookie("accessToken");
    return res.json({ ok: true });
}
