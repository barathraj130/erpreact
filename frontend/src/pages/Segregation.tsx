import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import {
  FaBox,
  FaCheckCircle,
  FaExchangeAlt,
  FaExclamationTriangle,
  FaPlus,
  FaSync,
  FaTrash,
} from "react-icons/fa";
import { confirmPendingProduct, createSet } from "../api/productApi";
import { useProducts } from "../hooks/useProducts";
import CustomSelect from "../components/CustomSelect";
import TextAutocomplete from "../components/TextAutocomplete";
import { apiFetch } from "../utils/api";
import "./finance/Finance.css";
import "./finance/Finance.neo.css";

interface ConvertForm {
  product_id: number;
  product_name: string;
  lot_id: string;
  mistake_qty: number;
  repair_cost_per_piece: number;
  notes: string;
}

// Segregation Team's own page — the intermediate stage between Purchase and
// Sales. Purchase Team only ever enters description/qty/rate/bundles (see
// SimplifiedPurchaseBill.tsx); every product that comes out of a purchase,
// fresh or mistake, lands here first (pending_review=true). This team
// assigns the customer-facing category/age group, inspects mistake batches
// and splits them into Good (via Convert Mistake → Fresh Repaired) vs still-
// defective, fixes rates, defines Sets, and only then releases stock to
// Sales. Deliberately a standalone page (not part of Inventory.tsx) so it
// can be given to a role that sees nothing else in the system.
const Segregation: React.FC = () => {
  const { products, loading, refresh } = useProducts();
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [ageGroupOptions, setAgeGroupOptions] = useState<string[]>([]);

  useEffect(() => {
    apiFetch("/products/category-options")
      .then(r => r.ok ? r.json() : { categories: [], age_groups: [] })
      .then(data => {
        setCategoryOptions(data.categories || []);
        setAgeGroupOptions(data.age_groups || []);
      })
      .catch(() => {});
  }, []);

  const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
  const withSupplier = (p: any) => p.name + (p.supplier_name ? ` — ${p.supplier_name}` : "");

  // ── Unified review queue: every purchased product (fresh or mistake)
  // lands here as pending_review=true, regardless of how it was created
  // (surplus Fresh/Mistake lines, or the regular quick-add combobox).
  const segregationProducts = products.filter((p: any) => p.pending_review);
  const [drafts, setDrafts] = useState<Record<number, { name: string; category: string; age_group: string; cost_price: string; selling_price: string }>>({});
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const draftFor = (p: any) => drafts[p.id] || { name: p.name, category: p.category && p.category !== "Other" ? p.category : "", age_group: p.age_group || "", cost_price: "", selling_price: "" };
  const updateDraft = (p: any, field: "name" | "category" | "age_group" | "cost_price" | "selling_price", value: string) =>
    setDrafts(prev => ({ ...prev, [p.id]: { ...draftFor(p), [field]: value } }));

  const handleConfirm = async (p: any) => {
    const draft = draftFor(p);
    if (!draft.category.trim()) return alert("Category is required before this stock can go to Sales.");
    if (!draft.cost_price.trim() && !draft.selling_price.trim()) return alert("Enter at least a cost price or selling price.");
    setConfirmingId(p.id);
    try {
      const nameToSave = draft.name.trim() && draft.name.trim() !== p.name ? draft.name.trim() : undefined;
      const data = await confirmPendingProduct(p.id, nameToSave, {
        category: draft.category.trim(),
        age_group: draft.age_group.trim() || undefined,
        cost_price: draft.cost_price.trim() ? Number(draft.cost_price) : undefined,
        selling_price: draft.selling_price.trim() ? Number(draft.selling_price) : undefined,
      });
      if (!data.success) { alert(data.error || "Confirm failed"); return; }
      setDrafts(prev => { const next = { ...prev }; delete next[p.id]; return next; });
      refresh();
    } catch (e: any) {
      alert(e.message || "Confirm failed");
    } finally {
      setConfirmingId(null);
    }
  };

  // ── Merge a duplicate into the real/canonical product ──
  const [mergeFromProduct, setMergeFromProduct] = useState<any>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [merging, setMerging] = useState(false);

  const handleMerge = async () => {
    if (!mergeFromProduct || !mergeTargetId) return;
    setMerging(true);
    try {
      const res = await apiFetch("/products/merge-duplicate", {
        method: "POST",
        body: { from_product_id: mergeFromProduct.id, into_product_id: Number(mergeTargetId) },
      });
      const data = await res.json();
      if (!res.ok || !data.success) { alert(data.error || "Merge failed"); return; }
      alert(data.message);
      setMergeFromProduct(null);
      setMergeTargetId("");
      refresh();
    } catch {
      alert("Merge failed");
    } finally {
      setMerging(false);
    }
  };

  // ── Convert Mistake → Fresh Repaired: splits a mistake batch into Good
  // (repaired, sellable at a near-full rate) vs still-defective stock. ──
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertForm, setConvertForm] = useState<ConvertForm>({ product_id: 0, product_name: "", lot_id: "", mistake_qty: 0, repair_cost_per_piece: 0, notes: "" });
  const [converting, setConverting] = useState(false);

  const handleConvert = async () => {
    if (!convertForm.product_id || convertForm.mistake_qty <= 0) return alert("Select product and enter mistake qty.");
    setConverting(true);
    try {
      const res = await apiFetch("/inventory/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: convertForm.product_id,
          lot_id: convertForm.lot_id || undefined,
          mistake_qty: convertForm.mistake_qty,
          repair_cost_per_piece: convertForm.repair_cost_per_piece,
          notes: convertForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || "Conversion failed.");
      alert(`Converted ${data.converted_qty} pcs to Fresh Repaired. Repair cost: ₹${data.repair_cost.toFixed(2)}`);
      setShowConvertModal(false);
      refresh();
    } finally {
      setConverting(false);
    }
  };

  // ── Create Set: defines a Set's recipe (2+ real products sold as one
  // line). No stock of its own — selling it deducts each component. ──
  const [showCreateSetModal, setShowCreateSetModal] = useState(false);
  const [creatingSet, setCreatingSet] = useState(false);
  const [setForm, setSetForm] = useState<{
    mode: "new" | "existing";
    set_product_id: string;
    set_name: string;
    components: { product_id: string; qty_per_set: string }[];
  }>({ mode: "new", set_product_id: "", set_name: "", components: [{ product_id: "", qty_per_set: "" }, { product_id: "", qty_per_set: "" }] });

  const resetSetForm = () => setSetForm({ mode: "new", set_product_id: "", set_name: "", components: [{ product_id: "", qty_per_set: "" }, { product_id: "", qty_per_set: "" }] });

  const handleCreateSet = async () => {
    const components = setForm.components
      .filter(c => c.product_id && Number(c.qty_per_set) > 0)
      .map(c => ({ product_id: Number(c.product_id), qty_per_set: Number(c.qty_per_set) }));
    if (components.length === 0) return alert("Add at least one component with a quantity.");
    if (setForm.mode === "existing" && !setForm.set_product_id) return alert("Select the existing set product.");
    if (setForm.mode === "new" && !setForm.set_name.trim()) return alert("Enter a name for the new set product.");

    setCreatingSet(true);
    try {
      const data = await createSet({
        set_product_id: setForm.mode === "existing" ? Number(setForm.set_product_id) : null,
        set_name: setForm.mode === "new" ? setForm.set_name.trim() : undefined,
        components,
      });
      if (!data.success) { alert(data.error || "Save failed"); return; }
      alert(data.message || "Set saved");
      setShowCreateSetModal(false);
      resetSetForm();
      refresh();
    } catch (e: any) {
      alert(e.message || "Save failed");
    } finally {
      setCreatingSet(false);
    }
  };

  return (
    <div className="finance-container neo-page-skin">
      <div className="finance-header">
        <div className="header-info">
          <h1 className="text-title">Segregation</h1>
          <p className="text-muted">Categorize, price, and release purchased stock to Sales</p>
        </div>
        <div className="finance-actions" style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={() => refresh()} style={{ width: "42px", height: "42px", padding: 0, flexShrink: 0 }} title="Refresh">
            <FaSync className={loading ? "fa-spin" : ""} />
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => { setConvertForm({ product_id: 0, product_name: "", lot_id: "", mistake_qty: 0, repair_cost_per_piece: 0, notes: "" }); setShowConvertModal(true); }}
            style={{ height: "42px", padding: "0 16px", gap: "8px", display: "flex", alignItems: "center", whiteSpace: "nowrap", flexShrink: 0, color: "#3b82f6", borderColor: "#3b82f6" }}
          >
            <FaExchangeAlt size={13} /> Convert Mistake
          </button>
          <button
            className="btn btn-secondary"
            title="Define a Set — a sales-side grouping of 2+ products with no stock of its own"
            onClick={() => { resetSetForm(); setShowCreateSetModal(true); }}
            style={{ height: "42px", padding: "0 16px", gap: "8px", display: "flex", alignItems: "center", whiteSpace: "nowrap", flexShrink: 0, color: "#7c3aed", borderColor: "#7c3aed" }}
          >
            <FaBox size={13} /> Create Set
          </button>
        </div>
      </div>

      {/* ── Segregation Queue ── */}
      <div style={{ marginBottom: "12px", fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>
        Awaiting Segregation ({segregationProducts.length})
      </div>
      {segregationProducts.length === 0 ? (
        <div className="empty-state" style={{ padding: "60px 20px", textAlign: "center", border: "1px dashed #e2e8f0", borderRadius: "16px" }}>
          <FaCheckCircle size={40} style={{ color: "#86efac", marginBottom: "14px" }} />
          <h3 style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>Nothing waiting</h3>
          <p style={{ color: "#94a3b8", marginTop: "6px" }}>Every purchased product has been categorized and released to Sales.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
          {segregationProducts.map((p: any) => {
            const draft = draftFor(p);
            return (
              <div key={p.id} style={{ border: "1.5px solid #fde68a", background: "#fffbeb", borderRadius: "12px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.92rem" }}>
                      {p.name}
                      {p.supplier_name && <span style={{ marginLeft: 6, fontSize: "0.72rem", color: "#92400e", fontWeight: 600 }}>· {p.supplier_name}</span>}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#92400e" }}>Stock: {p.current_stock ?? 0} {p.unit || ""}</div>
                  </div>
                  {p.from_mistake_stock && (
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#92400e", background: "#fef3c7", padding: "3px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>
                      From mistake batch — consider Convert Mistake first
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "#92400e", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                    Rename (optional)
                  </label>
                  <input
                    value={draft.name}
                    onChange={e => updateDraft(p, "name", e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #fde68a", background: "#fff", fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", marginBottom: 3 }}>Category *</div>
                    <TextAutocomplete
                      value={draft.category}
                      onChange={v => updateDraft(p, "category", v)}
                      options={categoryOptions}
                      placeholder="e.g. TOP, PANT, HOODIE"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", marginBottom: 3 }}>Age Group</div>
                    <TextAutocomplete
                      value={draft.age_group}
                      onChange={v => updateDraft(p, "age_group", v)}
                      options={ageGroupOptions}
                      placeholder="e.g. 2 TO 8, 8 TO 16"
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", marginBottom: 3 }}>Cost Price (₹)</div>
                    <input
                      type="number" min="0" step="0.01" placeholder={p.cost_price ? String(p.cost_price) : "0.00"}
                      value={draft.cost_price}
                      onChange={e => updateDraft(p, "cost_price", e.target.value)}
                      style={{ width: "100%", padding: "7px 9px", borderRadius: 6, border: "0.5px solid #fde68a", fontSize: 12.5, boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", marginBottom: 3 }}>Selling Price (₹)</div>
                    <input
                      type="number" min="0" step="0.01" placeholder={p.selling_price ? String(p.selling_price) : "0.00"}
                      value={draft.selling_price}
                      onChange={e => updateDraft(p, "selling_price", e.target.value)}
                      style={{ width: "100%", padding: "7px 9px", borderRadius: 6, border: "0.5px solid #fde68a", fontSize: 12.5, boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "7px 12px", fontSize: "0.78rem" }}
                    title="Merge into another product (it's a duplicate)"
                    onClick={() => setMergeFromProduct(p)}
                  >
                    <FaExchangeAlt size={12} /> Merge
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ padding: "7px 14px", fontSize: "0.78rem", opacity: confirmingId === p.id ? 0.6 : 1 }}
                    disabled={confirmingId === p.id}
                    onClick={() => handleConfirm(p)}
                  >
                    <FaCheckCircle size={12} /> {confirmingId === p.id ? "Saving…" : "Confirm & Send to Sales"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Convert Mistake Modal */}
      <AnimatePresence>
        {showConvertModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={e => { if (e.target === e.currentTarget) setShowConvertModal(false); }}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              style={{ background: "#fff", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "440px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
              <h2 style={{ margin: "0 0 20px", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>Convert Mistake → Fresh Repaired</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Product</label>
                  <CustomSelect value={String(convertForm.product_id)} onChange={(e: any) => {
                    const p = products.find(pr => String(pr.id) === e.target.value);
                    setConvertForm(f => ({ ...f, product_id: Number(e.target.value), product_name: p?.name || "" }));
                  }}>
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{withSupplier(p)}</option>)}
                  </CustomSelect>
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Lot Number (optional)</label>
                  <input value={convertForm.lot_id} onChange={e => setConvertForm(f => ({ ...f, lot_id: e.target.value }))}
                    placeholder="Leave blank for general stock" style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Mistake Qty *</label>
                    <input type="number" min="1" value={convertForm.mistake_qty || ""}
                      onChange={e => setConvertForm(f => ({ ...f, mistake_qty: Number(e.target.value) }))}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Repair Cost/pc (₹)</label>
                    <input type="number" min="0" value={convertForm.repair_cost_per_piece || ""}
                      onChange={e => setConvertForm(f => ({ ...f, repair_cost_per_piece: Number(e.target.value) }))}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
                  </div>
                </div>
                {convertForm.mistake_qty > 0 && convertForm.repair_cost_per_piece > 0 && (
                  <div style={{ background: "#eff6ff", borderRadius: "10px", padding: "12px 16px", fontSize: "0.85rem", color: "#1e40af", fontWeight: 600 }}>
                    Total repair cost: ₹{(convertForm.mistake_qty * convertForm.repair_cost_per_piece).toLocaleString("en-IN")}
                  </div>
                )}
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Notes</label>
                  <input value={convertForm.notes} onChange={e => setConvertForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. Repaired by Raju" style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <button className="btn btn-secondary" onClick={() => setShowConvertModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleConvert} disabled={converting} style={{ flex: 1 }}>
                  {converting ? "Converting..." : "Convert"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Set Modal */}
      <AnimatePresence>
        {showCreateSetModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={e => { if (e.target === e.currentTarget) setShowCreateSetModal(false); }}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              style={{ background: "#fff", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "540px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
              <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>Create Set</h2>
              <p style={{ margin: "0 0 20px", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.6 }}>
                A Set has no stock of its own — it's a sales-side grouping. Define which products (and how many of
                each) make up one Set here; selling a Set deducts straight from each component's real stock.
              </p>

              <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
                <button type="button" onClick={() => setSetForm(f => ({ ...f, mode: "new" }))}
                  style={{ flex: 1, padding: "10px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, border: setForm.mode === "new" ? "2px solid #7c3aed" : "1.5px solid #e2e8f0", background: setForm.mode === "new" ? "#f5f3ff" : "#fff", color: setForm.mode === "new" ? "#7c3aed" : "#64748b" }}>
                  New Set Product
                </button>
                <button type="button" onClick={() => setSetForm(f => ({ ...f, mode: "existing" }))}
                  style={{ flex: 1, padding: "10px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, border: setForm.mode === "existing" ? "2px solid #7c3aed" : "1.5px solid #e2e8f0", background: setForm.mode === "existing" ? "#f5f3ff" : "#fff", color: setForm.mode === "existing" ? "#7c3aed" : "#64748b" }}>
                  Edit Existing Set
                </button>
              </div>

              {setForm.mode === "new" ? (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Set Name *</label>
                  <input value={setForm.set_name} onChange={e => setSetForm(f => ({ ...f, set_name: e.target.value }))}
                    placeholder="e.g. Men's Top + Pant Set" style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
                </div>
              ) : (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Existing Set Product *</label>
                  <CustomSelect value={setForm.set_product_id} onChange={(e: any) => setSetForm(f => ({ ...f, set_product_id: e.target.value }))} placeholder="Search products…">
                    {(products || []).filter((p: any) => p.is_set).map((p: any) => <option key={p.id} value={p.id}>{withSupplier(p)}</option>)}
                  </CustomSelect>
                </div>
              )}

              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Components (qty needed per 1 set)</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
                {setForm.components.map((c, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <CustomSelect value={c.product_id} onChange={(e: any) => setSetForm(f => ({ ...f, components: f.components.map((row, i) => i === idx ? { ...row, product_id: e.target.value } : row) }))} placeholder="Search products…">
                        {(products || []).filter((p: any) => !p.is_set).map((p: any) => <option key={p.id} value={p.id}>{withSupplier(p)}</option>)}
                      </CustomSelect>
                    </div>
                    <input type="number" min="0.01" step="0.01" placeholder="Qty/set" value={c.qty_per_set}
                      onChange={e => setSetForm(f => ({ ...f, components: f.components.map((row, i) => i === idx ? { ...row, qty_per_set: e.target.value } : row) }))}
                      style={{ width: "90px", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
                    <button type="button" className="btn btn-secondary" style={{ padding: "8px 10px" }}
                      onClick={() => setSetForm(f => ({ ...f, components: f.components.filter((_, i) => i !== idx) }))}
                      disabled={setForm.components.length <= 1}>
                      <FaTrash size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-secondary" style={{ fontSize: "0.8rem", marginBottom: "20px" }}
                onClick={() => setSetForm(f => ({ ...f, components: [...f.components, { product_id: "", qty_per_set: "" }] }))}>
                <FaPlus size={11} /> Add Component
              </button>

              <div style={{ display: "flex", gap: "10px" }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreateSetModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1, opacity: creatingSet ? 0.6 : 1 }} disabled={creatingSet} onClick={handleCreateSet}>
                  {creatingSet ? "Saving…" : "Save Set"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Merge Duplicate Product Modal */}
      <AnimatePresence>
        {mergeFromProduct && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={e => { if (e.target === e.currentTarget) { setMergeFromProduct(null); setMergeTargetId(""); } }}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              style={{ background: "#fff", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "460px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
              <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>Merge Duplicate Product</h2>
              <p style={{ margin: "0 0 20px", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.6 }}>
                Moves <strong>"{mergeFromProduct.name}"</strong>'s stock and purchase/invoice history into the
                product you pick below, then marks "{mergeFromProduct.name}" as merged so it can't be sold from again.
                This cannot be undone.
              </p>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                Merge into
              </label>
              <CustomSelect value={mergeTargetId} onChange={(e: any) => setMergeTargetId(e.target.value)} placeholder="Search products…">
                {(products || [])
                  .filter((p: any) => p.id !== mergeFromProduct.id)
                  .map((p: any) => <option key={p.id} value={p.id}>{withSupplier(p)}</option>)}
              </CustomSelect>
              <div style={{ display: "flex", gap: "10px", marginTop: "22px" }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setMergeFromProduct(null); setMergeTargetId(""); }}>Cancel</button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, opacity: (!mergeTargetId || merging) ? 0.5 : 1 }}
                  disabled={!mergeTargetId || merging}
                  onClick={handleMerge}
                >
                  {merging ? "Merging…" : "Merge"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Segregation;
