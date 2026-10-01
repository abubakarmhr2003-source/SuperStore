import { useEffect, useState } from "react";
import { settingsApi } from "../utils/api";
import { setShopInfo } from "../utils/shopInfo";

const CURRENCY_OPTIONS = [
  { symbol: "Rs.", label: "Rs. — Pakistani Rupee" },
  { symbol: "₨",   label: "₨ — Rupee Symbol" },
  { symbol: "$",   label: "$ — Dollar" },
  { symbol: "₹",   label: "₹ — Indian Rupee" },
  { symbol: "AED", label: "AED — UAE Dirham" },
  { symbol: "£",   label: "£ — Pound" },
];

export default function Settings({ onUpdated }) {
  const [form, setForm]       = useState(null);
  const [msg, setMsg]         = useState("");
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    settingsApi.get().then(setForm);
  }, []);

  const notify = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  const save = async () => {
    if (!form.shop_name.trim()) return notify("❌ Shop name is required");
    setSaving(true);
    try {
      const updated = await settingsApi.update({
        shop_name: form.shop_name,
        shop_tagline: form.shop_tagline,
        shop_phone: form.shop_phone,
        shop_address: form.shop_address,
        currency_symbol: form.currency_symbol,
        notify_email: form.notify_email,
      });
      setShopInfo(updated);
      setForm(updated);
      onUpdated && onUpdated(updated);
      notify("✅ Settings saved successfully!");
    } catch (e) {
      notify("❌ " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <div className="page"><div className="loading">Loading settings...</div></div>;

  return (
    <div className="page">
      {msg && <div className="toast">{msg}</div>}

      <div className="page-header">
        <h1>⚙️ Store Settings</h1>
      </div>

      <div className="two-col">
        <div className="card">
          <h2 className="card-title">🏪 Shop Information</h2>
          {form.slug && (
            <div style={{ marginBottom: "12px", padding: "10px", background: "var(--bg-soft, #f5f5f5)", borderRadius: "8px" }}>
              <strong>Shop Code: {form.slug}</strong>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>Share this with your team so they can request an account.</div>
            </div>
          )}
          <label>Shop / Business Name *</label>
          <input
            value={form.shop_name}
            onChange={e => setForm({ ...form, shop_name: e.target.value })}
            placeholder="e.g. Khan General Store"
          />
          <label>Tagline</label>
          <input
            value={form.shop_tagline}
            onChange={e => setForm({ ...form, shop_tagline: e.target.value })}
            placeholder="e.g. Quality Products, Fair Prices"
          />
          <label>Phone Number</label>
          <input
            value={form.shop_phone}
            onChange={e => setForm({ ...form, shop_phone: e.target.value })}
            placeholder="e.g. 0300-1234567"
          />
          <label>Address</label>
          <input
            value={form.shop_address}
            onChange={e => setForm({ ...form, shop_address: e.target.value })}
            placeholder="e.g. Main Bazaar, Lahore"
          />
          <label>Currency Symbol</label>
          <select value={form.currency_symbol} onChange={e => setForm({ ...form, currency_symbol: e.target.value })}>
            {CURRENCY_OPTIONS.map(c => <option key={c.symbol} value={c.symbol}>{c.label}</option>)}
          </select>
          <label>Notification Email (for new account requests)</label>
          <input
            type="email"
            value={form.notify_email || ""}
            onChange={e => setForm({ ...form, notify_email: e.target.value })}
            placeholder="e.g. yourname@gmail.com"
          />
          <div className="login-hint" style={{ marginBottom: "10px" }}>
            When someone requests a new account, an email goes here so you can approve it from the Team page.
          </div>

          <button className="btn-primary full-width" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "💾 Save Settings"}
          </button>
        </div>

        <div className="card">
          <h2 className="card-title">👁️ Bill Preview</h2>
          <div className="receipt">
            <div className="receipt-header">
              <div className="receipt-shop">🏪 {form.shop_name?.toUpperCase() || "YOUR SHOP NAME"}</div>
              <div className="receipt-meta" style={{ marginTop: "4px", marginBottom: "8px" }}>{form.shop_tagline}</div>
              {form.shop_phone && <div className="receipt-meta">📞 {form.shop_phone}</div>}
              {form.shop_address && <div className="receipt-meta">📍 {form.shop_address}</div>}
            </div>
            <div className="receipt-divider" />
            <table className="receipt-table">
              <thead><tr><th>Item</th><th style={{textAlign:"center"}}>Qty</th><th style={{textAlign:"right"}}>Rate</th><th style={{textAlign:"right"}}>Amt</th></tr></thead>
              <tbody>
                <tr><td>Sample Item</td><td style={{textAlign:"center"}}>2</td><td style={{textAlign:"right"}}>{form.currency_symbol}50</td><td style={{textAlign:"right"}}>{form.currency_symbol}100</td></tr>
              </tbody>
            </table>
            <div className="receipt-divider" />
            <div className="receipt-total">
              <span>TOTAL</span>
              <span>{form.currency_symbol} 100</span>
            </div>
            <div className="receipt-footer">★ Thank you for your purchase! ★<br />Please visit again</div>
          </div>

          <div className="calc-box" style={{ marginTop: "1rem" }}>
            This is how your shop info will appear on printed bills, credit statements, and exported reports.
          </div>
        </div>
      </div>
    </div>
  );
}
