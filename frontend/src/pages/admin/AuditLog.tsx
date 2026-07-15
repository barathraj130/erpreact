import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/api";

interface AuditLogRow {
  id: number;
  company_id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  table_name: string;
  record_id: number | null;
  old_data: any;
  new_data: any;
  created_at: string;
}

const ACTION_COLORS: Record<string, { bg: string; fg: string }> = {
  INSERT: { bg: "var(--green-bg)", fg: "var(--green)" },
  UPDATE: { bg: "var(--amber-bg)", fg: "var(--amber)" },
  DELETE: { bg: "var(--red-bg)", fg: "var(--red)" },
};

const ACTION_LABELS: Record<string, string> = {
  INSERT: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
};

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
};

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [moduleFilter, setModuleFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  useEffect(() => {
    apiFetch("/audit-log/modules")
      .then((r) => r.json())
      .then((d) => setModules(d.modules || []))
      .catch(() => setModules([]));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleFilter, from, to, page]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (moduleFilter) params.set("module", moduleFilter);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await apiFetch(`/audit-log?${params.toString()}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 28, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>Audit Log</h1>
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: "4px 0 0" }}>
          {total} recorded change{total === 1 ? "" : "s"} — automatically captured for invoices and products.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={moduleFilter}
          onChange={(e) => { setPage(1); setModuleFilter(e.target.value); }}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-1)", fontSize: 13 }}
        >
          <option value="">All modules</option>
          {modules.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => { setPage(1); setFrom(e.target.value); }}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-1)", fontSize: 13 }}
        />
        <input
          type="date"
          value={to}
          onChange={(e) => { setPage(1); setTo(e.target.value); }}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-1)", fontSize: 13 }}
        />
      </div>

      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Date/Time", "User", "Action", "Module", "Record"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--text-2)" }}>Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--text-2)" }}>No audit entries found.</td></tr>
              ) : (
                logs.map((log) => {
                  const colors = ACTION_COLORS[log.action] || { bg: "var(--surface-2)", fg: "var(--text-2)" };
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelected(log)}
                      style={{ borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }}
                    >
                      <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-1)" }}>
                        {new Date(log.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-1)" }}>{log.user_name || "System"}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6, background: colors.bg, color: colors.fg }}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-2)" }}>{log.table_name}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-2)" }}>#{log.record_id ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-2)" }}>
          <span>Page {page} of {pages}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-1)", cursor: page <= 1 ? "not-allowed" : "pointer" }}
            >
              Prev
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-1)", cursor: page >= pages ? "not-allowed" : "pointer" }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999, display: "flex", justifyContent: "flex-end" }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{ width: 460, maxWidth: "92vw", height: "100%", background: "var(--surface)", borderLeft: "1px solid var(--border)", padding: 24, overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>
                {selected.table_name} #{selected.record_id}
              </h2>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-2)" }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 16 }}>
              {ACTION_LABELS[selected.action] || selected.action} by {selected.user_name || "System"} on{" "}
              {new Date(selected.created_at).toLocaleString("en-IN")}
            </p>

            {selected.old_data && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", marginBottom: 6 }}>Before</div>
                <pre style={{ background: "var(--surface-2)", borderRadius: 8, padding: 12, fontSize: 11, color: "var(--text-1)", overflowX: "auto", marginBottom: 16 }}>
                  {JSON.stringify(selected.old_data, null, 2)}
                </pre>
              </>
            )}

            {selected.new_data && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", marginBottom: 6 }}>After</div>
                <pre style={{ background: "var(--surface-2)", borderRadius: 8, padding: 12, fontSize: 11, color: "var(--text-1)", overflowX: "auto" }}>
                  {JSON.stringify(selected.new_data, null, 2)}
                </pre>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
