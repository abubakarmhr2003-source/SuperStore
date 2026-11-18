import { useEffect, useState } from "react";
import { api, creditApi } from "../utils/api";
import { getShopInfo } from "../utils/shopInfo";
import { showBill, billRate } from "../utils/printDoc";

// Opens the bill in an in-page overlay (works on mobile — no popup needed).
function openBill({ billItems, customer, phone, billNo, saleDate, prevBalance }) {
  showBill({ shop: getShopInfo(), billNo, date: saleDate, customer, phone, items: billItems, prevBalance });
}

function genBillNo() {
  const n = new Date();
  return "INV-"+n.getFullYear().toString().slice(2)+String(n.getMonth()+1).padStart(2,"0")+String(n.getDate()).padStart(2,"0")+"-"+String(Math.floor(Math.random()*9000)+1000);
}

export default function Billing() {
  const [items, setItems] = useState([]);
  const [billItems, setBillItems] = useState([]);
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [selItem, setSelItem] = useState("");
  const [search, setSearch] = useState("");
  const [showList, setShowList] = useState(false);
  const [qty, setQty] = useState("");
  const [msg, setMsg] = useState("");
  const [billNo, setBillNo] = useState(genBillNo());
  const [loading, setLoading] = useState(false);
  const [creditCustomers, setCreditCustomers] = useState([]);
  const [isUdhaar, setIsUdhaar] = useState(false);
  const [udhaarCustId, setUdhaarCustId] = useState("");
  const [custSearch, setCustSearch] = useState("");
  const [showCustList, setShowCustList] = useState(false);
  const [shopBrand] = useState(getShopInfo());

  const load = () => {
    api.getItems().then(d=>setItems(d.filter(i=>i.qty>0)));
    creditApi.getCustomers().then(setCreditCustomers);
  };
  useEffect(()=>{load();},[]);
  const notify = m => { setMsg(m); setTimeout(()=>setMsg(""),4000); };

  const addToBill = () => {
    if(!selItem) return notify("❌ Please select an item");
    const item = items.find(i=>i.id===+selItem);
    if(!item) return;
    const n = Math.floor(+qty);
    if(!(n>=1)) return notify("❌ Please enter quantity");
    const existing = billItems.find(b=>b.id===item.id);
    const already = existing?existing.qty:0;
    if(already+n>item.qty) return notify(`❌ Only ${item.qty-already} piece(s) available`);
    if(existing) setBillItems(billItems.map(b=>b.id===item.id?{...b,qty:b.qty+n}:b));
    else setBillItems([...billItems,{id:item.id,name:item.name,sale_price:item.sale_price,cost_price:item.cost_price,qty:n,discount:0}]);
    setSelItem(""); setSearch(""); setShowList(false); setQty("");
  };

  const q = search.trim().toLowerCase();
  const matches = items.filter(i => !q || i.name.toLowerCase().includes(q));
  // Credit customer search: by name or phone number
  const cq = custSearch.trim().toLowerCase();
  const cqDigits = cq.replace(/\D/g, "");
  const custMatches = creditCustomers.filter(c => !cq
    || c.name.toLowerCase().includes(cq)
    || (cqDigits && String(c.phone||"").replace(/\D/g, "").includes(cqDigits)));
  const pickCust = c => { setUdhaarCustId(String(c.id)); setCustSearch(c.name); setShowCustList(false); };
  const clearCust = () => { setUdhaarCustId(""); setCustSearch(""); };
  const pickItem = i => { setSelItem(String(i.id)); setSearch(i.name); setShowList(false); };

  const setDiscount = (id, value) => {
    setBillItems(billItems.map(b=>{
      if(b.id!==id) return b;
      const gross = b.qty*b.sale_price;
      const disc = Math.max(0, Math.min(gross, +value || 0));
      return {...b, discount: disc};
    }));
  };

  const subtotal      = billItems.reduce((a,b)=>a+b.sale_price*b.qty,0);
  const totalDiscount = billItems.reduce((a,b)=>a+(b.discount||0),0);
  const total  = subtotal - totalDiscount;           // this bill only (goes to sales / credit book)
  const udhaarCust  = isUdhaar ? creditCustomers.find(c=>c.id===+udhaarCustId) : null;
  const prevBalance = udhaarCust && udhaarCust.balance>0 ? udhaarCust.balance : 0;   // customer's old unpaid balance
  const grandTotal  = total + prevBalance;
  const billCustomer = customer.trim() || udhaarCust?.name || "Walk-in Customer";
  const billPhone    = phone.trim() || udhaarCust?.phone || "";
  const profit = billItems.reduce((a,b)=>a+(b.cost_price>0?(b.sale_price-b.cost_price)*b.qty-(b.discount||0):0),0);   // no purchase price = profit not counted

  const confirmSale = async () => {
    if(!billItems.length) return notify("❌ Please add at least one item");
    const noPrice = billItems.find(b=>!(+b.sale_price>0));
    if(noPrice) return notify(`❌ Please enter a price for ${noPrice.name}`);
    if(isUdhaar&&!udhaarCustId) return notify("❌ Please select a credit customer");
    setLoading(true);
    try {
      const sale = await api.createSale({ customer:billCustomer, prev_balance:prevBalance, items:billItems.map(b=>({item_id:b.id,qty:b.qty,price:b.sale_price,discount:b.discount||0})) });
      if(isUdhaar&&udhaarCustId) {
        await creditApi.addEntry({ customer_id:+udhaarCustId, type:"debit", amount:total, description:`Credit sale - ${billNo}`, sale_id:sale.id }).catch(()=>{});
      }
      openBill({ billItems, customer:billCustomer, phone:billPhone, billNo, saleDate:sale.sale_date, prevBalance });
      notify(`✅ Sale confirmed! Total: Rs.${grandTotal.toFixed(0)} | Profit: Rs.${profit.toFixed(0)}${isUdhaar?" | Added to credit book":""}`);
      setBillItems([]); setCustomer(""); setPhone(""); setBillNo(genBillNo()); setIsUdhaar(false); setUdhaarCustId(""); setCustSearch(""); setShowCustList(false); load();
    } catch(e) { notify("❌ "+e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="page">
      <div className="page-header"><h1>Billing</h1><span className="date-badge">{billNo}</span></div>
      {msg&&<div className="toast">{msg}</div>}
      <div className="two-col">
        <div className="card">
          <h2 className="card-title">🛍️ Add Items to Invoice</h2>
          <div className="row-2">
            <div><label>Customer Name</label><input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Walk-in Customer" /></div>
            <div><label>Phone No.</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Optional" /></div>
          </div>
          <label>Select Item</label>
          <div className="item-search">
            <input
              value={search}
              placeholder="🔍 Type to search item..."
              autoComplete="off"
              onChange={e=>{setSearch(e.target.value); setSelItem(""); setShowList(true);}}
              onFocus={()=>setShowList(true)}
              onBlur={()=>setShowList(false)}
              onKeyDown={e=>{
                if(e.key==="Enter"){ e.preventDefault(); if(showList && matches.length) pickItem(matches[0]); else addToBill(); }
                if(e.key==="Escape") setShowList(false);
              }}
            />
            {selItem && <button type="button" className="item-search-clear" onMouseDown={e=>{e.preventDefault(); setSelItem(""); setSearch(""); setShowList(true);}}>×</button>}
            {showList && (
              <div className="item-search-list">
                {matches.length===0
                  ? <div className="item-search-empty">No item found</div>
                  : matches.map(i=>(
                    <div key={i.id} className={"item-search-opt"+(String(i.id)===selItem?" active":"")}
                      onMouseDown={e=>{e.preventDefault(); pickItem(i);}}>
                      <span>{i.name}</span>
                      <small>{i.qty} in stock{i.sale_price>0?` · Rs.${i.sale_price}`:""}</small>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <label>Quantity</label>
          <input type="number" min="1" value={qty} placeholder="0"
            onChange={e=>setQty(e.target.value)}
            onFocus={e=>e.target.select()}
            onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addToBill(); } }} />
          <button className="btn-primary full-width" onClick={addToBill}>+ Add to Bill</button>

          {billItems.length>0&&<>
            <div style={{marginTop:"1.25rem"}}>
              <div style={{fontSize:"11px",fontWeight:700,color:"var(--text2)",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"8px"}}>Bill Items ({billItems.length})</div>
              {billItems.map(b=>{
                const gross = b.qty*b.sale_price;
                return (
                <div key={b.id} className="bill-row" style={{flexWrap:"wrap"}}>
                  <span className="bill-name">{b.name}</span>
                  <div className="bill-qty-ctrl">
                    <button className="qty-btn" onClick={()=>{if(b.qty>1){const newQty=b.qty-1;const newGross=newQty*b.sale_price;setBillItems(billItems.map(x=>x.id===b.id?{...x,qty:newQty,discount:Math.min(x.discount||0,newGross)}:x));}}}>−</button>
                    <input type="number" min="1" value={b.qty}
                      onFocus={e=>e.target.select()}
                      onChange={e=>{
                        const item=items.find(i=>i.id===b.id);
                        let n=Math.floor(+e.target.value)||1;
                        if(n<1) n=1;
                        if(item && n>item.qty){ n=item.qty; notify(`❌ Only ${item.qty} piece(s) available`); }
                        const g=n*b.sale_price;
                        setBillItems(billItems.map(x=>x.id===b.id?{...x,qty:n,discount:Math.min(x.discount||0,g)}:x));
                      }}
                      style={{width:"58px",textAlign:"center",fontWeight:700,padding:"4px 6px",fontSize:"13px",marginBottom:0}} />
                    <button className="qty-btn" onClick={()=>{const item=items.find(i=>i.id===b.id);if(!item||b.qty<item.qty)setBillItems(billItems.map(x=>x.id===b.id?{...x,qty:x.qty+1}:x));}}>+</button>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"4px",flexShrink:0}}>
                    <span style={{fontSize:"10px",color:"var(--text2)"}}>Price {shopBrand.currency_symbol}</span>
                    <input type="number" min="0" value={b.sale_price||""} placeholder="0"
                      onFocus={e=>e.target.select()}
                      onChange={e=>{const v=Math.max(0,+e.target.value||0);setBillItems(billItems.map(x=>x.id===b.id?{...x,sale_price:v,discount:Math.min(x.discount||0,x.qty*v)}:x));}}
                      style={{width:"66px",padding:"4px 6px",fontSize:"12px",fontWeight:700,marginBottom:0}} />
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"4px",flexShrink:0}}>
                    <span style={{fontSize:"10px",color:"var(--text2)"}}>Disc {shopBrand.currency_symbol}</span>
                    <input type="number" min="0" max={gross} value={b.discount||""} placeholder="0"
                      onChange={e=>setDiscount(b.id,e.target.value)}
                      style={{width:"58px",padding:"4px 6px",fontSize:"11px",marginBottom:0}} />
                  </div>
                  <span className="bill-amount">Rs. {(gross-(b.discount||0)).toFixed(0)}</span>
                  <button className="btn-sm btn-danger" onClick={()=>setBillItems(billItems.filter(x=>x.id!==b.id))}>×</button>
                </div>
              );})}
            </div>
            <div className="bill-summary">
              {totalDiscount>0 && <div className="bill-profit-row"><span>Subtotal</span><span>Rs. {subtotal.toFixed(0)}</span></div>}
              {totalDiscount>0 && <div className="bill-profit-row"><span>Discount</span><span style={{color:"var(--red)"}}>− Rs. {totalDiscount.toFixed(0)}</span></div>}
              {prevBalance>0 && <div className="bill-profit-row"><span>Bill Total</span><span>Rs. {total.toFixed(0)}</span></div>}
              {prevBalance>0 && <div className="bill-profit-row"><span>Previous Balance</span><span style={{color:"var(--red)"}}>+ Rs. {prevBalance.toFixed(0)}</span></div>}
              <div className="bill-total-row"><span>{prevBalance>0?"Grand Total":"Total"}</span><span>Rs. {grandTotal.toFixed(0)}</span></div>
              <div className="bill-profit-row"><span>Profit</span><span className="green">Rs. {profit.toFixed(0)}</span></div>
            </div>
            <div className="udhaar-toggle-box">
              <label style={{marginTop:0,display:"flex",alignItems:"center",gap:"9px",cursor:"pointer",fontSize:"13px",fontWeight:700,color:isUdhaar?"var(--red)":"var(--text2)"}}>
                <input type="checkbox" checked={isUdhaar} onChange={e=>{setIsUdhaar(e.target.checked); if(!e.target.checked) clearCust();}} style={{width:"16px",height:"16px",cursor:"pointer",marginBottom:0,accentColor:"var(--red)"}} />
                📒 This is a Credit Sale (Udhaar)
              </label>
              {isUdhaar&&<div style={{marginTop:"10px"}}>
                <div className="item-search" style={{marginBottom:0}}>
                  <input
                    value={custSearch}
                    placeholder="🔍 Search customer by name or phone..."
                    autoComplete="off"
                    onChange={e=>{setCustSearch(e.target.value); setUdhaarCustId(""); setShowCustList(true);}}
                    onFocus={()=>setShowCustList(true)}
                    onBlur={()=>setShowCustList(false)}
                    onKeyDown={e=>{
                      if(e.key==="Enter"){ e.preventDefault(); if(showCustList && custMatches.length) pickCust(custMatches[0]); }
                      if(e.key==="Escape") setShowCustList(false);
                    }}
                  />
                  {(udhaarCustId||custSearch) && <button type="button" className="item-search-clear" onMouseDown={e=>{e.preventDefault(); clearCust(); setShowCustList(true);}}>×</button>}
                  {showCustList && (
                    <div className="item-search-list">
                      {custMatches.length===0
                        ? <div className="item-search-empty">No customer found</div>
                        : custMatches.map(c=>(
                          <div key={c.id} className={"item-search-opt"+(String(c.id)===udhaarCustId?" active":"")}
                            onMouseDown={e=>{e.preventDefault(); pickCust(c);}}>
                            <span>{c.name}{c.phone?<small style={{display:"block"}}>{c.phone}</small>:null}</span>
                            <small style={{color:c.balance>0?"var(--red)":"var(--text2)",fontWeight:700}}>Rs. {c.balance.toFixed(0)}</small>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                {udhaarCust && <div style={{fontSize:"11px",color:"var(--text2)",marginTop:"6px"}}>✅ {udhaarCust.name}{udhaarCust.phone?` · ${udhaarCust.phone}`:""} — Previous balance: <strong style={{color:udhaarCust.balance>0?"var(--red)":"var(--green)"}}>Rs. {udhaarCust.balance.toFixed(0)}</strong></div>}
                {!creditCustomers.length&&<div style={{fontSize:"11px",color:"var(--red)",marginTop:"4px"}}>No credit customers. Add one in Credit Book first.</div>}
              </div>}
            </div>
            <button className="btn-success full-width" style={{fontSize:"14px",padding:"13px",letterSpacing:"0.02em"}} onClick={confirmSale} disabled={loading}>
              {loading?"Processing...":isUdhaar?"📒 Confirm Credit Sale & Print Bill":"✅ Confirm Sale & Generate Bill"}
            </button>
            <button className="btn-outline full-width" style={{marginTop:"6px"}} onClick={()=>{if(billItems.length)openBill({billItems,customer:billCustomer,phone:billPhone,billNo,prevBalance});}}>🖨️ Preview Bill</button>
            <button className="btn-sm btn-danger" style={{marginTop:"8px",width:"100%",padding:"8px"}} onClick={()=>{if(confirm("Clear all items?"))setBillItems([]);}}>🗑️ Clear Bill</button>
          </>}
        </div>

        <div className="card">
          <h2 className="card-title">🧾 Live Invoice Preview</h2>
          {billItems.length===0
            ?<div className="empty"><div style={{fontSize:"48px",marginBottom:"12px"}}>🧾</div>Add items to see preview</div>
            :<div className="receipt">
              <div className="receipt-header">
                <div className="receipt-shop">🏪 {shopBrand.shop_name.toUpperCase()}</div>
                <div className="receipt-meta" style={{fontSize:"10px",marginBottom:"8px"}}>{shopBrand.shop_tagline}</div>
                <div style={{borderTop:"2px solid var(--border2)",margin:"8px 0"}}/>
                {[["Invoice",billNo],["Date",new Date().toLocaleDateString()],["Customer",billCustomer],...(billPhone?[["Phone",billPhone]]:[])].map(([l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:"11px",marginBottom:"2px"}}>
                    <span style={{color:"var(--text2)"}}>{l}:</span><strong>{v}</strong>
                  </div>
                ))}
              </div>
              <div className="receipt-divider"/>
              <table className="receipt-table">
                <thead><tr><th style={{width:"38%"}}>Item</th><th style={{textAlign:"center"}}>Qty</th><th style={{textAlign:"right"}}>Rate</th><th style={{textAlign:"right"}}>Amt</th></tr></thead>
                <tbody>{billItems.map(b=><tr key={b.id}><td>{b.name}</td><td style={{textAlign:"center"}}>{b.qty}</td><td style={{textAlign:"right"}}>{shopBrand.currency_symbol}{billRate(b)}</td><td style={{textAlign:"right"}}><strong>{shopBrand.currency_symbol}{(b.qty*b.sale_price-(b.discount||0)).toFixed(0)}</strong></td></tr>)}</tbody>
              </table>
              <div className="receipt-divider"/>
              {prevBalance>0 && <div style={{display:"flex",justifyContent:"space-between",fontSize:"11px",color:"var(--text2)",marginBottom:"2px"}}><span>Subtotal</span><span>{shopBrand.currency_symbol} {total.toFixed(0)}</span></div>}
              {prevBalance>0 && <div style={{display:"flex",justifyContent:"space-between",fontSize:"11px",color:"var(--text2)",marginBottom:"6px"}}><span>Previous Balance</span><span>{shopBrand.currency_symbol} {prevBalance.toFixed(0)}</span></div>}
              <div className="receipt-total"><span>TOTAL</span><span>{shopBrand.currency_symbol} {grandTotal.toFixed(0)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:"11px",color:"var(--green)",marginTop:"4px",fontStyle:"italic"}}><span>(Profit — not printed)</span><span>{shopBrand.currency_symbol} {profit.toFixed(0)}</span></div>
              <div className="receipt-footer">★ Thank you for your purchase! ★<br/><span style={{fontSize:"10px"}}>Please visit again</span></div>
            </div>}
        </div>
      </div>
    </div>
  );
}
