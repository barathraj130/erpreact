import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { apiFetch } from "../../utils/api";
import CustomSelect from "../../components/CustomSelect";

interface Props {
  employeeId: number;
  employeeName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const AdvanceSalaryModal: React.FC<Props> = ({
  employeeId,
  employeeName,
  onClose,
  onSuccess,
}) => {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [type, setType] = useState("ONE_TIME");
  const [installment, setInstallment] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/hr/advance", {
        method: "POST",
        body: {
          employee_id: employeeId,
          amount: Number(amount),
          date,
          reason,
          repayment_type: type,
          // Send 0 for manual/one-time types
          installment_amount:
            type === "ONE_TIME" || type === "MANUAL" ? 0 : Number(installment),
        },
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert("Failed to record advance");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "white",
          width: "500px",
          borderRadius: "12px",
          padding: "25px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ margin: 0 }}>Advance for {employeeName}</h3>
          <button
            onClick={onClose}
            style={{ border: "none", background: "none", cursor: "pointer" }}
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "15px" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "5px",
              }}
            >
              Amount (₹)
            </label>
            <input
              type="number"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
              }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "5px",
              }}
            >
              Repayment Type
            </label>
            <CustomSelect
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
              }}
            >
              <option value="ONE_TIME">Deduct Full in Next Salary</option>
              <option value="INSTALLMENT">Fixed Monthly Installment</option>
              <option value="DAILY">Deduct Daily (Per Working Day)</option>
              {/* ✅ NEW OPTION ADDED HERE */}
              <option value="MANUAL">Flexible / Any Time (Manual)</option>
            </CustomSelect>
          </div>

          {/* Show installment input only for INSTALLMENT or DAILY types */}
          {(type === "INSTALLMENT" || type === "DAILY") && (
            <div
              style={{
                marginBottom: "15px",
                background: "#eff6ff",
                padding: "10px",
                borderRadius: "6px",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: "5px",
                }}
              >
                {type === "DAILY"
                  ? "Daily Deduction Amount"
                  : "Monthly Installment Amount"}
              </label>
              <input
                type="number"
                required
                value={installment}
                onChange={(e) => setInstallment(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #bfdbfe",
                  borderRadius: "6px",
                }}
              />
            </div>
          )}

          {type === "MANUAL" && (
            <div
              style={{
                marginBottom: "15px",
                background: "#f0fdf4",
                padding: "10px",
                borderRadius: "6px",
                fontSize: "0.85rem",
                color: "#166534",
              }}
            >
              ℹ️ No automatic deduction. Admin will deduct manually during
              payroll or via cash receipt when employee wishes to pay.
            </div>
          )}

          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "5px",
              }}
            >
              Reason / Notes
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                resize: "none",
              }}
              rows={3}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {loading ? "Processing..." : "Grant Advance"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdvanceSalaryModal;
