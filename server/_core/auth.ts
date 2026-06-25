import { COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";
import { randomBytes } from "crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { sendPasswordResetEmail, sendWelcomeEmail, sendInviteEmail } from "./email";
import { getSessionCookieOptions } from "./cookies";
import { hashPassword, signSession, verifyPassword } from "./sdk";

function json400(res: Response, message: string) {
  res.status(400).json({ error: message });
}

export function registerAuthRoutes(app: Express) {
  // ─── Register ─────────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { email, password, name, tenantSlug } = req.body ?? {};
    if (typeof email !== "string" || !email.includes("@")) return json400(res, "Valid email required");
    if (typeof password !== "string" || password.length < 8) return json400(res, "Password must be at least 8 characters");

    const existing = await db.getUserByEmail(email.toLowerCase());
    if (existing) return json400(res, "Email already registered");

    // Self-registration via tenant slug
    let linkTenantId: number | null = null;
    let linkTenantRole: "owner" | "admin" | "developer" | "viewer" = "developer";
    if (typeof tenantSlug === "string" && tenantSlug) {
      const tenant = await db.getTenantBySlug(tenantSlug);
      if (!tenant) return json400(res, "Organisation not found");
      if (!tenant.allowSelfRegistration) return json400(res, "This organisation does not allow self-registration. Request an invite from your admin.");

      // Domain check
      const domains: string[] = Array.isArray(tenant.allowedEmailDomains) ? tenant.allowedEmailDomains as string[] : [];
      if (domains.length > 0) {
        const emailDomain = email.toLowerCase().split("@")[1];
        if (!domains.includes(emailDomain)) {
          return json400(res, `Self-registration is restricted to: ${domains.join(", ")}`);
        }
      }
      linkTenantId = tenant.id;
      linkTenantRole = (tenant.selfRegDefaultRole ?? "developer") as typeof linkTenantRole;
    }

    const passwordHash = await hashPassword(password);
    const userId = await db.createUser({ email: email.toLowerCase(), name: name ?? null, passwordHash });
    if (!userId) { res.status(500).json({ error: "Failed to create user" }); return; }

    if (linkTenantId) {
      await db.updateUser(userId, { tenantId: linkTenantId, tenantRole: linkTenantRole });
    }

    const user = await db.getUserById(userId);
    if (!user) { res.status(500).json({ error: "Failed to fetch created user" }); return; }

    const sessionToken = await signSession({ userId: user.id, email: user.email, name: user.name ?? "" }, { expiresInMs: SESSION_DURATION_MS });
    res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: SESSION_DURATION_MS });
    res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });

    sendWelcomeEmail(user.email, user.name ?? "").catch(() => {});
  });

  // ─── Login ────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") return json400(res, "Email and password required");

    const user = await db.getUserByEmail(email.toLowerCase());
    if (!user || !user.passwordHash) return json400(res, "Invalid email or password");

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return json400(res, "Invalid email or password");

    const token = await signSession({ userId: user.id, email: user.email, name: user.name ?? "" }, { expiresInMs: SESSION_DURATION_MS });
    res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: SESSION_DURATION_MS });
    res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });

  // ─── Forgot / Reset Password ──────────────────────────────────────────────
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    const { email } = req.body ?? {};
    if (typeof email !== "string" || !email.includes("@")) return json400(res, "Valid email required");

    const user = await db.getUserByEmail(email.toLowerCase());
    if (!user) { res.json({ success: true }); return; }

    const resetToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.setResetToken(user.email, resetToken, expiresAt);

    const baseUrl = process.env.APP_URL ?? `${req.protocol}://${req.get("host")}`;
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    sendPasswordResetEmail(user.email, resetUrl).catch(() => {});

    res.json({ success: true });
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    const { token, password } = req.body ?? {};
    if (typeof token !== "string" || typeof password !== "string" || password.length < 8) {
      return json400(res, "Token and password (min 8 chars) required");
    }

    const user = await db.getUserByResetToken(token);
    if (!user || !user.resetTokenExpiresAt) return json400(res, "Invalid or expired reset link");
    if (new Date() > user.resetTokenExpiresAt) return json400(res, "Reset link has expired — request a new one");

    const passwordHash = await hashPassword(password);
    await db.updateUser(user.id, { passwordHash });
    await db.clearResetToken(user.id);

    res.json({ success: true });
  });

  // ─── Invite: fetch metadata (public — for landing page) ───────────────────
  app.get("/api/auth/invite/:token", async (req: Request, res: Response) => {
    const invite = await db.getInviteByToken(req.params.token);
    if (!invite) { res.status(404).json({ error: "Invite not found or expired" }); return; }
    if (invite.usedAt) { res.status(410).json({ error: "This invite has already been used" }); return; }
    if (new Date() > invite.expiresAt) { res.status(410).json({ error: "This invite has expired. Request a new one." }); return; }

    const tenant = await db.getTenantById(invite.tenantId);
    res.json({
      email: invite.email,
      tenantRole: invite.tenantRole,
      tenantName: tenant?.name ?? "Unknown",
      tenantId: invite.tenantId,
    });
  });

  // ─── Accept invite ────────────────────────────────────────────────────────
  app.post("/api/auth/accept-invite", async (req: Request, res: Response) => {
    const { token, password, name } = req.body ?? {};
    if (typeof token !== "string") return json400(res, "Token required");

    const invite = await db.getInviteByToken(token);
    if (!invite) return json400(res, "Invalid invite token");
    if (invite.usedAt) return json400(res, "This invite has already been used");
    if (new Date() > invite.expiresAt) return json400(res, "This invite has expired. Request a new one.");

    let user = await db.getUserByEmail(invite.email.toLowerCase());

    if (!user) {
      // New user — register them
      if (typeof password !== "string" || password.length < 8) return json400(res, "Password must be at least 8 characters");
      const passwordHash = await hashPassword(password);
      const userId = await db.createUser({ email: invite.email.toLowerCase(), name: name ?? null, passwordHash });
      if (!userId) { res.status(500).json({ error: "Failed to create user" }); return; }
      user = await db.getUserById(userId);
      if (!user) { res.status(500).json({ error: "Failed to fetch created user" }); return; }
    } else if (user.tenantId && user.tenantId !== invite.tenantId) {
      return json400(res, "Your account is already linked to a different organisation.");
    }

    // Link user to tenant with the invited role
    await db.updateUser(user.id, {
      tenantId: invite.tenantId,
      tenantRole: invite.tenantRole,
    });
    await db.markInviteUsed(token, user.id);

    const sessionToken = await signSession({ userId: user.id, email: user.email, name: user.name ?? "" }, { expiresInMs: SESSION_DURATION_MS });
    res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: SESSION_DURATION_MS });
    res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });

    sendWelcomeEmail(user.email, user.name ?? "").catch(() => {});
  });
}
