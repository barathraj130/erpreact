import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaHandshake, FaArrowLeft, FaArrowRight, FaPlus, FaTrash, FaExclamationTriangle, FaCheck } from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import { fetchCustomers, Customer } from "../../api/userApi";
import "../PageShared.css";

interface OutstandingInvoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  balance_amount: number;
  status: string;
}

interface GoodsItem { description: string; quantity: number; unit: string; condition: string; rate: number; total_value: number; stock_type: string; notes: string; }
interface AssetItem { asset_name: string; asset_type: string; condition: string; weight_grams: string; purity_percent: string; rate_per_gram: string; customer_claimed_value: string; agreed_value: string; serial_number: string; document_number: string; needs_legal_transfer: boolean; notes: string; }
interface ChequeItem { bank_name: string; account_holder: string; cheque_number: string; cheque_date: string; amount: string; }

const ASSET_TYPES = ["Gold", "Silver", "Machine", "Vehicle", "Land", "Property", "Electronics", "Furniture", "Other"];

const emptyGoods = (): GoodsItem => ({ description: "", quantity: 1, unit: "pcs", condition: "good", rate: 0, total_value: 0, stock_type: "fresh", notes: "" });
const emptyAsset = (): AssetItem => ({ asset_name: "", asset_type: "Gold", condition: "good", weight_grams: "", purity_percent: "", rate_per_gram: "", customer_claimed_value: "", agreed_value: "", serial_number: "", document_number: "", needs_legal_transfer: false, notes: "" });
const emptyCheque = (): ChequeItem => ({ bank_name: "", account_holder: "", cheque_number: "", cheque_date: "", amount: "" });

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

const label: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", marginBottom: 5, letterSpacing: 0.3 };
const input: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-soft)", fontSize: 13, boxSizing: "border-box", background: "var(--surface)", color: "var(--text-1)" };
const sectionCard: React.CSSProperties = { border: "1px solid var(--border-soft)", borderRadius: 10, padding: 16, marginBottom: 14 };

