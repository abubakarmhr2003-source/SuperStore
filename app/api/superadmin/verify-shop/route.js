import { NextResponse } from "next/server";
import { query, row } from "@/lib/db";
import { ensureSchema } from "@/lib/initDb";

// This is the link the platform owner clicks from the "New shop
// registration" email — GET because it's opened straight from a browser/
// email client, not called from the app's own frontend. Security comes from
// the token itself being a long random one-time secret (see owner-signup),
// not from a login — so no superadmin key is needed here on purpose.
function page({ title, message, ok }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         background: #f4f5f7; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; }
  .card { background: #fff; border-radius: 14px; padding: 40px 36px; max-width: 420px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center; }
  .icon { font-size: 44px; margin-bottom: 12px; }
  h1 { font-size: 20px; margin: 0 0 8px; color: ${ok ? "#15803d" : "#b91c1c"}; }
  p { color: #444; font-size: 15px; line-height: 1.5; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">${ok ? "✅" : "⚠️"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

function html(body, status = 200) {
  return new NextResponse(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req) {
  try {
    await ensureSchema();
    const token = new URL(req.url).searchParams.get("token") || "";

    if (!token) {
      return html(page({ title: "Missing link", message: "This verification link is incomplete.", ok: false }), 400);
    }

    const shop = await row("SELECT * FROM shops WHERE verify_token=$1", [token]);
    if (!shop) {
      return html(page({
        title: "Link already used",
        message: "This verification link is invalid or has already been used — the shop may already be approved. Check the Superadmin page if you're unsure.",
        ok: false,
      }), 404);
    }

    // Approve the shop and burn the token so the link can't be clicked twice.
    await query("UPDATE shops SET approved=1, verify_token=NULL WHERE id=$1", [shop.id]);

    return html(page({
      title: "Shop approved ✅",
      message: `"${shop.shop_name || shop.slug}" (code ${shop.slug}) has been verified and approved. The owner can now log in.`,
      ok: true,
    }));
  } catch (e) {
    console.error("verify-shop error:", e);
    return html(page({ title: "Something went wrong", message: "Please try again or approve the shop from the Superadmin page instead.", ok: false }), 500);
  }
}
