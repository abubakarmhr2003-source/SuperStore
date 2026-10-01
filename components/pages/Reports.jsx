import { useEffect, useState, useRef } from "react";
import { api, creditApi } from "../utils/api";
import { getShopInfo } from "../utils/shopInfo";
import * as XLSX from "xlsx";

/* ── helpers ─────────────────────────────── */
const fmt   = (n) => Number(n || 0).toFixed(2);
const money = (n) => `Rs. ${Number(n || 0).toLocaleString("en-PK", { minimumFractionDigits: 0 })}`;
const today = () => new Date().toISOString().slice(0, 10);

function autoWidth(ws) {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const widths = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    let max = 10;
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v) max = Math.max(max, String(cell.v).length + 2);
    }
    widths.push({ wch: Math.min(max, 40) });
  }
  ws["!cols"] = widths;
}

/* styled header row helper */
function headerStyle() {
  return {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
    fill: { fgColor: { rgb: "4C3DBF" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      bottom: { style: "medium", color: { rgb: "FFFFFF" } },
      right:  { style: "thin",   color: { rgb: "FFFFFF" } },
    },
  };
}
function numStyle(color) {
  return {
    numFmt: '#,##0.00',
    font: { color: { rgb: color || "000000" } },
    alignment: { horizontal: "right" },
  };
}
function applyHeaderStyle(ws, headerRow) {
  headerRow.forEach((_, idx) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: idx });
    if (ws[addr]) ws[addr].s = headerStyle();
  });
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function Reports() {
  const [items,     setItems]     = useState([]);
  const [sales,     setSales]     = useState([]);
  const [expenses,  setExpenses]  = useState([]);
  const [stats,     setStats]     = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [exporting, setExporting] = useState("");
  const [msg,       setMsg]       = useState("");
  const [dateFrom,  setDateFrom]  = useState("");
  const [dateTo,    setDateTo]    = useState(today());
  const mounted = useRef(true);

  const notify = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  useEffect(() => {
    mounted.current = true;
    Promise.all([
      api.getItems(), api.getSales(), api.getExpenses(),
      api.getStats(), creditApi.getCustomers(),
    ]).then(([i, s, e, st, c]) => {
      if (!mounted.current) return;
      setItems(i); setSales(s); setExpenses(e); setStats(st); setCustomers(c);
    }).finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, []);

  /* filter sales by date range */
  const filteredSales = sales.filter(s => {
    const d = s.sale_date?.slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo   && d > dateTo)   return false;
    return true;
  });

  /* ── 1. STOCK REPORT ─────────────────────── */
  const exportStock = () => {
    setExporting("stock");
    try {
      const header = ["#", "Item Name", "Category", "Stock (pcs)", "Cost Price (Rs)", "Sale Price (Rs)", "Profit/pc (Rs)", "Margin %", "Stock Value (Rs)", "Units Sold", "Status"];
      const rows = items.map((item, i) => {
        const margin = item.cost_price > 0 ? ((item.sale_price - item.cost_price) / item.cost_price * 100) : 0;
        const status = item.qty === 0 ? "Out of Stock" : item.qty < 10 ? "Low Stock" : "In Stock";
        return [
          i + 1, item.name, item.category,
          item.qty, item.cost_price, item.sale_price,
          +(item.sale_price - item.cost_price).toFixed(2),
          +margin.toFixed(1),
          +(item.qty * item.cost_price).toFixed(2),
          item.sold || 0, status,
        ];
      });

      const totalVal = items.reduce((a, i) => a + i.qty * i.cost_price, 0);
      const totalPcs = items.reduce((a, i) => a + i.qty, 0);

      const ws = XLSX.utils.aoa_to_sheet([header, ...rows,
        [],
        ["", "TOTALS", "", totalPcs, "", "", "", "", +totalVal.toFixed(2), items.reduce((a,i)=>a+(i.sold||0),0)],
      ]);
      applyHeaderStyle(ws, header);
      autoWidth(ws);
      ws["!freeze"] = { xSplit: 0, ySplit: 1 };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Stock Report");
      XLSX.writeFile(wb, `Stock_Report_${today()}.xlsx`);
      notify("✅ Stock Report downloaded!");
    } catch(e) { notify("❌ " + e.message); }
    setExporting("");
  };

  /* ── 2. SALES REPORT ─────────────────────── */
  const exportSales = () => {
    setExporting("sales");
    try {
      /* Summary sheet */
      const totalRevenue = filteredSales.reduce((a,s)=>a+s.total,0);
      const totalProfit  = filteredSales.reduce((a,s)=>a+s.profit,0);
      const totalTxns    = filteredSales.length;
      const avgSale      = totalTxns ? totalRevenue / totalTxns : 0;

      const summaryData = [
        [`${getShopInfo().shop_name} — Sales Report`],
        [`Period: ${dateFrom || "All time"} to ${dateTo}`],
        [`Generated: ${new Date().toLocaleString()}`],
        [],
        ["Metric", "Value"],
        ["Total Transactions", totalTxns],
        ["Total Revenue",      `Rs. ${totalRevenue.toFixed(0)}`],
        ["Total Profit",       `Rs. ${totalProfit.toFixed(0)}`],
        ["Avg Sale Value",     `Rs. ${avgSale.toFixed(0)}`],
        ["Profit Margin",      `${totalRevenue ? (totalProfit/totalRevenue*100).toFixed(1) : 0}%`],
      ];

      /* Transactions sheet */
      const txHeader = ["#", "Date", "Time", "Customer", "Items", "Qty Total", "Revenue (Rs)", "Profit (Rs)", "Margin %"];
      const txRows = filteredSales.map((s, i) => {
        const dt   = new Date(s.sale_date);
        const items_list = s.items_json?.map(x => x.name).join(", ") || "";
        const qtyTotal = s.items_json?.reduce((a,x)=>a+x.qty,0) || 0;
        const margin = s.total > 0 ? (s.profit/s.total*100) : 0;
        return [
          i+1,
          dt.toLocaleDateString(),
          dt.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),
          s.customer,
          items_list,
          qtyTotal,
          +s.total.toFixed(2),
          +s.profit.toFixed(2),
          +margin.toFixed(1),
        ];
      });
      txRows.push([], ["","","","","TOTAL","",+totalRevenue.toFixed(2),+totalProfit.toFixed(2)]);

      /* Item-wise breakdown */
      const itemMap = {};
      filteredSales.forEach(s => {
        (s.items_json || []).forEach(item => {
          if (!itemMap[item.name]) itemMap[item.name] = { qty:0, revenue:0, profit:0 };
          itemMap[item.name].qty     += item.qty;
          itemMap[item.name].revenue += item.qty * item.sale_price;
          itemMap[item.name].profit  += item.qty * (item.sale_price - item.cost_price);
        });
      });
      const itemHeader = ["Item Name", "Qty Sold", "Revenue (Rs)", "Profit (Rs)", "Avg Sale Price"];
      const itemRows = Object.entries(itemMap)
        .sort((a,b) => b[1].revenue - a[1].revenue)
        .map(([name, d]) => [name, d.qty, +d.revenue.toFixed(2), +d.profit.toFixed(2), +(d.revenue/d.qty).toFixed(2)]);

      /* Daily summary */
      const dayMap = {};
      filteredSales.forEach(s => {
        const day = s.sale_date?.slice(0,10);
        if (!dayMap[day]) dayMap[day] = { txns:0, revenue:0, profit:0 };
        dayMap[day].txns++;
        dayMap[day].revenue += s.total;
        dayMap[day].profit  += s.profit;
      });
      const dayHeader = ["Date", "Transactions", "Revenue (Rs)", "Profit (Rs)"];
      const dayRows = Object.entries(dayMap)
        .sort((a,b) => a[0].localeCompare(b[0]))
        .map(([day, d]) => [day, d.txns, +d.revenue.toFixed(2), +d.profit.toFixed(2)]);

      const wb = XLSX.utils.book_new();

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary["!cols"] = [{wch:25},{wch:30}];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

      const wsTx = XLSX.utils.aoa_to_sheet([txHeader, ...txRows]);
      applyHeaderStyle(wsTx, txHeader); autoWidth(wsTx);
      XLSX.utils.book_append_sheet(wb, wsTx, "Transactions");

      const wsItems = XLSX.utils.aoa_to_sheet([itemHeader, ...itemRows]);
      applyHeaderStyle(wsItems, itemHeader); autoWidth(wsItems);
      XLSX.utils.book_append_sheet(wb, wsItems, "Item Breakdown");

      const wsDay = XLSX.utils.aoa_to_sheet([dayHeader, ...dayRows]);
      applyHeaderStyle(wsDay, dayHeader); autoWidth(wsDay);
      XLSX.utils.book_append_sheet(wb, wsDay, "Daily Summary");

      XLSX.writeFile(wb, `Sales_Report_${today()}.xlsx`);
      notify("✅ Sales Report downloaded! (4 sheets)");
    } catch(e) { notify("❌ " + e.message); }
    setExporting("");
  };

  /* ── 3. PROFIT & LOSS ────────────────────── */
  const exportPL = () => {
    setExporting("pl");
    try {
      const totalRevenue  = sales.reduce((a,s)=>a+s.total,0);
      const totalProfit   = sales.reduce((a,s)=>a+s.profit,0);
      const totalCOGS     = totalRevenue - totalProfit;
      const totalExpenses = expenses.reduce((a,e)=>a+e.amount,0);
      const netProfit     = totalProfit - totalExpenses;

      const plData = [
        [`${getShopInfo().shop_name.toUpperCase()} — PROFIT & LOSS STATEMENT`],
        [`Generated: ${new Date().toLocaleString()}`],
        [],
        ["REVENUE", ""],
        ["Total Sales Revenue",              +totalRevenue.toFixed(2)],
        [],
        ["COST OF GOODS SOLD", ""],
        ["Cost of Goods Sold (COGS)",        +totalCOGS.toFixed(2)],
        [],
        ["GROSS PROFIT",                     +totalProfit.toFixed(2)],
        ["Gross Margin %",                   totalRevenue ? +(totalProfit/totalRevenue*100).toFixed(1) : 0],
        [],
        ["OPERATING EXPENSES", ""],
        ...expenses.map(e => [`  ${e.description}`, +e.amount.toFixed(2)]),
        ["Total Operating Expenses",         +totalExpenses.toFixed(2)],
        [],
        ["NET PROFIT / (LOSS)",              +netProfit.toFixed(2)],
        ["Net Margin %",                     totalRevenue ? +(netProfit/totalRevenue*100).toFixed(1) : 0],
        [],
        ["BALANCE SHEET SNAPSHOT", ""],
        ["Stock Value (at cost)",            +(items.reduce((a,i)=>a+i.qty*i.cost_price,0)).toFixed(2)],
        ["Total Credit Outstanding",         +(customers.reduce((a,c)=>a+c.balance,0)).toFixed(2)],
      ];

      const ws = XLSX.utils.aoa_to_sheet(plData);
      ws["!cols"] = [{wch:35},{wch:20}];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "P&L Statement");
      XLSX.writeFile(wb, `ProfitLoss_${today()}.xlsx`);
      notify("✅ P&L Statement downloaded!");
    } catch(e) { notify("❌ " + e.message); }
    setExporting("");
  };

  /* ── 4. UDHAAR REPORT ────────────────────── */
  const exportCredit = () => {
    setExporting("credit");
    try {
      const header = ["#", "Customer Name", "Phone", "Address", "Total Given (Rs)", "Total Received (Rs)", "Balance Due (Rs)", "Status"];
      const rows = customers.map((c,i) => [
        i+1, c.name, c.phone||"", c.address||"",
        +c.total_debit.toFixed(2), +c.total_payment.toFixed(2), +c.balance.toFixed(2),
        c.balance > 0 ? "Outstanding" : "Cleared",
      ]);
      const totalBalance = customers.reduce((a,c)=>a+c.balance,0);
      rows.push([], ["","TOTAL","","",
        +customers.reduce((a,c)=>a+c.total_debit,0).toFixed(2),
        +customers.reduce((a,c)=>a+c.total_payment,0).toFixed(2),
        +totalBalance.toFixed(2),
      ]);

      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      applyHeaderStyle(ws, header); autoWidth(ws);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Credit Book");
      XLSX.writeFile(wb, `CreditBook_${today()}.xlsx`);
      notify("✅ Credit Book downloaded!");
    } catch(e) { notify("❌ " + e.message); }
    setExporting("");
  };

  /* ── 5. FULL WORKBOOK ────────────────────── */
  const exportFull = () => {
    setExporting("full");
    try {
      const wb = XLSX.utils.book_new();

      /* Dashboard sheet */
      const totalRevenue  = sales.reduce((a,s)=>a+s.total,0);
      const totalProfit   = sales.reduce((a,s)=>a+s.profit,0);
      const totalExpenses = expenses.reduce((a,e)=>a+e.amount,0);
      const dashData = [
        [`${getShopInfo().shop_name.toUpperCase()} — COMPLETE REPORT`],
        [`Generated on: ${new Date().toLocaleString()}`],
        [],
        ["KPI",                   "Value"],
        ["Total Revenue",         +totalRevenue.toFixed(2)],
        ["Gross Profit",          +totalProfit.toFixed(2)],
        ["Net Profit",            +(totalProfit-totalExpenses).toFixed(2)],
        ["Total Expenses",        +totalExpenses.toFixed(2)],
        ["Total Sales (count)",   sales.length],
        ["Stock Items",           items.length],
        ["Total Stock (pieces)",  items.reduce((a,i)=>a+i.qty,0)],
        ["Stock Value",           +items.reduce((a,i)=>a+i.qty*i.cost_price,0).toFixed(2)],
        ["Credit Customers",      customers.length],
        ["Total Udhaar Outstanding", +customers.reduce((a,c)=>a+c.balance,0).toFixed(2)],
      ];
      const wsDash = XLSX.utils.aoa_to_sheet(dashData);
      wsDash["!cols"] = [{wch:28},{wch:20}];
      XLSX.utils.book_append_sheet(wb, wsDash, "Dashboard");

      /* Stock sheet */
      const stockH = ["#","Item","Category","Stock","Cost Price","Sale Price","Profit/pc","Stock Value","Sold","Status"];
      const stockR = items.map((it,i) => [
        i+1, it.name, it.category, it.qty, it.cost_price, it.sale_price,
        +(it.sale_price-it.cost_price).toFixed(2),
        +(it.qty*it.cost_price).toFixed(2),
        it.sold||0,
        it.qty===0?"Out of Stock":it.qty<10?"Low Stock":"In Stock",
      ]);
      const wsStock = XLSX.utils.aoa_to_sheet([stockH,...stockR]);
      applyHeaderStyle(wsStock,stockH); autoWidth(wsStock);
      XLSX.utils.book_append_sheet(wb, wsStock, "Stock");

      /* Sales sheet */
      const salesH = ["#","Date","Customer","Items","Revenue","Profit"];
      const salesR = sales.map((s,i) => [
        i+1,
        new Date(s.sale_date).toLocaleDateString(),
        s.customer,
        (s.items_json||[]).map(x=>x.name).join(", "),
        +s.total.toFixed(2),
        +s.profit.toFixed(2),
      ]);
      const wsSales = XLSX.utils.aoa_to_sheet([salesH,...salesR]);
      applyHeaderStyle(wsSales,salesH); autoWidth(wsSales);
      XLSX.utils.book_append_sheet(wb, wsSales, "Sales");

      /* Expenses sheet */
      const expH = ["#","Description","Amount (Rs)","Date"];
      const expR = expenses.map((e,i)=>[i+1, e.description, +e.amount.toFixed(2), new Date(e.expense_date).toLocaleDateString()]);
      const wsExp = XLSX.utils.aoa_to_sheet([expH,...expR]);
      applyHeaderStyle(wsExp,expH); autoWidth(wsExp);
      XLSX.utils.book_append_sheet(wb, wsExp, "Expenses");

      /* Credit sheet */
      const credH = ["#","Customer","Phone","Given","Received","Balance","Status"];
      const credR = customers.map((c,i)=>[
        i+1, c.name, c.phone||"",
        +c.total_debit.toFixed(2), +c.total_payment.toFixed(2), +c.balance.toFixed(2),
        c.balance>0?"Outstanding":"Cleared",
      ]);
      const wsCred = XLSX.utils.aoa_to_sheet([credH,...credR]);
      applyHeaderStyle(wsCred,credH); autoWidth(wsCred);
      XLSX.utils.book_append_sheet(wb, wsCred, "Credit Book");

      XLSX.writeFile(wb, `GeneralStore_FullReport_${today()}.xlsx`);
      notify("✅ Full Report downloaded! (5 sheets)");
    } catch(e) { notify("❌ " + e.message); }
    setExporting("");
  };

  if (loading) return <div className="page"><div className="loading">Loading data...</div></div>;

  const totalRevenue  = filteredSales.reduce((a,s)=>a+s.total,0);
  const totalProfit   = filteredSales.reduce((a,s)=>a+s.profit,0);
  const outstandingCredit = customers.reduce((a,c)=>a+c.balance,0);

  return (
    <div className="page">
      {msg && <div className="toast">{msg}</div>}

      <div className="page-header">
        <h1>📊 Reports & Excel Export</h1>
        <span className="date-badge">SheetJS Powered</span>
      </div>

      {/* Date filter */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 className="card-title">📅 Date Range (for Sales Report)</h2>
        <div className="row-2">
          <div>
            <label>From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label>To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="calc-box" style={{ marginTop: "8px" }}>
          Showing <strong>{filteredSales.length}</strong> sales |
          Revenue: <strong>{money(totalRevenue)}</strong> |
          Profit: <strong style={{ color: "var(--green)" }}>{money(totalProfit)}</strong>
        </div>
      </div>

      {/* Report cards grid */}
      <div className="reports-grid">

        {/* Stock Report */}
        <div className="report-card">
          <div className="report-icon">📦</div>
          <div className="report-info">
            <div className="report-title">Stock Report</div>
            <div className="report-desc">
              All items with cost, sale price, margin %, stock value, status.
              <br /><span className="report-meta">{items.length} items · {items.reduce((a,i)=>a+i.qty,0)} total pieces</span>
            </div>
          </div>
          <div className="report-sheets">1 sheet</div>
          <button
            className="report-btn"
            onClick={exportStock}
            disabled={!!exporting}
          >
            {exporting === "stock" ? <span className="btn-spinner" /> : "⬇️"} Download
          </button>
        </div>

        {/* Sales Report */}
        <div className="report-card">
          <div className="report-icon">🧾</div>
          <div className="report-info">
            <div className="report-title">Sales Report</div>
            <div className="report-desc">
              Summary, all transactions, item-wise breakdown & daily totals.
              <br /><span className="report-meta">{filteredSales.length} sales · {money(totalRevenue)} revenue</span>
            </div>
          </div>
          <div className="report-sheets">4 sheets</div>
          <button
            className="report-btn"
            onClick={exportSales}
            disabled={!!exporting}
          >
            {exporting === "sales" ? <span className="btn-spinner" /> : "⬇️"} Download
          </button>
        </div>

        {/* P&L */}
        <div className="report-card">
          <div className="report-icon">💹</div>
          <div className="report-info">
            <div className="report-title">Profit & Loss Statement</div>
            <div className="report-desc">
              Revenue, COGS, gross profit, expenses, net profit, margins.
              <br /><span className="report-meta">All time · {money(stats?.net_profit)} net profit</span>
            </div>
          </div>
          <div className="report-sheets">1 sheet</div>
          <button
            className="report-btn"
            onClick={exportPL}
            disabled={!!exporting}
          >
            {exporting === "pl" ? <span className="btn-spinner" /> : "⬇️"} Download
          </button>
        </div>

        {/* Credit Book */}
        <div className="report-card">
          <div className="report-icon">📒</div>
          <div className="report-info">
            <div className="report-title">Credit Book (Udhaar)</div>
            <div className="report-desc">
              All credit customers, amounts given, received & outstanding balance.
              <br /><span className="report-meta">{customers.length} customers · {money(outstandingCredit)} outstanding</span>
            </div>
          </div>
          <div className="report-sheets">1 sheet</div>
          <button
            className="report-btn"
            onClick={exportCredit}
            disabled={!!exporting}
          >
            {exporting === "credit" ? <span className="btn-spinner" /> : "⬇️"} Download
          </button>
        </div>

        {/* Full Workbook — spans full width */}
        <div className="report-card report-card-full">
          <div className="report-icon">🗂️</div>
          <div className="report-info">
            <div className="report-title">Complete Workbook</div>
            <div className="report-desc">
              Everything in one file — Dashboard, Stock, Sales, Expenses & Credit Book. Perfect for monthly backup.
              <br /><span className="report-meta">Dashboard · Stock · Sales · Expenses · Credit Book</span>
            </div>
          </div>
          <div className="report-sheets">5 sheets</div>
          <button
            className="report-btn report-btn-primary"
            onClick={exportFull}
            disabled={!!exporting}
          >
            {exporting === "full" ? <span className="btn-spinner" /> : "⬇️"} Download Full Report
          </button>
        </div>

      </div>

      {/* Quick stats */}
      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h2 className="card-title">📈 Quick Overview</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "12px" }}>
          {[
            { label: "Total Revenue",    value: money(stats?.total_revenue),  color: "var(--blue)"   },
            { label: "Gross Profit",     value: money(stats?.total_profit),   color: "var(--green)"  },
            { label: "Total Expenses",   value: money(stats?.total_expenses), color: "var(--red)"    },
            { label: "Net Profit",       value: money(stats?.net_profit),     color: stats?.net_profit >= 0 ? "var(--green)" : "var(--red)" },
            { label: "Stock Value",      value: money(stats?.stock_value),    color: "var(--amber)"  },
            { label: "Credit Due",       value: money(outstandingCredit),     color: "var(--orange)" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: "var(--radius)", padding: "12px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>{s.label}</div>
              <div style={{ fontSize: "17px", fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
