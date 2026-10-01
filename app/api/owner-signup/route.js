import { NextResponse } from "next/server";
import crypto from "crypto";
import { row } from "@/lib/db";
import { ensureSchema, makeSlug } from "@/lib/initDb";
import { getSupabaseAdmin, usernameToEmail } from "@/lib/supabaseAdmin";
import { notifyPlatformOfShopSignup } from "@/lib/mailer";
import { withErrorHandling, ApiError } from "@/lib/auth";

// Builds the public base URL to put in the verify-email link. Prefers an
// explicit APP_URL env var (set this in production), falls back to the
// incoming request's own origin (works fine for local dev / preview URLs).
function getBaseUrl(req) {
  const explicit = (process.env.APP_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}

// A brand-new business owner registering their shop for the first time.
// This is deliberately separate from /api/signup (which is for staff joining
// an EXISTING shop): a new shop needs the platform owner's approval, not the
// shop's own (not-yet-existing) admin's approval.
export async function POST(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const data = await req.json();
    const shopName = (data.shop_name || "").toString().trim();
    const username = (data.username || "").toString().trim();
    const password = (data.password || "").toString();
    const fullName = (data.full_name || "").toString().trim();

    if (shopName.length < 2) throw new ApiError(400, "Shop name is required");
    if (username.length < 3) throw new ApiError(400, "Username min 3 chars");
    if (password.length < 4) throw new ApiError(400, "Password min 4 chars");

    const dup = await row("SELECT 1 FROM profiles WHERE LOWER(username)=LOWER($1)", [username]);
    if (dup) throw new ApiError(400, "Username already exists");

    // Generate a unique shop code (retry a few times on the rare collision).
    let slug;
    for (let i = 0; i < 5; i++) {
      const candidate = makeSlug(shopName);
      const exists = await row("SELECT 1 FROM shops WHERE slug=$1", [candidate]);
      if (!exists) { slug = candidate; break; }
    }
    if (!slug) throw new ApiError(500, "Could not generate a shop code, please try again");

    // Random one-time token used for the "click to verify & approve" link
    // sent in the notification email — unguessable, and cleared once used.
    const verifyToken = crypto.randomBytes(32).toString("hex");

    const shop = await row(
      `INSERT INTO shops (slug, shop_name, setup_complete, approved, active, verify_token)
       VALUES ($1,$2,0,0,1,$3) RETURNING *`,
      [slug, shopName, verifyToken]
    );

    const supabase = getSupabaseAdmin();
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: usernameToEmail(username),
      password,
      email_confirm: true,
    });
    if (error) throw new ApiError(400, "Could not create account: " + error.message);

    // The owner account itself is auto-"approved" (no team-approval step for
    // them), but they still can't log in until their SHOP is approved by the
    // platform owner — verifyToken checks shop.approved separately.
    await row(
      "INSERT INTO profiles (id,shop_id,username,full_name,role,active,approved) VALUES ($1,$2,$3,$4,'owner',1,1) " +
      "RETURNING id",
      [created.user.id, shop.id, username, fullName]
    );

    const baseUrl = getBaseUrl(req);
    const verifyUrl = baseUrl ? `${baseUrl}/api/superadmin/verify-shop?token=${verifyToken}` : null;

    await notifyPlatformOfShopSignup({
      shop_name: shopName,
      slug,
      owner_username: username,
      owner_full_name: fullName,
      verifyUrl,
    });

    return NextResponse.json({
      ok: true,
      shop_code: slug,
      message: "Shop registration submitted. We'll email you once it's approved — this usually only takes a short while.",
    });
  });
}
