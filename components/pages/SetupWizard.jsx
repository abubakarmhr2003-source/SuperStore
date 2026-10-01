import { useState } from "react";
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

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    shop_name: "",
    shop_tagline: "Your Trusted Local Store",
    shop_phone: "",
    shop_address: "",
    currency_symbol: "Rs.",
  });
  const [error, setError]     = useState("");
  const [saving, setSaving]   = useState(false);

  const next = () => {
    if (step === 1 && !form.shop_name.trim()) {
      setError("❌ Please enter your shop name");
      return;
    }
    setError("");
    setStep(step + 1);
  };
  const back = () => { setError(""); setStep(step - 1); };

  const finish = async () => {
    setSaving(true);
    try {
      const updated = await settingsApi.update(form);
      setShopInfo(updated);
      onComplete(updated);
    } catch (e) {
      setError("❌ " + e.message);
      setSaving(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card" style={{ maxWidth: "460px" }}>
        <span className="login-logo">🏪</span>
        <h1 className="login-title">Welcome!</h1>
        <p className="login-sub">Let's set up your store — Step {step} of 3</p>

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "1.5rem" }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{
              width: "32px", height: "4px", borderRadius: "2px",
              background: n <= step ? "var(--primary)" : "var(--border)",
              transition: "background 0.3s",
            }} />
          ))}
        </div>

        {/* STEP 1: Shop name & tagline */}
        {step === 1 && (
          <div className="login-form">
            <div className="login-field">
              <label>Shop / Business Name *</label>
              <input
                type="text"
                value={form.shop_name}
                onChange={e => setForm({ ...form, shop_name: e.target.value })}
                placeholder="e.g. Khan General Store"
                autoFocus
              />
            </div>
            <div className="login-field">
              <label>Tagline (shown on bills & login)</label>
              <input
                type="text"
                value={form.shop_tagline}
                onChange={e => setForm({ ...form, shop_tagline: e.target.value })}
                placeholder="e.g. Quality Products, Fair Prices"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Contact details */}
        {step === 2 && (
          <div className="login-form">
            <div className="login-field">
              <label>Phone Number (optional)</label>
              <input
                type="text"
                value={form.shop_phone}
                onChange={e => setForm({ ...form, shop_phone: e.target.value })}
                placeholder="e.g. 0300-1234567"
                autoFocus
              />
            </div>
            <div className="login-field">
              <label>Address (optional)</label>
              <input
                type="text"
                value={form.shop_address}
                onChange={e => setForm({ ...form, shop_address: e.target.value })}
                placeholder="e.g. Main Bazaar, Lahore"
              />
            </div>
            <div className="login-hint" style={{ marginTop: "4px" }}>
              These appear on printed bills and customer statements.
            </div>
          </div>
        )}

        {/* STEP 3: Currency + summary */}
        {step === 3 && (
          <div className="login-form">
            <div className="login-field">
              <label>Currency Symbol</label>
              <select value={form.currency_symbol} onChange={e => setForm({ ...form, currency_symbol: e.target.value })}>
                {CURRENCY_OPTIONS.map(c => <option key={c.symbol} value={c.symbol}>{c.label}</option>)}
              </select>
            </div>

            <div className="calc-box" style={{ marginTop: "10px" }}>
              <div style={{ fontWeight: 700, marginBottom: "6px" }}>📋 Review</div>
              <div style={{ fontSize: "12px", lineHeight: 1.8, color: "var(--text2)" }}>
                <strong>Shop:</strong> {form.shop_name}<br />
                <strong>Tagline:</strong> {form.shop_tagline || "—"}<br />
                {form.shop_phone && <>📞 {form.shop_phone}<br /></>}
                {form.shop_address && <>📍 {form.shop_address}<br /></>}
                <strong>Currency:</strong> {form.currency_symbol} {form.currency_symbol}100
              </div>
            </div>
            <div className="login-hint">
              You can change these anytime from <strong>Settings</strong> in the sidebar.
            </div>
          </div>
        )}

        {error && <div className="login-error" style={{ marginTop: "10px" }}>{error}</div>}

        <div style={{ display: "flex", gap: "10px", marginTop: "1.25rem" }}>
          {step > 1 && (
            <button className="btn-outline" style={{ flex: 1 }} onClick={back} disabled={saving}>← Back</button>
          )}
          {step < 3 ? (
            <button className="login-btn" style={{ flex: 2, marginTop: 0 }} onClick={next}>Continue →</button>
          ) : (
            <button className="login-btn" style={{ flex: 2, marginTop: 0 }} onClick={finish} disabled={saving}>
              {saving ? "Saving..." : "🎉 Finish Setup"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
