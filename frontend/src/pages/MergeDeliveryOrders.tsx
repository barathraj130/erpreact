import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaBox, FaExchangeAlt, FaFileInvoice } from "react-icons/fa";
import { apiFetch } from "../utils/api";
import "./PageShared.css";

interface BundleLine {
  bundles: number;
  pieces_per_bundle: number;
  total: number;
}

interface SourceItem {
  delivery_order_id: number;
  order_number: string;
  item_id: number;
  total_pieces: number;
  bundle_lines: BundleLine[];
}

// A merged row groups one or more delivery-order line items for the SAME
// product. Same product → auto-combined (bundle_lines concatenated, pieces
// summed) since delivery orders carry no price yet, so there's nothing that
// could meaningfully differ between two lines of the same product at this
// stage. "Split" un-merges a row back into one row per source order.
interface MergedRow {
  key: string;
  product_id: number | null;
  product_name: string;
  gst_percent: number;
  total_pieces: number;
  sources: SourceItem[];
}

const MergeDeliveryOrders: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [orderNumbers, setOrderNumbers] = useState<string[]>([]);
  const [rows, setRows] = useState<MergedRow[]>([]);

  useEffect(() => {
    const ids = new URLSearchParams(location.search).get("ids");
    if (!ids) { setError("No delivery orders selected."); setLoading(false); return; }
    const idList = ids.split(",").map(s => parseInt(s)).filter(Boolean);
    if (idList.length < 2) { setError("Select at least 2 delivery orders to merge."); setLoading(false); return; }

    const load = async () => {
      try {
        const results = await Promise.all(idList.map(id => apiFetch(`/delivery-orders/${id}`).then(r => r.json())));
        const bad = results.find(r => !r.success);
        if (bad) { setError(bad.error || "Failed to load one of the selected delivery orders."); return; }
        const orders = results.map(r => r.order);

        const distinctCustomers = new Set(orders.map((o: any) => o.customer_id ?? `name:${o.customer_name}`));
        if (distinctCustomers.size > 1) {
          setError("Selected delivery orders belong to different customers — merging only works within the same customer.");
          return;
        }
        const alreadyInvoiced = orders.find((o: any) => o.status === "invoiced");
        if (alreadyInvoiced) {
          setError(`${alreadyInvoiced.order_number} is already invoiced and can't be merged.`);
          return;
        }

        setCustomerId(orders[0].customer_id ?? null);
        setCustomerName(orders[0].customer_name || "");
        setOrderNumbers(orders.map((o: any) => o.order_number));

        // Group confirmed, non-cancelled items across all selected orders by product.
        const groups = new Map<string, MergedRow>();
        for (const order of orders) {
          const confirmedItems = (order.items || []).filter((i: any) => i.is_confirmed && !i.is_cancelled);
          for (const item of confirmedItems) {
            const lines: BundleLine[] = Array.isArray(item.bundle_lines)
              ? item.bundle_lines
              : (typeof item.bundle_lines === "string" ? JSON.parse(item.bundle_lines) : []);
            const groupKey = item.product_id ? `p:${item.product_id}` : `name:${(item.product_name || "").trim().toUpperCase()}`;
            const source: SourceItem = {
              delivery_order_id: order.id,
              order_number: order.order_number,
              item_id: item.id,
              total_pieces: Number(item.total_pieces) || 0,
              bundle_lines: lines,
            };
            const existing = groups.get(groupKey);
            if (existing) {
              existing.total_pieces += source.total_pieces;
              existing.sources.push(source);
            } else {
              groups.set(groupKey, {
                key: groupKey,
                product_id: item.product_id || null,
                product_name: (item.product_name || "").toUpperCase(),
                gst_percent: item.gst_percent || 0,
                total_pieces: source.total_pieces,
                sources: [source],
              });
            }
          }
        }
        setRows(Array.from(groups.values()));
      } catch (e: any) {
        setError(e.message || "Failed to load delivery orders.");
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Breaks a merged row back into one row per source delivery order.
  const handleSplit = (rowKey: string) => {
    setRows(prev => {
      const row = prev.find(r => r.key === rowKey);
      if (!row || row.sources.length <= 1) return prev;
      const split: MergedRow[] = row.sources.map((s, idx) => ({
        key: `${rowKey}__split${idx}`,
        product_id: row.product_id,
        product_name: row.product_name,
        gst_percent: row.gst_percent,
        total_pieces: s.total_pieces,
        sources: [s],
      }));
      return prev.filter(r => r.key !== rowKey).concat(split);
    });
  };

  const bundleSummary = (lines: BundleLine[]) => lines.map(b => `${b.bundles}×${b.pieces_per_bundle}`).join(", ");

  const handleProceed = () => {
    const ids = new URLSearchParams(location.search).get("ids") || "";
    const idList = ids.split(",").map(s => parseInt(s)).filter(Boolean);
    const items = rows.map((row, idx) => ({
      id: Date.now() + idx,
      product_id: row.product_id,
      desc: row.product_name,
      hsn: "",
      uom: "Pcs",
      qty: row.total_pieces,
      rate: 0,
      gst_rate: row.gst_percent || null,
      _bundle_summary: row.sources.map(s => `${s.order_number}: ${bundleSummary(s.bundle_lines) || `${s.total_pieces}pcs`}`).join(" + "),
      _from_delivery_order: true,
      _delivery_item_id: row.sources[0]?.item_id,
    }));

    navigate("/invoices/new", {
      state: {
        mergedDeliveryOrders: {
          ids: idList,
          orderNumbers,
          customerId,
          items,
        },
      },
    });
  };

  if (loading) {
    return <div className="page-container"><div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>Loading delivery orders…</div></div>;
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div><h1>Merge Delivery Orders</h1></div>
        </div>
        <div className="page-empty">
          <div style={{ color: "#dc2626", fontWeight: 600 }}>{error}</div>
          <button className="page-btn-round-sm" style={{ marginTop: 16 }} onClick={() => navigate("/delivery-orders")}>
            <FaArrowLeft size={12} /> Back to Delivery Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Merge Delivery Orders</h1>
          <p>
            Combining {orderNumbers.join(", ")} for <strong>{customerName}</strong>. Same-product lines are
            auto-combined — split any row back apart if it shouldn't be merged.
          </p>
        </div>
        <div className="page-header-actions">
          <button className="page-btn-round-sm" onClick={() => navigate("/delivery-orders")}>
            <FaArrowLeft size={12} /> Back
          </button>
        </div>
      </div>

      <div className="page-table-wrapper">
        <table className="page-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>From</th>
              <th>Total Pieces</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FaBox style={{ color: "var(--text-3)", opacity: 0.5 }} size={12} />
                    <span className="font-bold">{row.product_name}</span>
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {row.sources.map((s, i) => (
                      <span key={i} style={{ fontSize: 12, color: "var(--text-3)" }}>
                        {s.order_number}: {bundleSummary(s.bundle_lines) || `${s.total_pieces}pcs`}
                      </span>
                    ))}
                  </div>
                </td>
                <td>{row.total_pieces.toLocaleString()} pcs</td>
                <td className="text-center">
                  {row.sources.length > 1 && (
                    <button className="page-btn-round-sm" onClick={() => handleSplit(row.key)} title="Split back into separate lines" style={{ color: "#7c3aed" }}>
                      <FaExchangeAlt size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button className="page-btn-round page-btn-round-primary" onClick={handleProceed} disabled={rows.length === 0}>
          <FaFileInvoice size={13} /> Proceed to Bill
        </button>
      </div>
    </div>
  );
};

export default MergeDeliveryOrders;
