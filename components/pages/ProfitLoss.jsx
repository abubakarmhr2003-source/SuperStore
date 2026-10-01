import { useEffect, useState } from "react";
import { api } from "../utils/api";
export default function ProfitLoss() {
  const [stats, setStats] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [desc, setDesc] = useState(""); const [amount, setAmount] = useState(""); const [msg, setMsg] = useState("");
  const load = () => Promise.all([api.getStats(), api.getExpenses()]).then(([s,e])=>{setStats(s);setExpenses(e);});
  useEffect(()=>{load();},[]);
  const notify = m => { setMsg(m); setTimeout(()=>setMsg(""),3000); };
  const addExp = async () => {
    if(!desc.trim()||!amount) return notify("❌ Enter description and amount");
    await api.addExpense({description:desc,amount:+amount}); setDesc(""); setAmount(""); load(); notify("✅ Expense added");
  };
  const delExp = async id => { if(!confirm("Delete?")) return; await api.deleteExpense(id); load(); notify("🗑️ Deleted"); };
  if(!stats) return <div className="page"><div className="loading">Loading...</div></div>;
  const totalExp = expenses.reduce((a,e)=>a+e.amount,0);
  const netProfit = stats.total_profit - totalExp;
  return (
    <div className="page">
      {msg&&<div className="toast">{msg}</div>}
      <div className="page-header"><h1>Profit & Loss</h1></div>
      <div className="metrics-grid" style={{marginBottom:"1.5rem"}}>
        <div className="metric-card metric-blue"><span className="metric-icon">💵</span><div className="metric-label">Total Revenue</div><div className="metric-value">Rs. {stats.total_revenue.toLocaleString()}</div></div>
        <div className="metric-card metric-green"><span className="metric-icon">📈</span><div className="metric-label">Gross Profit</div><div className="metric-value">Rs. {stats.total_profit.toLocaleString()}</div></div>
        <div className="metric-card metric-red"><span className="metric-icon">📤</span><div className="metric-label">Total Expenses</div><div className="metric-value">Rs. {totalExp.toLocaleString()}</div></div>
        <div className={`metric-card ${netProfit>=0?"metric-teal":"metric-red"}`}><span className="metric-icon">{netProfit>=0?"📈":"📉"}</span><div className="metric-label">Net Profit/Loss</div><div className="metric-value">Rs. {netProfit.toLocaleString()}</div></div>
      </div>
      <div className="card" style={{marginBottom:"1rem"}}>
        <h2 className="card-title">P&L Summary</h2>
        {[["Sales Revenue","",stats.total_revenue,""],["− Cost of Goods","muted",stats.total_revenue-stats.total_profit,""],["= Gross Profit","green",stats.total_profit,""],["− Operating Expenses","muted",totalExp,""],["= Net Profit / Loss",netProfit>=0?"green":"red",netProfit,"bold"]].map(([label,cls,val,extra])=>(
          <div key={label} className={`pl-row ${cls} ${extra}`}><span>{label}</span><span>Rs. {val.toLocaleString()}</span></div>
        ))}
      </div>
      <div className="two-col">
        <div className="card">
          <h2 className="card-title">➕ Add Expense</h2>
          <p style={{fontSize:"12px",color:"var(--text2)",marginBottom:"8px"}}>Electricity, rent, staff salary, etc.</p>
          <label>Description</label><input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Electricity bill, Shop rent" />
          <label>Amount (Rs.)</label><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" />
          <button className="btn-primary full-width" onClick={addExp}>Add Expense</button>
        </div>
        <div className="card">
          <h2 className="card-title">📋 Expense List</h2>
          {expenses.length===0?<div className="empty">No expenses recorded</div>:
            expenses.map(e=>(
              <div key={e.id} className="expense-row">
                <div><div style={{fontSize:"13px",fontWeight:600}}>{e.description}</div><div style={{fontSize:"11px",color:"var(--text2)"}}>{new Date(e.expense_date).toLocaleDateString()}</div></div>
                <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                  <span className="red bold">Rs. {e.amount.toLocaleString()}</span>
                  <button className="btn-sm btn-danger" onClick={()=>delExp(e.id)}>×</button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