export default function NewSettlement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get("customer_id");

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(preselected ? Number(preselected) : null);
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([]);
  const [allocations, setAllocations] = useState<Record<number, string>>({});

  // Step 2
  const [useCash, setUseCash] = useState(false);
  const [useGoods, setUseGoods] = useState(false);
  const [useAssets, setUseAssets] = useState(false);
  const [useCheques, setUseCheques] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [goodsItems, setGoodsItems] = useState<GoodsItem[]>([emptyGoods()]);
  const [assetItems, setAssetItems] = useState<AssetItem[]>([emptyAsset()]);
  const [chequeItems, setChequeItems] = useState<ChequeItem[]>([emptyCheque()]);

  // Step 3
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchCustomers().then((data) => setCustomers(Array.isArray(data) ? data : [])).catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    if (!customerId) { setInvoices([]); return; }
    apiFetch(`/settlements/customers/${customerId}/outstanding`)
      .then((r) => r.json())
      .then((data) => { setInvoices(Array.isArray(data) ? data : []); setAllocations({}); })
      .catch(() => setInvoices([]));
  }, [customerId]);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return [];
    const q = customerSearch.toLowerCase();
    return customers.filter((c) => (c.nickname || c.username || "").toLowerCase().includes(q) || (c.phone || "").includes(q)).slice(0, 8);
  }, [customerSearch, customers]);

  const totalAllocated = Object.values(allocations).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const goodsTotal = goodsItems.reduce((s, g) => s + (Number(g.total_value) || 0), 0);
  const assetTotal = assetItems.reduce((s, a) => s + (Number(a.agreed_value) || 0), 0);
  const chequeTotal = chequeItems.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const cashTotal = Number(cashAmount) || 0;
  const totalValue = (useCash ? cashTotal : 0) + (useGoods ? goodsTotal : 0) + (useAssets ? assetTotal : 0) + (useCheques ? chequeTotal : 0);
  const difference = Math.round((totalAllocated - totalValue) * 100) / 100;
  const hasLandOrProperty = useAssets && assetItems.some((a) => ["Land", "Property"].includes(a.asset_type) || a.needs_legal_transfer);

  const settlementType = useMemo(() => {
    const parts: string[] = [];
    if (useCash) parts.push("cash");
    if (useGoods) parts.push("goods");
    if (useAssets) parts.push("asset");
    if (useCheques) parts.push("cheque");
    if (parts.length > 1) return "mixed";
    if (parts[0] === "cash") return "cash_partial";
    return parts[0] || "cash_partial";
  }, [useCash, useGoods, useAssets, useCheques]);

  const canGoStep2 = !!customerId && totalAllocated > 0;
  const canGoStep3 = totalValue > 0;
  const canSubmit = difference === 0 && totalValue > 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await apiFetch("/settlements", {
        method: "POST",
        body: {
          customer_id: customerId,
          settlement_type: settlementType,
          notes,
          cash_amount: useCash ? cashTotal : 0,
          goods_items: useGoods ? goodsItems.filter((g) => g.description) : [],
          asset_items: useAssets ? assetItems.filter((a) => a.asset_name) : [],
          cheque_items: useCheques ? chequeItems.filter((c) => c.cheque_number) : [],
          invoice_links: Object.entries(allocations)
            .filter(([, v]) => parseFloat(v) > 0)
            .map(([invoiceId, v]) => ({ invoice_id: Number(invoiceId), amount_allocated: parseFloat(v) })),
        },
      });
      const data = await res.json();
      if (data.success) {
        navigate(`/settlements/${data.settlement_id}`);
      } else {
        setError(data.error || "Failed to create settlement");
      }
    } catch (e: any) {
      setError(e.message || "Failed to create settlement");
    } finally {
      setSubmitting(false);
    }
  };

  const StepDot = ({ n, label: l }: { n: number; label: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: step >= n ? 1 : 0.4 }}>
      <div style={{
        width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        background: step > n ? "#16a34a" : step === n ? "#4f46e5" : "var(--surface-2)",
        color: step >= n ? "#fff" : "var(--text-3)", fontWeight: 700, fontSize: 12, flexShrink: 0,
      }}>
        {step > n ? <FaCheck size={10} /> : n}
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)" }}>{l}</span>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div className="page-header">
        <div>
          <h1><FaHandshake style={{ marginRight: 10, opacity: 0.7 }} />New Debt Settlement</h1>
          <p>Record what a customer is giving in place of cash to reduce their outstanding balance.</p>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", margin: "20px 0 24px", padding: "0 8px" }}>
        <StepDot n={1} label="Customer & Invoices" />
        <StepDot n={2} label="What They're Giving" />
        <StepDot n={3} label="Review" />
        <StepDot n={4} label="Confirm" />
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ background: "var(--surface)", border: "1px solid var(--border-soft)", borderRadius: 12, padding: 24 }}>
        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div>
            <h3 style={{ margin: "0 0 14px", fontSize: 14 }}>Customer</h3>
            {selectedCustomer ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 8, background: "var(--surface-2)", marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedCustomer.nickname || selectedCustomer.username}</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>{selectedCustomer.phone || "No phone"} · Balance: {fmt(Number(selectedCustomer.remaining_balance) || 0)}</div>
                </div>
                <button className="page-btn-round-sm" onClick={() => { setCustomerId(null); setCustomerSearch(""); }}>Change</button>
              </div>
            ) : (
              <div style={{ position: "relative", marginBottom: 16 }}>
                <input
                  style={input}
                  placeholder="Search customer by name or phone…"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                {filteredCustomers.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border-soft)", borderRadius: 8, marginTop: 4, zIndex: 10, maxHeight: 220, overflowY: "auto", boxShadow: "0 8px 20px rgba(0,0,0,0.1)" }}>
                    {filteredCustomers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => { setCustomerId(c.id); setCustomerSearch(""); }}
                        style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border-soft)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nickname || c.username}</div>
                        <div style={{ fontSize: 11, color: "var(--text-2)" }}>{c.phone || "—"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {customerId && (
              <>
                <h3 style={{ margin: "20px 0 10px", fontSize: 14 }}>Outstanding Invoices</h3>
                {invoices.length === 0 ? (
                  <div className="page-empty">No outstanding invoices for this customer.</div>
                ) : (
                  <div className="page-table-wrapper">
                    <table className="page-table">
                      <thead>
                        <tr><th></th><th>Invoice #</th><th>Date</th><th className="text-right">Balance</th><th className="text-right">Allocate</th></tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv) => (
                          <tr key={inv.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={allocations[inv.id] !== undefined}
                                onChange={(e) => {
                                  setAllocations((prev) => {
                                    const next = { ...prev };
                                    if (e.target.checked) next[inv.id] = String(inv.balance_amount);
                                    else delete next[inv.id];
                                    return next;
                                  });
                                }}
                              />
                            </td>
                            <td className="font-mono">{inv.invoice_number}</td>
                            <td>{new Date(inv.invoice_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                            <td className="text-right">{fmt(Number(inv.balance_amount))}</td>
                            <td className="text-right" style={{ width: 130 }}>
                              <input
                                type="number"
                                disabled={allocations[inv.id] === undefined}
                                value={allocations[inv.id] ?? ""}
                                onChange={(e) => setAllocations((prev) => ({ ...prev, [inv.id]: e.target.value }))}
                                style={{ ...input, textAlign: "right", padding: "5px 8px" }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ textAlign: "right", marginTop: 12, fontSize: 14, fontWeight: 700 }}>
                  Total Allocated: <span style={{ color: "#4f46e5" }}>{fmt(totalAllocated)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div>
            <h3 style={{ margin: "0 0 16px", fontSize: 14 }}>What Are They Giving?</h3>

            {/* CASH */}
            <div style={sectionCard}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={useCash} onChange={(e) => setUseCash(e.target.checked)} /> Cash
              </label>
              {useCash && (
                <div style={{ marginTop: 10 }}>
                  <label style={label}>Amount</label>
                  <input type="number" style={{ ...input, maxWidth: 220 }} value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="0" />
                </div>
              )}
            </div>

            {/* GOODS */}
            <div style={sectionCard}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={useGoods} onChange={(e) => setUseGoods(e.target.checked)} /> Goods
              </label>
              {useGoods && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  {goodsItems.map((g, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 0.7fr 1fr 0.8fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                      <div><label style={label}>Description</label><input style={input} value={g.description} onChange={(e) => setGoodsItems((p) => p.map((x, xi) => xi === i ? { ...x, description: e.target.value } : x))} /></div>
                      <div><label style={label}>Qty</label><input type="number" style={input} value={g.quantity} onChange={(e) => setGoodsItems((p) => p.map((x, xi) => xi === i ? { ...x, quantity: Number(e.target.value) } : x))} /></div>
                      <div>
                        <label style={label}>Condition</label>
                        <select style={input} value={g.condition} onChange={(e) => setGoodsItems((p) => p.map((x, xi) => xi === i ? { ...x, condition: e.target.value } : x))}>
                          <option value="new">New</option><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option>
                        </select>
                      </div>
                      <div><label style={label}>Rate</label><input type="number" style={input} value={g.rate} onChange={(e) => setGoodsItems((p) => p.map((x, xi) => xi === i ? { ...x, rate: Number(e.target.value) } : x))} /></div>
                      <div><label style={label}>Total</label><input type="number" style={input} value={g.total_value} onChange={(e) => setGoodsItems((p) => p.map((x, xi) => xi === i ? { ...x, total_value: Number(e.target.value) } : x))} /></div>
                      <div>
                        <label style={label}>Stock Type</label>
                        <select style={input} value={g.stock_type} onChange={(e) => setGoodsItems((p) => p.map((x, xi) => xi === i ? { ...x, stock_type: e.target.value } : x))}>
                          <option value="fresh">Fresh</option><option value="mistake">Mistake</option>
                        </select>
                      </div>
                      <button className="page-btn-round-danger" onClick={() => setGoodsItems((p) => p.filter((_, xi) => xi !== i))}><FaTrash size={11} /></button>
                    </div>
                  ))}
                  <button className="page-btn-round" style={{ alignSelf: "flex-start" }} onClick={() => setGoodsItems((p) => [...p, emptyGoods()])}><FaPlus size={10} /> Add Item</button>
                </div>
              )}
            </div>

            {/* ASSETS */}
            <div style={sectionCard}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={useAssets} onChange={(e) => setUseAssets(e.target.checked)} /> Assets
              </label>
              {useAssets && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>
                  {assetItems.map((a, i) => {
                    const isPreciousMetal = a.asset_type === "Gold" || a.asset_type === "Silver";
                    const isLandOrProperty = a.asset_type === "Land" || a.asset_type === "Property";
                    const calcValue = isPreciousMetal ? (Number(a.weight_grams) || 0) * (Number(a.purity_percent) || 0) / 100 * (Number(a.rate_per_gram) || 0) : null;
                    return (
                      <div key={i} style={{ border: "1px solid var(--border-soft)", borderRadius: 8, padding: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                          <div><label style={label}>Asset Name</label><input style={input} value={a.asset_name} onChange={(e) => setAssetItems((p) => p.map((x, xi) => xi === i ? { ...x, asset_name: e.target.value } : x))} /></div>
                          <div>
                            <label style={label}>Asset Type</label>
                            <select style={input} value={a.asset_type} onChange={(e) => setAssetItems((p) => p.map((x, xi) => xi === i ? { ...x, asset_type: e.target.value } : x))}>
                              {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={label}>Condition</label>
                            <select style={input} value={a.condition} onChange={(e) => setAssetItems((p) => p.map((x, xi) => xi === i ? { ...x, condition: e.target.value } : x))}>
                              <option value="new">New</option><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option>
                            </select>
                          </div>
                        </div>

                        {isPreciousMetal && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                            <div><label style={label}>Weight (g)</label><input type="number" style={input} value={a.weight_grams} onChange={(e) => setAssetItems((p) => p.map((x, xi) => xi === i ? { ...x, weight_grams: e.target.value } : x))} /></div>
                            <div><label style={label}>Purity %</label><input type="number" style={input} value={a.purity_percent} onChange={(e) => setAssetItems((p) => p.map((x, xi) => xi === i ? { ...x, purity_percent: e.target.value } : x))} /></div>
                            <div><label style={label}>Rate/gram</label><input type="number" style={input} value={a.rate_per_gram} onChange={(e) => setAssetItems((p) => p.map((x, xi) => xi === i ? { ...x, rate_per_gram: e.target.value } : x))} /></div>
                            <div><label style={label}>Calculated</label><div style={{ ...input, background: "var(--surface-2)", display: "flex", alignItems: "center" }}>{fmt(calcValue || 0)}</div></div>
                          </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                          <div><label style={label}>Claimed Value</label><input type="number" style={input} value={a.customer_claimed_value} onChange={(e) => setAssetItems((p) => p.map((x, xi) => xi === i ? { ...x, customer_claimed_value: e.target.value } : x))} /></div>
                          <div><label style={label}>Agreed Value</label><input type="number" style={input} value={a.agreed_value} onChange={(e) => setAssetItems((p) => p.map((x, xi) => xi === i ? { ...x, agreed_value: e.target.value } : x))} /></div>
                          <div><label style={label}>Serial #</label><input style={input} value={a.serial_number} onChange={(e) => setAssetItems((p) => p.map((x, xi) => xi === i ? { ...x, serial_number: e.target.value } : x))} /></div>
                          <div><label style={label}>Document #</label><input style={input} value={a.document_number} onChange={(e) => setAssetItems((p) => p.map((x, xi) => xi === i ? { ...x, document_number: e.target.value } : x))} /></div>
                        </div>

                        {isLandOrProperty && (
                          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, marginTop: 10, color: "#b45309" }}>
                            <input type="checkbox" checked={a.needs_legal_transfer} onChange={(e) => setAssetItems((p) => p.map((x, xi) => xi === i ? { ...x, needs_legal_transfer: e.target.checked } : x))} />
                            Requires legal transfer
                          </label>
                        )}

                        <div style={{ textAlign: "right", marginTop: 10 }}>
                          <button className="page-btn-round-danger" onClick={() => setAssetItems((p) => p.filter((_, xi) => xi !== i))}><FaTrash size={11} /></button>
                        </div>
                      </div>
                    );
                  })}
                  <button className="page-btn-round" style={{ alignSelf: "flex-start" }} onClick={() => setAssetItems((p) => [...p, emptyAsset()])}><FaPlus size={10} /> Add Asset</button>
                </div>
              )}
            </div>

            {/* CHEQUES */}
            <div style={sectionCard}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={useCheques} onChange={(e) => setUseCheques(e.target.checked)} /> Cheque
              </label>
              {useCheques && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  {chequeItems.map((c, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                      <div><label style={label}>Bank Name</label><input style={input} value={c.bank_name} onChange={(e) => setChequeItems((p) => p.map((x, xi) => xi === i ? { ...x, bank_name: e.target.value } : x))} /></div>
                      <div><label style={label}>Account Holder</label><input style={input} value={c.account_holder} onChange={(e) => setChequeItems((p) => p.map((x, xi) => xi === i ? { ...x, account_holder: e.target.value } : x))} /></div>
                      <div><label style={label}>Cheque #</label><input style={input} value={c.cheque_number} onChange={(e) => setChequeItems((p) => p.map((x, xi) => xi === i ? { ...x, cheque_number: e.target.value } : x))} /></div>
                      <div><label style={label}>Cheque Date</label><input type="date" style={input} value={c.cheque_date} onChange={(e) => setChequeItems((p) => p.map((x, xi) => xi === i ? { ...x, cheque_date: e.target.value } : x))} /></div>
                      <div><label style={label}>Amount</label><input type="number" style={input} value={c.amount} onChange={(e) => setChequeItems((p) => p.map((x, xi) => xi === i ? { ...x, amount: e.target.value } : x))} /></div>
                      <button className="page-btn-round-danger" onClick={() => setChequeItems((p) => p.filter((_, xi) => xi !== i))}><FaTrash size={11} /></button>
                    </div>
                  ))}
                  <button className="page-btn-round" style={{ alignSelf: "flex-start" }} onClick={() => setChequeItems((p) => [...p, emptyCheque()])}><FaPlus size={10} /> Add Cheque</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div>
            <h3 style={{ margin: "0 0 16px", fontSize: 14 }}>Review</h3>
            <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, padding: 18 }}>
              {useCash && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span>Cash</span><span>{fmt(cashTotal)}</span></div>}
              {useGoods && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span>Goods ({goodsItems.filter((g) => g.description).length} items)</span><span>{fmt(goodsTotal)}</span></div>}
              {useAssets && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span>Assets ({assetItems.filter((a) => a.asset_name).length} items)</span><span>{fmt(assetTotal)}</span></div>}
              {useCheques && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span>Cheques ({chequeItems.filter((c) => c.cheque_number).length})</span><span>{fmt(chequeTotal)}</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border-soft)", marginTop: 6, fontWeight: 700, fontSize: 15 }}>
                <span>TOTAL</span><span>{fmt(totalValue)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span>Allocated to Invoices</span><span>{fmt(totalAllocated)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, color: difference === 0 ? "#16a34a" : "#dc2626" }}>
                <span>Difference</span><span>{fmt(difference)}</span>
              </div>
            </div>
            {difference !== 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#dc2626", display: "flex", alignItems: "center", gap: 6 }}>
                <FaExclamationTriangle /> The allocated total must exactly equal the settlement value before continuing.
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <label style={label}>Notes</label>
              <textarea style={{ ...input, minHeight: 70, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional context…" />
            </div>
          </div>
        )}

        {/* ── STEP 4 ── */}
        {step === 4 && (
          <div>
            <h3 style={{ margin: "0 0 16px", fontSize: 14 }}>Confirm</h3>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 14 }}>
              Settling <strong>{fmt(totalValue)}</strong> for <strong>{selectedCustomer?.nickname || selectedCustomer?.username}</strong> against {Object.keys(allocations).length} invoice(s).
            </div>
            {hasLandOrProperty && (
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 14px", color: "#92400e", fontSize: 13, marginBottom: 16, display: "flex", gap: 8 }}>
                <FaExclamationTriangle style={{ flexShrink: 0, marginTop: 2 }} />
                <span>This settlement contains Land/Property. Outstanding will reduce ONLY after you confirm legal transfer is done.</span>
              </div>
            )}
            <button className="page-btn-round page-btn-round-primary" disabled={submitting} onClick={handleSubmit} style={{ width: "100%", justifyContent: "center", padding: "12px" }}>
              {submitting ? "Submitting…" : "Submit Settlement"}
            </button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border-soft)" }}>
          <button className="page-btn-round" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
            <FaArrowLeft size={11} /> Back
          </button>
          {step < 4 && (
            <button
              className="page-btn-round page-btn-round-primary"
              disabled={(step === 1 && !canGoStep2) || (step === 2 && !canGoStep3) || (step === 3 && !canSubmit)}
              onClick={() => setStep((s) => s + 1)}
            >
              Next <FaArrowRight size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
