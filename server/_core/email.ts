import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) {
    // Dev: log emails to console instead of sending
    return nodemailer.createTransport({ jsonTransport: true });
  }
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

const FROM = process.env.EMAIL_FROM ?? "CloudInfinit API Gateway <no-reply@cloudinfinit.io>";

async function send(to: string, subject: string, html: string) {
  const transport = createTransport();
  const info = await transport.sendMail({ from: FROM, to, subject, html });
  if (!process.env.SMTP_HOST) {
    const msg = (info as any).message ? JSON.parse((info as any).message) : info;
    console.log(`[email:dev] To: ${to} | Subject: ${subject}`);
    console.log(`[email:dev] Preview: ${msg?.text ?? html.replace(/<[^>]+>/g, "").slice(0, 120)}`);
  }
}

export async function sendWelcomeEmail(to: string, name: string) {
  await send(to, "Welcome to CloudInfinit API Gateway", `
    <h2>Welcome${name ? `, ${name}` : ""}!</h2>
    <p>Your account on the CloudInfinit API Gateway platform has been created.</p>
    <p>Next step: sign in and create your organisation to start managing APIs.</p>
    <p style="color:#888;font-size:12px">If you didn't register, you can ignore this email.</p>
  `);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await send(to, "Reset your password — CloudInfinit API Gateway", `
    <h2>Password Reset</h2>
    <p>Click the link below to reset your password. This link expires in 1 hour.</p>
    <p><a href="${resetUrl}" style="background:#f59e0b;color:white;padding:10px 20px;text-decoration:none;border-radius:6px">Reset Password</a></p>
    <p style="color:#888;font-size:12px">If you didn't request a reset, ignore this email. The link expires automatically.</p>
  `);
}

export async function sendInviteEmail(to: string, tenantName: string, inviteUrl: string, role: string) {
  await send(to, `You've been invited to ${tenantName} on CloudInfinit API Gateway`, `
    <h2>You're invited!</h2>
    <p>You've been invited to join <strong>${tenantName}</strong> on CloudInfinit API Gateway as a <strong>${role}</strong>.</p>
    <p><a href="${inviteUrl}" style="background:#f59e0b;color:white;padding:10px 20px;text-decoration:none;border-radius:6px">Accept Invitation</a></p>
    <p style="color:#888;font-size:12px">This invite expires in 48 hours. If you didn't expect this, you can ignore it.</p>
  `);
}

export async function sendInvoiceEmail(to: string, invoiceNumber: string, amount: string, dueDate: string) {
  await send(to, `Invoice ${invoiceNumber} from CloudInfinit API Gateway`, `
    <h2>Invoice ${invoiceNumber}</h2>
    <p>Amount due: <strong>${amount}</strong></p>
    <p>Due date: ${dueDate}</p>
    <p>Sign in to your portal to view and pay this invoice.</p>
  `);
}
