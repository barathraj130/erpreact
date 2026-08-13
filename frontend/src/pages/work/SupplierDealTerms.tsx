import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/api";
import "../PageShared.css";

interface DealTerm {
  supplier_id: number;
  supplier_name: string;
  mistake_pcs_allowed: boolean;
  notes: string | null;
}

const SupplierDealTerms: React.FC = () => {
  const [terms, setTerms] = useState<DealTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchTerms = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/work-daily-logs/supplier-deal-terms");
      const data = await res.json();
      setTerms(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTerms(); }, []);

  const toggle = async (t: DealTerm) => {
    setSavingId(t.supplier_id);
    try {
      const res = await apiFetch(`/work-daily-logs/supplier-deal-terms/${t.supplier_id}`, {
        method: "PUT",
        body: { mistake_pcs_allowed: !t.mistake_pcs_allowed, notes: t.notes },
      });
      const d = await res.json();
      if (d.success) {
        setTerms((prev) => prev.map((x) => (x.supplier_id === t.supplier_id ? { ...x, mistake_pcs_allowed: !t.mistake_pcs_allowed } : x)));
      } else {
        alert(d.error || "Failed to update");
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Supplier Deal Terms</h1>
          <p>Whether mistake (defective) pcs are accepted from each supplier, without editing the supplier's core record.</p>
        </div>
      </div>

      <div className="page-table-wrapper">
        {loading ? (
          <div className="page-empty">Loading…</div>
        ) : terms.length === 0 ? (
          <div className="page-empty">No suppliers found.</div>
        ) : (
          <table className="page-table">
            <thead><tr><th>Supplier</th><th>Deal Term</th><th className="text-center">Mistake Pcs Allowed?</th></tr></thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.supplier_id}>
                  <td className="font-bold">{t.supplier_name}</td>
                  <td>
                    <span
                      style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700,
                        background: t.mistake_pcs_allowed ? "#f0fdf4" : "#fef2f2",
                        color: t.mistake_pcs_allowed ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {t.mistake_pcs_allowed ? "MISTAKE PCS ALLOWED" : "FRESH ONLY"}
                    </span>
                  </td>
                  <td className="text-center">
                    <button
                      onClick={() => toggle(t)}
                      disabled={savingId === t.supplier_id}
                      style={{
                        width: 44, height: 24, borderRadius: 20, border: "none", cursor: "pointer",
                        background: t.mistake_pcs_allowed ? "#16a34a" : "#cbd5e1",
                        position: "relative", transition: "background 150ms",
                        opacity: savingId === t.supplier_id ? 0.6 : 1,
                      }}
                      aria-label="Toggle mistake pcs allowed"
                    >
                      <span
                        style={{
                          position: "absolute", top: 3, left: t.mistake_pcs_allowed ? 23 : 3,
                          width: 18, height: 18, borderRadius: "50%", background: "#fff",
                          transition: "left 150ms",
                        }}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SupplierDealTerms;
