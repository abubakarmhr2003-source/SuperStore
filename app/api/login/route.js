import { NextResponse } from "next/server";
import { getSupabaseAdmin, usernameToEmail } from "@/lib/supabaseAdmin";
import { row } from "@/lib/db";
import { ensureSchema } from "@/lib/initDb";
import { withErrorHandling, ApiError } from "@/lib/auth";

export async function POST(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const data = await req.json();
    const username = (data.username || "").toString().trim();
    const password = (data.password || "").toString();

    const supabase = getSupabaseAdmin();
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error || !authData?.session) throw new ApiError(401, "Invalid username or password");

    const profile = await row("SELECT * FROM profiles WHERE id=$1", [authData.user.id]);
    if (!profile) throw new ApiError(401, "Account profile not found. Contact admin.");
    if (!profile.approved) throw new ApiError(403, "Your account is pending admin approval.");
    if (!profile.active) throw new ApiError(403, "Account disabled. Contact admin.");

    const shop = profile.shop_id ? await row("SELECT * FROM shops WHERE id=$1", [profile.shop_id]) : null;
    if (!shop) throw new ApiError(403, "No shop is linked to this account. Contact support.");
    if (!shop.approved) throw new ApiError(403, "Your shop registration is still pending approval. You'll be able to log in once it's approved.");
    if (!shop.active) throw new ApiError(403, "This shop has been disabled. Contact support.");

    return NextResponse.json({
      token: authData.session.access_token,
      username: profile.username,
      full_name: profile.full_name,
      role: profile.role,
      shop: {
        shop_name: shop.shop_name,
        shop_tagline: shop.shop_tagline,
        shop_phone: shop.shop_phone,
        shop_address: shop.shop_address,
        currency_symbol: shop.currency_symbol,
        notify_email: shop.notify_email,
        setup_complete: shop.setup_complete,
        slug: shop.slug,
      },
    });
  });
}
