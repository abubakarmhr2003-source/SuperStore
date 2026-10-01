/* Shared helpers for showing / printing / sharing bills and statements.

   WHY THIS EXISTS
   The old code did `window.open("", "_blank")` + `document.write(...)` and
   auto-called `window.print()`. That works on a desktop with a mouse, but on
   mobile it fails: browsers block popups that are opened after an `await`
   (the tap "gesture" is already gone once the sale request finishes), and
   printing from a popup is unreliable on phones anyway.

   Now the bill opens in a full-screen overlay INSIDE the page (no popup, so
   nothing to block). From there the user can Print / Save as PDF, Share, or
   send it on WhatsApp. It works with tap and mouse alike. */

export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// Pakistani number -> WhatsApp international format (0300... -> 92300...)
export function waNumber(phone) {
  let n = String(phone || "").replace(/\D/g, "");
  if (!n) return "";
  if (n.startsWith("00")) n = n.slice(2);
  else if (n.startsWith("0")) n = "92" + n.slice(1);
  else if (n.length === 10 && n.startsWith("3")) n = "92" + n;
  return n;
}

/* items: [{ name, qty, sale_price, discount?, line_total? }] */
export function buildBillHtml({ shop, billNo, date, customer, phone, items }) {
  const cur = esc(shop.currency_symbol);
  const lineAmt = (b) =>
    b.line_total != null ? Number(b.line_total) : b.qty * b.sale_price - (b.discount || 0);
  const subtotal = items.reduce((a, b) => a + b.qty * b.sale_price, 0);
  const totalDiscount = items.reduce((a, b) => a + (b.discount || 0), 0);
  const total = items.reduce((a, b) => a + lineAmt(b), 0);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(billNo)}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;width:320px;max-width:100%;margin:auto;padding:14px;background:#fff;color:#000}
  .shop{text-align:center;font-size:20px;font-weight:bold;letter-spacing:1px}.sub{text-align:center;font-size:10px;color:#666;margin-bottom:4px}
  hr{border:none;border-top:1px dashed #000;margin:8px 0}.hr2{border-top:2px solid #000}
  .row{display:flex;justify-content:space-between;font-size:11px;margin:3px 0}.muted{color:#666}
  table{width:100%;border-collapse:collapse}th{padding:4px 3px;font-size:10px;text-align:left;border-bottom:1px solid #000}
  td{padding:4px 3px;font-size:11px;border-bottom:1px dotted #ccc}.right{text-align:right}.center{text-align:center}
  .disc{color:#c00}
  .total{display:flex;justify-content:space-between;font-size:16px;font-weight:bold;padding:6px 0}
  .footer{text-align:center;font-size:10px;color:#666;margin-top:10px;line-height:1.8}
  @media print{@page{size:80mm auto;margin:0}body{width:100%;padding:4mm}}</style></head><body>
  <div class="shop">🏪 ${esc(shop.shop_name.toUpperCase())}</div><div class="sub">${esc(shop.shop_tagline)}</div>
  ${shop.shop_phone ? `<div class="sub">📞 ${esc(shop.shop_phone)}</div>` : ""}
  ${shop.shop_address ? `<div class="sub">📍 ${esc(shop.shop_address)}</div>` : ""}
  <hr class="hr2"><div class="row"><span class="muted">Invoice:</span><strong>${esc(billNo)}</strong></div>
  <div class="row"><span class="muted">Date:</span><span>${esc(date.toLocaleDateString())}</span></div>
  <div class="row"><span class="muted">Time:</span><span>${esc(date.toLocaleTimeString())}</span></div>
  <div class="row"><span class="muted">Customer:</span><strong>${esc(customer || "Walk-in")}</strong></div>
  ${phone ? `<div class="row"><span class="muted">Phone:</span><span>${esc(phone)}</span></div>` : ""}
  <hr><table><thead><tr><th>#</th><th>Item</th><th class="center">Qty</th><th class="right">Rate</th><th class="right">Amt</th></tr></thead>
  <tbody>${items.map((b, i) => `<tr><td style="color:#999">${i + 1}</td><td>${esc(b.name)}${b.discount ? `<br><span class="disc" style="font-size:9px">− ${cur}${Number(b.discount).toFixed(0)} off</span>` : ""}</td><td class="center">${b.qty}</td><td class="right">${cur}${b.sale_price}</td><td class="right"><b>${cur}${lineAmt(b).toFixed(0)}</b></td></tr>`).join("")}</tbody></table>
  <hr>
  ${totalDiscount > 0 ? `<div class="row"><span class="muted">Subtotal:</span><span>${cur} ${subtotal.toFixed(0)}</span></div><div class="row disc"><span>Discount:</span><span>− ${cur} ${totalDiscount.toFixed(0)}</span></div>` : ""}
  <div class="total"><span>TOTAL</span><span>${cur} ${total.toFixed(0)}</span></div><hr class="hr2">
  <div class="footer">★ Thank you for your purchase! ★<br>Please visit again<br>${esc(date.toLocaleString())}</div>
  </body></html>`;
}

// Plain-text version of the bill, used for Share / WhatsApp.
export function buildBillText({ shop, billNo, date, customer, items }) {
  const cur = shop.currency_symbol;
  const lineAmt = (b) =>
    b.line_total != null ? Number(b.line_total) : b.qty * b.sale_price - (b.discount || 0);
  const total = items.reduce((a, b) => a + lineAmt(b), 0);
  const lines = items.map((b) => `• ${b.name} x${b.qty} = ${cur}${lineAmt(b).toFixed(0)}`);
  return [
    `🏪 ${shop.shop_name}`,
    shop.shop_phone ? `📞 ${shop.shop_phone}` : null,
    `Invoice: ${billNo}`,
    `Date: ${date.toLocaleString()}`,
    `Customer: ${customer || "Walk-in"}`,
    "",
    ...lines,
    "",
    `TOTAL: ${cur} ${total.toFixed(0)}`,
    "",
    "Thank you for your purchase! Please visit again.",
  ].filter((l) => l !== null).join("\n");
}

/* Shows `html` in a full-screen in-page overlay with Print / Share / WhatsApp
   / Close buttons. Safe to call from anywhere (even after an await) because
   it never opens a popup. */
export function openDocument({ html, title = "Document", shareText = "", phone = "" }) {
  // Remove any overlay that is already open.
  document.getElementById("gs-doc-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "gs-doc-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.7);display:flex;flex-direction:column;" +
    "height:100vh;height:100dvh;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";

  const bar = document.createElement("div");
  bar.style.cssText =
    "display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center;padding:10px;background:#1f2937";

  const iframe = document.createElement("iframe");
  iframe.title = title;
  iframe.srcdoc = html;
  iframe.style.cssText = "flex:1;width:100%;border:0;background:#fff";

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);

  const btn = (label, onClick, bg = "#374151") => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText =
      `background:${bg};color:#fff;border:0;border-radius:8px;padding:10px 14px;font-size:14px;font-weight:600;cursor:pointer;touch-action:manipulation`;
    b.addEventListener("click", onClick);
    bar.appendChild(b);
    return b;
  };

  btn("🖨️ Print / Save PDF", () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      window.print();
    }
  }, "#16a34a");

  if (shareText) {
    if (navigator.share) {
      btn("📤 Share", () => {
        navigator.share({ title, text: shareText }).catch(() => {}); // user cancelled = fine
      });
    }
    btn("💬 WhatsApp", () => {
      const n = waNumber(phone);
      const url = `https://wa.me/${n}?text=${encodeURIComponent(shareText)}`;
      window.open(url, "_blank", "noopener");
    }, "#25d366");
  }

  btn("✖ Close", close, "#dc2626");

  overlay.appendChild(bar);
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
}

// One-call helper used by Billing (new sale / preview) and History (reprint).
export function showBill({ shop, billNo, date, customer, phone, items }) {
  const d = date ? new Date(date) : new Date();
  const args = { shop, billNo, date: d, customer, phone, items };
  openDocument({
    html: buildBillHtml(args),
    title: `Bill ${billNo}`,
    shareText: buildBillText(args),
    phone,
  });
}
