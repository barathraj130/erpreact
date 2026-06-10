import React, { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import CustomSelect from "../../components/CustomSelect";

interface Props {
  employeeId: number;
  employeeName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const fmt = (n: number) =>
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const AdvanceSalaryModal: React.FC<Props> = ({
  employeeId,
  employeeName,
  onClose,
  onSuccess,
}) => {
  const [amount, setAmount]           = useState("");
  const [date, setDate]               = useState(new Date().toISOString().substring(0, 10));
  const [type, setType]               = useState("ONE_TIME");
  const [installment, setInstallment] = useState("");
  const [reason, setReason]           = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK" | "UPI">("CASH");
  const [bankName, setBankName]       = useState("");
  const [refNo, setRefNo]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [errorMsg, setErrorMsg]       = useState("");
  const [isOpening, setIsOpening]     = useState(false); // existing advance, no ledger

  // Live balance state
  const [cashBal, setCashBal]   = useState<number | null>(null);
  const [bankBal, setBankBal]   = useState<number | null>(null);
  const [balLoading, setBalLoading] = useState(true);

  const isBank = paymentMethod === "BANK" || paymentMethod === "UPI";

  // Fetch live balances on mount
  useEffect(() => {
    setBalLoading(true);
    apiFetch("/ledgers/balance/current")
      .then((r) => r.json())
      .then((d) => {
        setCashBal(Number(d.cash ?? 0));
        setBankBal(Number(d.bank ?? 0));
      })
      .catch(() => {
        setCashBal(null);
        setBankBal(null);
      })
      .finally(() => setBalLoading(false));
  }, []);

  // Which balance applies to the selected payment method
  const activeBalance = paymentMethod === "CASH" ? cashBal : bankBal;
  const amountNum = Number(amount) || 0;
  // No insufficient-balance block for opening advances — cash was already given
  const insufficient =
    !isOpening && activeBalance !== null && amountNum > 0 && amountNum > activeBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!amount || amountNum <= 0) return alert("Enter a valid amount");
    if (insufficient) {
      setErrorMsg(
        `Insufficient ${paymentMethod === "CASH" ? "Cash" : "Bank"} balance! ` +
        `Available: ₹${fmt(activeBalance ?? 0)}, Required: ₹${fmt(amountNum)}`
      );
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/hr/advance", {
        method: "POST",
        body: {
          employee_id:        employeeId,
          amount:             amountNum,
          date,
          reason,
          repayment_type:     type,
          installment_amount: type === "ONE_TIME" || type === "MANUAL" ? 0 : Number(installment),
          payment_method:     isOpening ? "CASH" : paymentMethod,
          bank_name:          !isOpening && isBank ? (bankName || paymentMethod) : null,
          reference_no:       refNo || null,
          is_opening_balance: isOpening,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to record advance");
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setErrorMsg("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const label: React.CSSProperties = {
    display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "5px",
  };
  const input: React.CSSProperties = {
    width: "100%", padding: "10px", border: "1px solid #cbd5e1",
    borderRadius: "6px", boxSizing: "border-box",
  };

  const pmBtn = (active: boolean, color: string): React.CSSProperties => ({
    flex: 1,
    padding: "10px 0",
    border: `2px solid ${active ? color : "#e2e8f0"}`,
    borderRadius: "8px",
    background: active ? color + "18" : "white",
    color: active ? color : "#64748b",
    fontWeight: active ? 700 : 500,
    fontSize: "0.9rem",
    cursor: "pointer",
    transition: "all 0.15s",
  });

  // Balance chip colours
  const balChip = (bal: number | null, isActive: boolean): React.CSSProperties => {
    if (bal === null) return {};
    const ok = amountNum <= 0 || amountNum <= bal;
    return {
      fontSize: "0.78rem",
      fontWeight: 700,
      padding: "2px 8px",
      borderRadius: "20px",
      marginLeft: "8px",
      background: isActive ? (ok ? "#dcfce7" : "#fee2e2") : "#f1f5f9",
      color: isActive ? (ok ? "#166534" : "#dc2626") : "#64748b",
    };
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div style={{
        background: "white", width: "520px", maxHeight: "90vh",
        overflowY: "auto", borderRadius: "16px", padding: "28px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "22px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Salary Advance</h3>
            <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: "0.85rem" }}>{employeeName}</p>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "1.1rem" }}>
            <FaTimes />
          </button>
        </div>

        {/* Opening / Existing Advance Toggle */}
        <div
          onClick={() => setIsOpening(v => !v)}
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            marginBottom: "14px", padding: "12px 16px",
            background: isOpening ? "#fef9c3" : "#f8fafc",
            border: `1.5px solid ${isOpening ? "#facc15" : "#e2e8f0"}`,
            borderRadius: "10px", cursor: "pointer", userSelect: "none",
          }}
        >
          {/* Toggle pill */}
          <div style={{
            width: 40, height: 22, borderRadius: 11, flexShrink: 0,
            background: isOpening ? "#eab308" : "#cbd5e1",
            position: "relative", transition: "background 0.2s",
          }}>
            <div style={{
              position: "absolute", top: 3, width: 16, height: 16,
              borderRadius: "50%", background: "#fff",
              left: isOpening ? 21 : 3, transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: isOpening ? "#854d0e" : "#374151" }}>
              {isOpening ? "📋 Recording Existing / Old Advance" : "Record Existing / Old Advance"}
            </div>
            <div style={{ fontSize: "0.75rem", color: isOpening ? "#a16207" : "#94a3b8", marginTop: 1 }}>
              {isOpening
                ? "Cash already given before system setup — no ledger deduction"
                : "Turn ON if this advance was given before the ERP was set up"}
            </div>
          </div>
        </div>

        {/* Live Balance Banner — hidden for opening advances */}
        {!isOpening && <div style={{
          display: "flex", gap: "10px", marginBottom: "18px",
          padding: "10px 14px", background: "#f8fafc",
          borderRadius: "10px", border: "1px solid #e2e8f0",
          fontSize: "0.85rem", alignItems: "center",
        }}>
          <span style={{ color: "#64748b", fontWeight: 600 }}>Available:</span>
          {balLoading ? (
            <span style={{ color: "#94a3b8" }}>Loading balances...</span>
          ) : (
            <>
              <span>
                💵 Cash
                <span style={balChip(cashBal, paymentMethod === "CASH")}>
                  ₹{cashBal !== null ? fmt(cashBal) : "—"}
                </span>
              </span>
              <span style={{ color: "#cbd5e1" }}>|</span>
              <span>
                🏦 Bank
                <span style={balChip(bankBal, isBank)}>
                  ₹{bankBal !== null ? fmt(bankBal) : "—"}
                </span>
              </span>
            </>
          )}
        </div>}

        <form onSubmit={handleSubmit}>

          {/* Amount + Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={label}>Amount (₹) *</label>
              <input
                type="number" required min="1" value={amount}
                onChange={(e) => { setAmount(e.target.value); setErrorMsg(""); }}
                style={{
                  ...input,
                  borderColor: insufficient ? "#fca5a5" : "#cbd5e1",
                  background: insufficient ? "#fff5f5" : "white",
                }}
                placeholder="0.00"
              />
              {insufficient && (
                <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#dc2626" }}>
                  Shortfall: ₹{fmt(amountNum - (activeBalance ?? 0))}
                </p>
              )}
            </div>
            <div>
              <label style={label}>Date *</label>
              <input type="date" required value={date}
                onChange={(e) => setDate(e.target.value)} style={input} />
            </div>
          </div>

          {/* Payment Method — hidden for opening/existing advances */}
          {!isOpening && <div style={{ marginBottom: "16px" }}>
            <label style={label}>Paid Via *</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" style={pmBtn(paymentMethod === "CASH", "#16a34a")}
                onClick={() => { setPaymentMethod("CASH"); setErrorMsg(""); }}>
                💵 Cash
                {cashBal !== null && !balLoading && (
                  <div style={{ fontSize: "0.72rem", marginTop: "2px", opacity: 0.85 }}>
                    ₹{fmt(cashBal)}
                  </div>
                )}
              </button>
              <button type="button" style={pmBtn(paymentMethod === "BANK", "#2563eb")}
                onClick={() => { setPaymentMethod("BANK"); setErrorMsg(""); }}>
                🏦 Bank
                {bankBal !== null && !balLoading && (
                  <div style={{ fontSize: "0.72rem", marginTop: "2px", opacity: 0.85 }}>
                    ₹{fmt(bankBal)}
                  </div>
                )}
              </button>
              <button type="button" style={pmBtn(paymentMethod === "UPI", "#7c3aed")}
                onClick={() => { setPaymentMethod("UPI"); setErrorMsg(""); }}>
                📲 UPI
                {bankBal !== null && !balLoading && (
                  <div style={{ fontSize: "0.72rem", marginTop: "2px", opacity: 0.85 }}>
                    ₹{fmt(bankBal)}
                  </div>
                )}
              </button>
            </div>
          </div>}

          {/* Bank/UPI details */}
          {!isOpening && isBank && (
            <div style={{
              marginBottom: "16px", background: "#eff6ff",
              padding: "12px", borderRadius: "8px",
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
            }}>
              <div>
                <label style={{ ...label, color: "#1d4ed8" }}>
                  {paymentMethod === "UPI" ? "UPI App / ID" : "Bank Name"}
                </label>
                <input value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder={paymentMethod === "UPI" ? "e.g. GPay, PhonePe" : "e.g. ICICI Bank"}
                  style={{ ...input, border: "1px solid #bfdbfe" }} />
              </div>
              <div>
                <label style={{ ...label, color: "#1d4ed8" }}>Reference / TXN No.</label>
                <input value={refNo} onChange={(e) => setRefNo(e.target.value)}
                  placeholder="Optional" style={{ ...input, border: "1px solid #bfdbfe" }} />
              </div>
            </div>
          )}

          {/* Repayment Type */}
          <div style={{ marginBottom: "16px" }}>
            <label style={label}>Repayment Type</label>
            <CustomSelect value={type} onChange={(e) => setType(e.target.value)}
              style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px" }}>
              <option value="ONE_TIME">Deduct Full in Next Salary</option>
              <option value="INSTALLMENT">Fixed Monthly Installment</option>
              <option value="DAILY">Deduct Daily (Per Working Day)</option>
              <option value="MANUAL">Flexible / Any Time (Manual)</option>
            </CustomSelect>
          </div>

          {(type === "INSTALLMENT" || type === "DAILY") && (
            <div style={{ marginBottom: "16px", background: "#eff6ff", padding: "10px", borderRadius: "6px" }}>
              <label style={label}>
                {type === "DAILY" ? "Daily Deduction Amount" : "Monthly Installment Amount"}
              </label>
              <input type="number" required value={installment}
                onChange={(e) => setInstallment(e.target.value)}
                style={{ ...input, border: "1px solid #bfdbfe" }} />
            </div>
          )}

          {type === "MANUAL" && (
            <div style={{ marginBottom: "16px", background: "#f0fdf4", padding: "10px", borderRadius: "6px", fontSize: "0.85rem", color: "#166534" }}>
              ℹ️ No automatic deduction. Admin will deduct manually during payroll or via cash receipt.
            </div>
          )}

          {/* Reason */}
          <div style={{ marginBottom: "20px" }}>
            <label style={label}>Reason / Notes</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)}
              style={{ ...input, resize: "none" }} rows={2}
              placeholder="Purpose of advance..." />
          </div>

          {/* Summary box */}
          {amountNum > 0 && (
            <div style={{
              marginBottom: "16px", padding: "12px 16px",
              background: insufficient ? "#fff5f5" : "#f8fafc",
              borderRadius: "10px",
              border: `1px solid ${insufficient ? "#fca5a5" : "#e2e8f0"}`,
              fontSize: "0.88rem", color: "#334155",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span>Amount</span><strong>₹{fmt(amountNum)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span>Payment Mode</span>
                <strong style={{ color: paymentMethod === "CASH" ? "#16a34a" : paymentMethod === "UPI" ? "#7c3aed" : "#2563eb" }}>
                  {paymentMethod}{isBank && bankName ? ` — ${bankName}` : ""}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span>Available Balance</span>
                <span style={{ color: insufficient ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
                  ₹{activeBalance !== null ? fmt(activeBalance) : "—"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Ledger Impact</span>
                <span style={{ color: "#ef4444" }}>
                  {paymentMethod === "CASH" ? "Cash Out (−)" : "Bank Out (−)"}
                </span>
              </div>
              {insufficient && (
                <div style={{
                  marginTop: "8px", padding: "6px 10px",
                  background: "#fee2e2", borderRadius: "6px",
                  color: "#dc2626", fontWeight: 700, fontSize: "0.82rem",
                }}>
                  ❌ Shortfall: ₹{fmt(amountNum - (activeBalance ?? 0))} — top up {paymentMethod === "CASH" ? "cash" : "bank"} before granting advance
                </div>
              )}
            </div>
          )}

          {/* Error message from backend */}
          {errorMsg && (
            <div style={{
              marginBottom: "12px", padding: "10px 14px",
              background: "#fee2e2", borderRadius: "8px",
              color: "#dc2626", fontSize: "0.88rem", fontWeight: 600,
            }}>
              ❌ {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || insufficient}
            style={{
              width: "100%", padding: "13px",
              background: loading ? "#94a3b8"
                : insufficient ? "#fca5a5"
                : isOpening ? "#d97706"
                : "#2563eb",
              color: "white", border: "none", borderRadius: "10px",
              cursor: loading || insufficient ? "not-allowed" : "pointer",
              fontWeight: 700, fontSize: "1rem",
            }}
          >
            {loading
              ? "Processing..."
              : insufficient
              ? `❌ Insufficient Balance`
              : isOpening
              ? `📋 Record Existing Advance — ₹${fmt(amountNum)}`
              : `Grant Advance — ₹${fmt(amountNum)}`}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdvanceSalaryModal;
