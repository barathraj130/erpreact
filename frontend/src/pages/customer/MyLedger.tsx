import React, { useEffect, useState } from "react";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaDownload,
  FaExclamationCircle,
  FaFileInvoiceDollar,
  FaReceipt,
} from "react-icons/fa";
import { apiFetch } from "../../utils/api";

const MyLedger: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // Fetches summary + transactions for logged-in user
        const res = await apiFetch("/portal/my-ledger");
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error("Ledger Load Error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const fmt = (n: any) =>
    Number(n || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    });

  if (loading) {
    return (
      <div style={{ padding: "80px 20px", textAlign: "center" }}>
        <div
          className="flex-center"
          style={{ flexDirection: "column", gap: "20px" }}
        >
          <div
            className="loading-spinner"
            style={{
              width: "48px",
              height: "48px",
              border: "5px solid var(--primary-glow)",
              borderTop: "5px solid var(--primary)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          ></div>
          <p
            style={{
              color: "var(--text-muted)",
              fontWeight: 600,
              fontSize: "1.1rem",
            }}
          >
            Preparing your financial statement...
          </p>
        </div>
      </div>
    );
  }

  const { summary, transactions } = data || { summary: {}, transactions: [] };

  return (
    <div className="page-transition" style={{ paddingBottom: "40px" }}>
      {/* Header Section */}
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "2.25rem",
            fontWeight: 700,
            color: "var(--text-main)",
            letterSpacing: "-1px",
            margin: 0,
          }}
        >
          My Financial Ledger
        </h1>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "1.1rem",
            marginTop: "4px",
            fontWeight: 500,
          }}
        >
          Track your billing history, payments, and real-time outstanding
          balance.
        </p>
      </div>

      {/* Summary Cards with Premium Styling */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px",
          marginBottom: "40px",
        }}
      >
        {/* Total Invoiced */}
        <div
          className="card"
          style={{
            padding: "28px",
            borderLeft: "5px solid var(--primary)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div
            style={{
              color: "var(--text-muted)",
              marginBottom: "12px",
              fontSize: "0.85rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                background: "var(--primary-glow)",
                padding: "8px",
                borderRadius: "8px",
                color: "var(--primary)",
              }}
            >
              <FaFileInvoiceDollar />
            </div>
            Total Invoiced
          </div>
          <div
            style={{
              fontSize: "2.25rem",
              fontWeight: 700,
              color: "var(--text-main)",
              lineHeight: 1,
            }}
          >
            {fmt(summary?.total_billed)}
          </div>
        </div>

        {/* Total Paid */}
        <div
          className="card"
          style={{
            padding: "28px",
            borderLeft: "5px solid var(--success)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div
            style={{
              color: "var(--success)",
              marginBottom: "12px",
              fontSize: "0.85rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                background: "rgba(16, 185, 129, 0.1)",
                padding: "8px",
                borderRadius: "8px",
              }}
            >
              <FaCheckCircle />
            </div>
            Settled Amount
          </div>
          <div
            style={{
              fontSize: "2.25rem",
              fontWeight: 700,
              color: "var(--success)",
              lineHeight: 1,
            }}
          >
            {fmt(summary?.total_paid)}
          </div>
        </div>

        {/* Balance Pending */}
        <div
          className="card"
          style={{
            padding: "28px",
            borderLeft: "5px solid var(--warning)",
            background: "linear-gradient(135deg, #ffffff 0%, #fffbf0 100%)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div
            style={{
              color: "var(--warning)",
              marginBottom: "12px",
              fontSize: "0.85rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                background: "rgba(245, 158, 11, 0.1)",
                padding: "8px",
                borderRadius: "8px",
              }}
            >
              <FaExclamationCircle />
            </div>
            Outstanding Balance
          </div>
          <div
            style={{
              fontSize: "2.25rem",
              fontWeight: 700,
              color: "#c2410c",
              lineHeight: 1,
            }}
          >
            {fmt(summary?.balance_pending)}
          </div>
        </div>
      </div>

      {/* Transactions Section */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
          border: "1px solid var(--border-color)",
          background: "white",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-color)",
            background: "#f8fafc",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <FaReceipt style={{ color: "var(--primary)", opacity: 0.8 }} />
          <h3
            style={{
              margin: 0,
              fontSize: "1.1rem",
              fontWeight: 600,
              color: "var(--text-main)",
            }}
          >
            Transaction History
          </h3>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.95rem",
              minWidth: "850px",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#f8fafc",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <th
                  style={{
                    padding: "16px 24px",
                    textAlign: "left",
                    color: "var(--text-muted)",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Deployment Date
                </th>
                <th
                  style={{
                    padding: "16px 24px",
                    textAlign: "left",
                    color: "var(--text-muted)",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Invoice Reference
                </th>
                <th
                  style={{
                    padding: "16px 24px",
                    textAlign: "right",
                    color: "var(--text-muted)",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Total Amount
                </th>
                <th
                  style={{
                    padding: "16px 24px",
                    textAlign: "right",
                    color: "var(--text-muted)",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Paid Already
                </th>
                <th
                  style={{
                    padding: "16px 24px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Payment Status
                </th>
                <th
                  style={{
                    padding: "16px 24px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Download
                </th>
              </tr>
            </thead>
            <tbody>
              {!transactions || transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ padding: "80px 40px", textAlign: "center" }}
                  >
                    <div style={{ opacity: 0.4 }}>
                      <FaReceipt
                        size={48}
                        style={{
                          color: "var(--text-light)",
                          marginBottom: "16px",
                        }}
                      />
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 700,
                          fontSize: "1.25rem",
                          color: "var(--text-main)",
                        }}
                      >
                        No Transactions Found
                      </p>
                      <p
                        style={{
                          margin: "4px 0 0",
                          color: "var(--text-muted)",
                        }}
                      >
                        You haven't been invoiced for any services yet.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((inv: any) => (
                  <tr
                    key={inv.id}
                    style={{
                      borderBottom: "1px solid var(--bg-body)",
                      transition: "background-color 0.2s",
                    }}
                    className="row-hover"
                  >
                    <td style={{ padding: "20px 24px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <FaCalendarAlt
                          style={{
                            color: "var(--text-light)",
                            fontSize: "0.85rem",
                          }}
                        />
                        <span
                          style={{ fontWeight: 700, color: "var(--text-main)" }}
                        >
                          {new Date(inv.invoice_date).toLocaleDateString(
                            "en-GB",
                            { day: "2-digit", month: "short", year: "numeric" },
                          )}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "20px 24px" }}>
                      <span
                        style={{
                          color: "var(--primary)",
                          fontWeight: 600,
                          padding: "4px 10px",
                          background: "var(--primary-glow)",
                          borderRadius: "6px",
                        }}
                      >
                        {inv.invoice_number}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "20px 24px",
                        textAlign: "right",
                        fontWeight: 600,
                        color: "var(--text-main)",
                        fontSize: "1rem",
                      }}
                    >
                      {fmt(inv.total_amount)}
                    </td>
                    <td
                      style={{
                        padding: "20px 24px",
                        textAlign: "right",
                        color: "var(--success)",
                        fontWeight: 700,
                      }}
                    >
                      {fmt(inv.paid_amount)}
                    </td>
                    <td style={{ padding: "20px 24px", textAlign: "center" }}>
                      <span
                        style={{
                          background:
                            inv.status === "Paid"
                              ? "rgba(16, 185, 129, 0.1)"
                              : "rgba(245, 158, 11, 0.1)",
                          color:
                            inv.status === "Paid"
                              ? "var(--success)"
                              : "var(--warning)",
                          padding: "6px 14px",
                          borderRadius: "20px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {inv.status || "PENDING"}
                      </span>
                    </td>
                    <td style={{ padding: "20px 24px", textAlign: "center" }}>
                      {inv.file_url ? (
                        <button
                          onClick={() =>
                            window.open(
                              `http://localhost:3000${inv.file_url}`,
                              "_blank",
                            )
                          }
                          style={{
                            border: "none",
                            background: "var(--bg-body)",
                            color: "var(--primary)",
                            width: "38px",
                            height: "38px",
                            borderRadius: "10px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto",
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                          className="icon-btn-hover"
                          title="View/Download Receipt"
                        >
                          <FaDownload />
                        </button>
                      ) : (
                        <span
                          style={{
                            color: "var(--border-color)",
                            fontWeight: 600,
                          }}
                        >
                          •
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
                .row-hover:hover { background-color: #f8fafc; }
                .icon-btn-hover:hover { background: var(--primary) !important; color: white !important; transform: scale(1.1); }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
    </div>
  );
};

export default MyLedger;
