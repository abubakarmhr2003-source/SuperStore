const BASE = "/api";

function getToken() { return localStorage.getItem("gs_token") || ""; }

async function req(path, method = "GET", body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (res.status === 401) {
    localStorage.removeItem("gs_token");
    localStorage.removeItem("gs_user");
    localStorage.removeItem("gs_role");
    localStorage.removeItem("gs_fullname");
    window.dispatchEvent(new Event("auth:logout"));
    throw new Error("Session expired. Please login again.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  login:          (data) => req("/login", "POST", data),
  signup:         (data) => req("/signup", "POST", data),
  ownerSignup:    (data) => req("/owner-signup", "POST", data),
  logout:         ()     => req("/logout", "POST"),
  getMe:          ()     => req("/me"),
  changePassword: (data) => req("/change-password", "POST", data),

  getItems:       ()     => req("/items"),
  addItem:        (data) => req("/items", "POST", data),
  updateItem:     (id, data) => req(`/items/${id}`, "PUT", data),
  deleteItem:     (id)   => req(`/items/${id}`, "DELETE"),

  getSales:       ()     => req("/sales"),
  createSale:     (data) => req("/sales", "POST", data),
  updateSale:     (id, data) => req(`/sales/${id}`, "PUT", data),
  deleteSale:     (id)   => req(`/sales/${id}`, "DELETE"),

  getExpenses:    ()     => req("/expenses"),
  addExpense:     (data) => req("/expenses", "POST", data),
  deleteExpense:  (id)   => req(`/expenses/${id}`, "DELETE"),

  getStats:       ()     => req("/stats"),
};

export const creditApi = {
  getCustomers:   ()         => req("/credit/customers"),
  addCustomer:    (data)     => req("/credit/customers", "POST", data),
  updateCustomer: (id, data) => req(`/credit/customers/${id}`, "PUT", data),
  deleteCustomer: (id)       => req(`/credit/customers/${id}`, "DELETE"),
  getLedger:      (cid)      => req(`/credit/ledger/${cid}`),
  addEntry:       (data)     => req("/credit/ledger", "POST", data),
  deleteEntry:    (id)       => req(`/credit/ledger/${id}`, "DELETE"),
  getSummary:     ()         => req("/credit/summary"),
};

export const userApi = {
  list:    ()         => req("/users"),
  create:  (data)     => req("/users", "POST", data),
  update:  (id, data) => req(`/users/${id}`, "PUT", data),
  remove:  (id)       => req(`/users/${id}`, "DELETE"),
};

export const returnsApi = {
  list:    ()     => req("/returns"),
  create:  (data) => req("/returns", "POST", data),
  remove:  (id)   => req(`/returns/${id}`, "DELETE"),
  summary: ()     => req("/returns/summary"),
};

export const settingsApi = {
  get:    ()     => req("/settings"),
  update: (data) => req("/settings", "PUT", data),
};

// Superadmin panel — protected with a shared secret key, not a normal login.
async function superadminReq(path, method, key, body) {
  const headers = { "Content-Type": "application/json", "X-Superadmin-Key": key };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Server error" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const superadminApi = {
  listShops:    (key)         => superadminReq("/superadmin/shops", "GET", key),
  updateShop:   (key, id, d)  => superadminReq(`/superadmin/shops/${id}`, "PUT", key, d),
};
