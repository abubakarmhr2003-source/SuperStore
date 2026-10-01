import nodemailer from "nodemailer";
import { row } from "./db";

function getTransport() {
  if (!global._gsMailTransport) {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) return null; // email not configured — skip silently
    global._gsMailTransport = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return global._gsMailTransport;
}

// Sends a "new TEAM MEMBER signup request" notification to whichever email
// address that shop's owner/admin configured in Settings (falls back to
// GMAIL_USER if none set). This is scoped to ONE shop — it never goes to the
// platform owner, only to that shop's own admin(s).
export async function notifyShopOfStaffSignup({ username, full_name, shop }) {
  try {
    const transport = getTransport();
    if (!transport) {
      console.warn("Email not configured (GMAIL_USER/GMAIL_APP_PASSWORD missing) — skipping signup notification.");
      return;
    }
    const to = (shop?.notify_email || process.env.GMAIL_USER || "").trim();
    if (!to) return;

    await transport.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject: `New account request — ${shop?.shop_name || "your store"} (approval needed)`,
      text:
        `A new team member account was requested on ${shop?.shop_name || "your store"}.\n\n` +
        `Username: ${username}\n` +
        `Full name: ${full_name || "(not provided)"}\n\n` +
        `Log in as admin and open the Team page to approve or reject this request.`,
    });
  } catch (e) {
    // Never let an email failure break the signup flow itself.
    console.error("Failed to send staff signup notification email:", e.message);
  }
}

// Sends a "new SHOP/OWNER registration" notification straight to the
// platform owner (you) — never to any shop's own team inbox. This is the one
// that needs YOUR approval, since a brand-new shop can't self-approve.
// Includes a one-click "Verify & Approve" link (built from a random token
// generated at signup time) so you don't have to open the Superadmin panel
// and type in the secret key just to approve a shop — clicking the link in
// the email approves it directly.
export async function notifyPlatformOfShopSignup({ shop_name, slug, owner_username, owner_full_name, verifyUrl }) {
  try {
    const transport = getTransport();
    if (!transport) {
      console.warn("Email not configured (GMAIL_USER/GMAIL_APP_PASSWORD missing) — skipping owner signup notification.");
      return;
    }
    const to = (process.env.SUPERADMIN_EMAIL || process.env.GMAIL_USER || "").trim();
    if (!to) return;

    await transport.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject: "New shop registration — your approval needed",
      text:
        `A new shop wants to start using the app.\n\n` +
        `Shop name: ${shop_name}\n` +
        `Shop code: ${slug}\n` +
        `Owner username: ${owner_username}\n` +
        `Owner name: ${owner_full_name || "(not provided)"}\n\n` +
        (verifyUrl
          ? `Click this link to verify & approve the shop instantly:\n${verifyUrl}\n\n` +
            `(Or open the Superadmin page and enter your superadmin key if you'd rather review it there first.)`
          : `Approve or reject it from the Superadmin page (enter your superadmin key).`),
    });
  } catch (e) {
    console.error("Failed to send owner signup notification email:", e.message);
  }
}
