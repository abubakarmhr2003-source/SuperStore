import { NextResponse } from "next/server";
import { row } from "@/lib/db";
import { ensureSchema } from "@/lib/initDb";
import { getSupabaseAdmin, usernameToEmail } from "@/lib/supabaseAdmin";
import { notifyShopOfStaffSignup } from "@/lib/mailer";
import { withErrorHandling, ApiError } from "@/lib/auth";

// Staff joining an EXISTING, already-approved shop. The shop's own admin
// approves these from the Team page — the platform owner is never emailed
// about this (see /api/owner-signup for new-shop registrations instead).
export async function POST(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const data = await req.json();
    const username = (data.username || "").toString().trim();
    const password = (data.password || "").toString();
    const fullName = (data.full_name || "").toString().trim();
    const shopCode = (data.shop_code || "").toString().trim().toUpperCase();

    if (!shopCode) throw new ApiError(400, "Shop code is required — ask your shop owner/admin for it");
    if (username.length < 3) throw new ApiError(400, "Username min 3 chars");
    if (password.length < 4) throw new ApiError(400, "Password min 4 chars");

    const shop = await row("SELECT * FROM shops WHERE slug=$1", [shopCode]);
    if (!shop) throw new ApiError(404, "Shop code not found. Double-check it with your shop owner/admin.");
    if (!shop.approved) throw new ApiError(403, "This shop is still pending approval and can't accept new team members yet.");

    const dup = await row("SELECT 1 FROM profiles WHERE LOWER(username)=LOWER($1)", [username]);
    if (dup) throw new ApiError(400, "Username already exists");

    const supabase = getSupabaseAdmin();
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: usernameToEmail(username),
      password,
      email_confirm: true,
    });
    if (error) throw new ApiError(400, "Could not create account: " + error.message);

    // New self-signups are always "staff" and start out unapproved — that
    // shop's own admin must approve them from the Team page before they can
    // log in.
    await row(
      "INSERT INTO profiles (id,shop_id,username,full_name,role,active,approved) VALUES ($1,$2,$3,$4,'staff',1,0) " +
      "RETURNING id",
      [created.user.id, shop.id, username, fullName]
    );

    await notifyShopOfStaffSignup({ username, full_name: fullName, shop });

    return NextResponse.json({
      ok: true,
      message: "Account request submitted. An admin at your shop needs to approve it before you can log in.",
    });
  });
}
