import nodemailer from "nodemailer";

// Basic transport using SMTP. Configure via env.
export function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_PORT) {
    throw new Error("SMTP is not configured");
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === "true",
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

export async function sendMail(opts: { to: string; subject: string; html: string }) {
  const transport = createTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM || "no-reply@sapphirecms.local",
    ...opts,
  });
}
