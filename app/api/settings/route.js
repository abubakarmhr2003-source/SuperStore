import { NextResponse } from "next/server";
import { row, query } from "@/lib/db";
import { ensureSchema } from "@/lib/initDb";
import { getOptionalUser, requireAdmin, withErrorHandling, ApiError } from "@/lib/auth";

const DEFAULTS = {
  shop_name: "",
  shop_tagline: "Your Trusted Local Store",
  shop_phone: "",
  shop_address: "",
  currency_symbol: "Rs.",
  notify_email: "",
  setup_complete: "0",
  slug: "",
};

// GET works whether or not you're logged in: logged out (e.g. the Login
// screen before anyone has authenticated) it just returns generic defaults,
// since there's no single "the shop" anymore in a multi-tenant app — logged
// in, it returns YOUR shop's own branding/settings.
export async function GET(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await getOptionalUser(req);
    if (!user) return NextResponse.json(DEFAULTS);

    const shop = user.shop;
    return NextResponse.json({
      shop_name: shop.shop_name || "",
      shop_tagline: shop.shop_tagline || DEFAULTS.shop_tagline,
      shop_phone: shop.shop_phone || "",
      shop_address: shop.shop_address || "",
      currency_symbol: shop.currency_symbol || DEFAULTS.currency_symbol,
      notify_email: shop.notify_email || "",
      setup_complete: String(shop.setup_complete ?? "0"),
      slug: shop.slug,
    });
  });
}

export async function PUT(req) {
  return withErrorHandling(async () => {
    await ensureSchema();
    const user = await requireAdmin(req); // owner or admin of their own shop only

    const data = await req.json();
    const fields = [];
    const vals = [];
    let i = 1;
    for (const k of ["shop_name", "shop_tagline", "shop_phone", "shop_address", "currency_symbol", "notify_email"]) {
      if (data[k] !== undefined && data[k] !== null) {
        fields.push(`${k}=$${i++}`);
        vals.push(String(data[k]));
      }
    }
    if ((data.shop_name || "").toString().trim()) {
      fields.push(`setup_complete=$${i++}`);
      vals.push("1");
    }
    if (fields.length) {
      vals.push(user.shop_id);
      await query(`UPDATE shops SET ${fields.join(",")} WHERE id=$${i}`, vals);
    }

    const shop = await row("SELECT * FROM shops WHERE id=$1", [user.shop_id]);
    return NextResponse.json({
      shop_name: shop.shop_name || "",
      shop_tagline: shop.shop_tagline || DEFAULTS.shop_tagline,
      shop_phone: shop.shop_phone || "",
      shop_address: shop.shop_address || "",
      currency_symbol: shop.currency_symbol || DEFAULTS.currency_symbol,
      notify_email: shop.notify_email || "",
      setup_complete: String(shop.setup_complete ?? "0"),
      slug: shop.slug,
    });
  });
}
