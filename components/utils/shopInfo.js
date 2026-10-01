/* Shared helper to read shop branding info (cached in localStorage)
   so that print windows (which don't share React state) can access it. */

const DEFAULTS = {
  shop_name: "General Store",
  shop_tagline: "Your Trusted Local Store",
  shop_phone: "",
  shop_address: "",
  currency_symbol: "Rs.",
};

export function getShopInfo() {
  try {
    const raw = localStorage.getItem("gs_shop_settings");
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      shop_name:    parsed.shop_name?.trim()    || DEFAULTS.shop_name,
      shop_tagline: parsed.shop_tagline?.trim() || DEFAULTS.shop_tagline,
      shop_phone:   parsed.shop_phone || "",
      shop_address: parsed.shop_address || "",
      currency_symbol: parsed.currency_symbol?.trim() || DEFAULTS.currency_symbol,
      slug: parsed.slug || "",
    };
  } catch {
    return DEFAULTS;
  }
}

export function setShopInfo(settings) {
  localStorage.setItem("gs_shop_settings", JSON.stringify(settings || {}));
}

export function isSetupComplete(settings) {
  return settings && settings.setup_complete === "1" && settings.shop_name && settings.shop_name.trim();
}
