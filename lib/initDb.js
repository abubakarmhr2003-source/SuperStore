import { query, row } from "./db";

// Generates a short, human-shareable shop code like "KHN482" from a shop name.
function makeSlug(shopName) {
  const letters = (shopName || "shop").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3) || "SHP";
  const digits = Math.floor(100 + Math.random() * 900);
  return `${letters}${digits}`;
}

export async function ensureSchema() {
  if (global._gsSchemaReady) return;
  // Set the flag before finishing so concurrent requests on startup don't
  // all try to run this at once.
  global._gsSchemaReady = true;

  try {
    await query(`
      -- Each row here is one shop/business ("tenant"). Every other table's
      -- data is scoped to a shop_id so many shop owners can safely share
      -- one deployment/database.
      CREATE TABLE IF NOT EXISTS shops (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        shop_name TEXT NOT NULL DEFAULT '',
        shop_tagline TEXT DEFAULT 'Your Trusted Local Store',
        shop_phone TEXT DEFAULT '',
        shop_address TEXT DEFAULT '',
        currency_symbol TEXT DEFAULT 'Rs.',
        notify_email TEXT DEFAULT '',
        setup_complete INTEGER DEFAULT 0,
        approved INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        verify_token TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY,
        shop_id INTEGER REFERENCES shops(id),
        username TEXT UNIQUE NOT NULL,
        full_name TEXT DEFAULT '',
        role TEXT DEFAULT 'staff',
        active INTEGER DEFAULT 1,
        approved INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES shops(id),
        name TEXT NOT NULL,
        category TEXT DEFAULT 'Other',
        qty INTEGER DEFAULT 0,
        cost_price REAL DEFAULT 0,
        sale_price REAL DEFAULT 0,
        sold INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES shops(id),
        customer TEXT DEFAULT 'Walk-in Customer',
        items_json TEXT,
        total REAL DEFAULT 0,
        profit REAL DEFAULT 0,
        sold_by TEXT DEFAULT '',
        sale_date TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES shops(id),
        description TEXT,
        amount REAL DEFAULT 0,
        added_by TEXT DEFAULT '',
        expense_date TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS credit_customers (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES shops(id),
        name TEXT NOT NULL,
        phone TEXT DEFAULT '',
        address TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS credit_ledger (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES shops(id),
        customer_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT DEFAULT '',
        sale_id INTEGER,
        added_by TEXT DEFAULT '',
        entry_date TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(customer_id) REFERENCES credit_customers(id)
      );
      CREATE TABLE IF NOT EXISTS returns (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES shops(id),
        item_id INTEGER,
        item_name TEXT NOT NULL,
        qty INTEGER NOT NULL,
        refund_amount REAL DEFAULT 0,
        reason TEXT DEFAULT '',
        restocked INTEGER DEFAULT 1,
        customer TEXT DEFAULT '',
        sale_id INTEGER,
        processed_by TEXT DEFAULT '',
        return_date TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ---- Backfill for databases created before multi-tenancy existed ----
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved INTEGER DEFAULT 1`);
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id)`);
    await query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS verify_token TEXT`);
    for (const t of ["items", "sales", "expenses", "credit_customers", "credit_ledger", "returns"]) {
      await query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id)`);
    }

    // If an old single-tenant "settings" table exists from before, migrate its
    // values into a shop row so upgrades don't lose existing shop branding.
    const hasOldSettings = await row(
      "SELECT 1 FROM information_schema.tables WHERE table_name='settings'"
    );
    let legacyShopId = null;
    if (hasOldSettings) {
      const list = await query("SELECT key,value FROM settings");
      const s = {};
      for (const r of list.rows) s[r.key] = r.value;
      const anyOrphan = await row("SELECT 1 FROM profiles WHERE shop_id IS NULL LIMIT 1");
      if (s.shop_name || anyOrphan) {
        const legacy = await row(
          `INSERT INTO shops (slug,shop_name,shop_tagline,shop_phone,shop_address,currency_symbol,notify_email,setup_complete,approved,active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,1) RETURNING id`,
          [
            makeSlug(s.shop_name || "Shop"),
            s.shop_name || "",
            s.shop_tagline || "Your Trusted Local Store",
            s.shop_phone || "",
            s.shop_address || "",
            s.currency_symbol || "Rs.",
            s.notify_email || "",
            s.setup_complete || "0",
          ]
        );
        legacyShopId = legacy.id;
      }
    }

    // Any pre-existing profile/data rows with no shop yet get attached to the
    // legacy shop (or a fresh "Default Shop" if there was never one).
    const orphan = await row("SELECT 1 FROM profiles WHERE shop_id IS NULL LIMIT 1");
    if (orphan) {
      if (!legacyShopId) {
        const created = await row(
          `INSERT INTO shops (slug,shop_name,setup_complete,approved,active)
           VALUES ($1,'Default Shop','0',1,1) RETURNING id`,
          [makeSlug("Default")]
        );
        legacyShopId = created.id;
      }
      await query("UPDATE profiles SET shop_id=$1 WHERE shop_id IS NULL", [legacyShopId]);
      for (const t of ["items", "sales", "expenses", "credit_customers", "credit_ledger", "returns"]) {
        await query(`UPDATE ${t} SET shop_id=$1 WHERE shop_id IS NULL`, [legacyShopId]);
      }
    }

  } catch (e) {
    global._gsSchemaReady = false; // allow retry on next request if this failed
    throw e;
  }
}

// NOTE: There is intentionally no auto-created "admin / admin123" account
// anymore. The very first shop + owner account is created by whoever fills
// in the "Register your own shop" (owner-signup) form, same as every shop
// after it.

export { makeSlug };
