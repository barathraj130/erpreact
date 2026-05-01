// frontend/src/pages/CreateTransaction.tsx
import React, { useEffect, useState } from "react";
import { FaCheckCircle, FaPlus, FaTrash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";
import "./PageShared.css";
import CustomSelect from "../components/CustomSelect";

interface Account {
  id: number;
  account_code: string;
  name: string;
}

interface TransactionLine {
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  description: string;
}

const CreateTransaction: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<TransactionLine[]>([
    { account_id: "", debit_amount: 0, credit_amount: 0, description: "" },
    { account_id: "", debit_amount: 0, credit_amount: 0, description: "" },
  ]);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await apiFetch("/accounting/accounts");
        const data = await response.json();
        if (response.ok) setAccounts(data);
      } catch (error) {
        console.error("Error fetching accounts:", error);
      }
    };
    fetchAccounts();
  }, []);

  const addLine = () => {
    setLines([
      ...lines,
      { account_id: "", debit_amount: 0, credit_amount: 0, description: "" },
    ]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (
    index: number,
    field: keyof TransactionLine,
    value: any,
  ) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const totalDebits = lines.reduce(
    (sum, line) => sum + (line.debit_amount || 0),
    0,
  );
  const totalCredits = lines.reduce(
    (sum, line) => sum + (line.credit_amount || 0),
    0,
  );
  const isBalanced = totalDebits === totalCredits && totalDebits > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced)
      return alert("Double entry must be balanced (Debits = Credits)");

    try {
      const response = await apiFetch("/accounting/transactions", {
        method: "POST",
        body: {
          transaction_date: date,
          description,
          lines: lines.filter(
            (l) => l.account_id && (l.debit_amount > 0 || l.credit_amount > 0),
          ),
        },
      });

      if (response.ok) {
        navigate("/transactions");
      } else {
        const err = await response.json();
        alert(err.error || "Failed to save transaction");
      }
    } catch (error) {
      console.error("Error creating transaction:", error);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: "960px" }}>
      <div className="page-header">
        <div>
          <h1>New Journal Entry</h1>
          <p>Record a manual double-entry financial transaction.</p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "100px",
            fontWeight: 700,
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            background: isBalanced
              ? "rgba(16, 185, 129, 0.1)"
              : "rgba(239, 68, 68, 0.1)",
            color: isBalanced ? "#10b981" : "#ef4444",
          }}
        >
          {isBalanced ? (
            <>
              <FaCheckCircle /> Balanced
            </>
          ) : (
            "Unbalanced"
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "24px" }}
      >
        <div
          style={{
            background: "white",
            padding: "28px",
            borderRadius: "20px",
            border: "1px solid #e2e8f0",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.65rem",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "#94a3b8",
                marginBottom: "8px",
              }}
            >
              Transaction Date
            </label>
            <input
              type="date"
              required
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "#f8fafc",
                borderRadius: "14px",
                outline: "none",
                border: "1px solid transparent",
                fontWeight: 700,
                fontSize: "0.9rem",
                fontFamily: "Poppins, sans-serif",
                boxSizing: "border-box",
              }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.65rem",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "#94a3b8",
                marginBottom: "8px",
              }}
            >
              General Description
            </label>
            <input
              type="text"
              required
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "#f8fafc",
                borderRadius: "14px",
                outline: "none",
                border: "1px solid transparent",
                fontWeight: 700,
                fontSize: "0.9rem",
                fontFamily: "Poppins, sans-serif",
                boxSizing: "border-box",
              }}
              placeholder="e.g. Monthly Rent Payment"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="page-table-wrapper">
          <table className="page-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Description</th>
                <th className="text-right" style={{ width: "120px" }}>
                  Debit (₹)
                </th>
                <th className="text-right" style={{ width: "120px" }}>
                  Credit (₹)
                </th>
                <th style={{ width: "50px" }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td style={{ padding: "12px" }}>
                    <CustomSelect
                      required
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        background: "#f8fafc",
                        borderRadius: "10px",
                        outline: "none",
                        border: "1px solid transparent",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        fontFamily: "Poppins, sans-serif",
                      }}
                      value={line.account_id}
                      onChange={(e) =>
                        updateLine(idx, "account_id", e.target.value)
                      }
                    >
                      <option value="">Select Account</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.account_code} - {a.name}
                        </option>
                      ))}
                    </CustomSelect>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <input
                      type="text"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        background: "#f8fafc",
                        borderRadius: "10px",
                        outline: "none",
                        border: "1px solid transparent",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        fontFamily: "Poppins, sans-serif",
                        boxSizing: "border-box",
                      }}
                      placeholder="Line details..."
                      value={line.description}
                      onChange={(e) =>
                        updateLine(idx, "description", e.target.value)
                      }
                    />
                  </td>
                  <td style={{ padding: "12px" }}>
                    <input
                      type="number"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        background: "#f8fafc",
                        borderRadius: "10px",
                        outline: "none",
                        border: "1px solid transparent",
                        textAlign: "right",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        fontFamily: "Poppins, sans-serif",
                        boxSizing: "border-box",
                      }}
                      value={line.debit_amount}
                      onChange={(e) =>
                        updateLine(
                          idx,
                          "debit_amount",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                    />
                  </td>
                  <td style={{ padding: "12px" }}>
                    <input
                      type="number"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        background: "#f8fafc",
                        borderRadius: "10px",
                        outline: "none",
                        border: "1px solid transparent",
                        textAlign: "right",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        fontFamily: "Poppins, sans-serif",
                        boxSizing: "border-box",
                      }}
                      value={line.credit_amount}
                      onChange={(e) =>
                        updateLine(
                          idx,
                          "credit_amount",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                    />
                  </td>
                  <td style={{ padding: "12px", textAlign: "center" }}>
                    {lines.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          opacity: 0.6,
                          transition: "opacity 0.2s",
                        }}
                      >
                        <FaTrash size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                <td
                  colSpan={2}
                  style={{
                    padding: "14px 24px",
                    textAlign: "right",
                    color: "#64748b",
                  }}
                >
                  TOTAL
                </td>
                <td
                  style={{
                    padding: "14px 24px",
                    textAlign: "right",
                    color: "#6366f1",
                  }}
                >
                  ₹
                  {totalDebits.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td
                  style={{
                    padding: "14px 24px",
                    textAlign: "right",
                    color: "#8b5cf6",
                  }}
                >
                  ₹
                  {totalCredits.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px",
          }}
        >
          <button
            type="button"
            onClick={addLine}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#64748b",
              fontWeight: 700,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "0.88rem",
              fontFamily: "Poppins, sans-serif",
            }}
          >
            <FaPlus /> Add Line Item
          </button>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              type="button"
              onClick={() => navigate("/transactions")}
              style={{
                padding: "14px 28px",
                fontWeight: 700,
                color: "#94a3b8",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "Poppins, sans-serif",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isBalanced}
              className="page-btn"
              style={{
                padding: "14px 32px",
                borderRadius: "14px",
                ...(isBalanced
                  ? { background: "#1e293b", color: "white" }
                  : {
                      background: "#f1f5f9",
                      color: "#94a3b8",
                      cursor: "not-allowed",
                    }),
              }}
            >
              Post Journal Entry
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateTransaction;
