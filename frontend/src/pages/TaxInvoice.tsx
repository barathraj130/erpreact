import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useState } from "react";
import { FaDownload, FaPlus, FaPrint, FaTrash, FaUndo } from "react-icons/fa";
import CustomSelect from "../components/CustomSelect";

/**
 * ERP Tax Invoice Application - Professional Industry Template
 * Fully editable version with input fields integrated into the layout.
 */

interface Item {
  id: number;
  desc: string;
  hsn: string;
  uom: string;
  qty: number;
  rate: number;
}

interface InvoiceState {
  supplier: {
    name: string;
    address: string;
    gstin: string;
  };
  meta: {
    invoiceNo: string;
    invoiceDate: string;
    supplyDate: string;
    placeOfSupply: string;
    placeOfSupplyCode: string;
    sellerState: string;
    sellerCode: string;
    transportation: string;
    vehicle: string;
  };
  billedTo: {
    name: string;
    address: string;
    gstin: string;
    state: string;
    code: string;
  };
  shippedTo: {
    name: string;
    address: string;
    gstin: string;
    state: string;
    code: string;
    ph: string;
  };
  items: Item[];
  gst: {
    cgst: number;
    sgst: number;
    igst: number;
  };
  bank: {
    name: string;
    account: string;
    ifsc: string;
    bundles: string;
  };
  notes: string;
  reverseCharge: string;
}

export default function TaxInvoice() {
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
            body { 
                font-family: 'IBM Plex Sans', sans-serif; 
                background-color: #f1f5f9; 
                color: #000;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .invoice-table th, .invoice-table td {
                border: 0.5px solid #000;
                padding: 4px 6px;
                font-size: 11px;
            }
            .border-box { border: 1px solid #000; }
            .border-b { border-bottom: 1px solid #000; }
            .border-r { border-right: 1px solid #000; }
            
            /* Editable Styles */
            .edit-input {
                width: 100%;
                border: none;
                background: transparent;
                font-family: inherit;
                font-size: inherit;
                color: inherit;
                outline: none;
                padding: 0;
                margin: 0;
            }
            .edit-input:focus {
                background: rgba(0, 97, 254, 0.05);
                box-shadow: inset 0 0 0 1px rgba(0, 97, 254, 0.2);
            }
            .edit-textarea {
                width: 100%;
                border: none;
                background: transparent;
                font-family: inherit;
                font-size: inherit;
                color: inherit;
                outline: none;
                resize: none;
                padding: 0;
                margin: 0;
            }

            @media print {
                body { background: white !important; margin: 0; padding: 0; }
                .no-print { display: none !important; }
                .invoice-wrapper { 
                    padding: 0 !important; 
                    background: white !important;
                    box-shadow: none !important;
                    border: none !important;
                    max-width: 100% !important;
                    width: 100% !important;
                }
                .main-container { width: 100% !important; margin: 0 !important; padding: 5mm !important; }
                @page { size: A4; margin: 5mm; }
                .edit-input:focus { background: transparent; box-shadow: none; }
            }

            .watermark {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(-45deg);
                font-size: 80px;
                font-weight: 600;
                color: rgba(0,0,0,0.03);
                pointer-events: none;
                white-space: nowrap;
                z-index: 0;
                text-transform: uppercase;
            }
        `;
    document.head.appendChild(style);
  }, []);

  const initialData: InvoiceState = {
    supplier: {
      name: "JBS KNITWEAR",
      address:
        "3/2B, Nesavalar Colony, 2nd Street, PN Road, TIRUPUR - 641602, TAMILNADU",
      gstin: "33CKAPJ7513F1ZK",
    },
    meta: {
      invoiceNo: "34",
      invoiceDate: "2025-12-30",
      supplyDate: "2025-12-30",
      placeOfSupply: "KERALA",
      placeOfSupplyCode: "32",
      sellerState: "TAMILNADU",
      sellerCode: "33",
      transportation: "N/A",
      vehicle: "N/A",
    },
    billedTo: {
      name: "TIRUPPUR BAZAR",
      address: "NEAR NEW ALMA HOSPITAL, MANNARKKAD",
      gstin: "32BMSPH6524B1ZA",
      state: "KERALA",
      code: "32",
    },
    shippedTo: {
      name: "JBS KNITWEAR",
      address: "3/2B, Nesavalar Colony, 2nd Street, PN Road, TIRUPUR - 641602",
      gstin: "33CKAPJ7513F1ZK",
      state: "TAMILNADU",
      code: "33",
      ph: "",
    },
    items: [
      { id: 1, desc: "SHORTS", hsn: "6103", uom: "Pcs", qty: 67, rate: 90 },
      {
        id: 2,
        desc: "LADIES PANT",
        hsn: "6104",
        uom: "Pcs",
        qty: 67,
        rate: 60,
      },
    ],
    gst: { cgst: 0, sgst: 0, igst: 5 },
    bank: {
      name: "ICICI Bank",
      account: "540305000194",
      ifsc: "ICIC0005403",
      bundles: "N/A",
    },
    notes: "",
    reverseCharge: "No",
  };

  const [invoice, setInvoice] = useState<InvoiceState>(initialData);

  const updateField = (
    section: keyof InvoiceState,
    key: string,
    value: any,
  ) => {
    setInvoice((prev) => ({
      ...prev,
      [section]: { ...(prev[section] as any), [key]: value },
    }));
  };

  const updateItem = (
    index: number,
    key: keyof Item,
    value: string | number,
  ) => {
    const newItems = [...invoice.items];
    (newItems[index] as any)[key] = value;
    setInvoice({ ...invoice, items: newItems });
  };

  const addItem = () => {
    setInvoice({
      ...invoice,
      items: [
        ...invoice.items,
        { id: Date.now(), desc: "", hsn: "", uom: "Pcs", qty: 0, rate: 0 },
      ],
    });
  };

  const removeItem = (index: number) => {
    const newItems = invoice.items.filter((_, i) => i !== index);
    setInvoice({ ...invoice, items: newItems });
  };

  const totals = useMemo(() => {
    const taxable = invoice.items.reduce(
      (sum, item) => sum + item.qty * item.rate,
      0,
    );
    const cgstAmt = taxable * (invoice.gst.cgst / 100);
    const sgstAmt = taxable * (invoice.gst.sgst / 100);
    const igstAmt = taxable * (invoice.gst.igst / 100);
    const totalGst = cgstAmt + sgstAmt + igstAmt;
    const grandTotal = taxable + totalGst;
    const totalQty = invoice.items.reduce((sum, item) => sum + item.qty, 0);
    return {
      taxable,
      cgstAmt,
      sgstAmt,
      igstAmt,
      totalGst,
      grandTotal,
      totalQty,
    };
  }, [invoice.items, invoice.gst]);

  const numberToWords = (n: number) => {
    const a = [
      "",
      "one ",
      "two ",
      "three ",
      "four ",
      "five ",
      "six ",
      "seven ",
      "eight ",
      "nine ",
      "ten ",
      "eleven ",
      "twelve ",
      "thirteen ",
      "fourteen ",
      "fifteen ",
      "sixteen ",
      "seventeen ",
      "eighteen ",
      "nineteen ",
    ];
    const b = [
      "",
      "",
      "twenty",
      "thirty",
      "forty",
      "fifty",
      "sixty",
      "seventy",
      "eighty",
      "ninety",
    ];

    const inWords = (num: number | string): string => {
      let n_str = num.toString();
      if (n_str.length > 9) return "overflow";
      let match = ("000000000" + n_str)
        .substr(-9)
        .match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
      if (!match) return "";
      let str = "";
      str +=
        Number(match[1]) !== 0
          ? (a[Number(match[1])] ||
              b[Number(match[1][0])] + " " + a[Number(match[1][1])]) + "crore "
          : "";
      str +=
        Number(match[2]) !== 0
          ? (a[Number(match[2])] ||
              b[Number(match[2][0])] + " " + a[Number(match[2][1])]) + "lakh "
          : "";
      str +=
        Number(match[3]) !== 0
          ? (a[Number(match[3])] ||
              b[Number(match[3][0])] + " " + a[Number(match[3][1])]) +
            "thousand "
          : "";
      str +=
        Number(match[4]) !== 0
          ? (a[Number(match[4])] ||
              b[Number(match[4][0])] + " " + a[Number(match[4][1])]) +
            "hundred "
          : "";
      str +=
        Number(match[5]) !== 0
          ? (str !== "" ? "and " : "") +
            (a[Number(match[5])] ||
              b[Number(match[5][0])] + " " + a[Number(match[5][1])])
          : "";
      return str.toUpperCase();
    };

    const amount = Math.floor(n);
    const paise = Math.round((n - amount) * 100);
    let result = inWords(amount) + " RUPEES";
    if (paise > 0) result += " AND " + inWords(paise) + " PAISE";
    return result + " ONLY";
  };

  const emptyRows = useMemo(() => {
    const count = Math.max(0, 12 - invoice.items.length);
    return new Array(count).fill(0);
  }, [invoice.items]);

  const exportJSON = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(invoice, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute(
      "download",
      `invoice_${invoice.meta.invoiceNo}.json`,
    );
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px",
      }}
    >
      <div
        className="invoice-wrapper"
        style={{
          width: "210mm",
          backgroundColor: "#fff",
          boxShadow: "0 0 20px rgba(0,0,0,0.1)",
          padding: "10mm",
          position: "relative",
        }}
      >
        <div className="border-box" style={{ position: "relative" }}>
          <div className="watermark">{invoice.supplier.name}</div>

          {/* Header */}
          <div
            className="border-b"
            style={{ padding: "10px", textAlign: "center" }}
          >
            <input
              className="edit-input"
              style={{
                fontSize: "20px",
                fontWeight: 600,
                textAlign: "center",
                marginBottom: "5px",
              }}
              value={invoice.supplier.name}
              onChange={(e) => updateField("supplier", "name", e.target.value)}
            />
            <textarea
              className="edit-textarea"
              style={{
                fontSize: "11px",
                fontWeight: 600,
                textAlign: "center",
                height: "16px",
              }}
              value={invoice.supplier.address}
              onChange={(e) =>
                updateField("supplier", "address", e.target.value)
              }
            />
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "5px",
                marginTop: "5px",
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: 700 }}>
                GSTIN No.:
              </span>
              <input
                className="edit-input"
                style={{ width: "150px", fontSize: "11px", fontWeight: 700 }}
                value={invoice.supplier.gstin}
                onChange={(e) =>
                  updateField("supplier", "gstin", e.target.value)
                }
              />
            </div>
          </div>

          <div
            className="border-b"
            style={{ padding: "4px", textAlign: "center" }}
          >
            <h2
              style={{
                fontSize: "14px",
                fontWeight: 600,
                textTransform: "uppercase",
                margin: 0,
                letterSpacing: "1px",
              }}
            >
              Tax Invoice
            </h2>
          </div>

          {/* Top Info Grid */}
          <div
            className="border-b"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              fontSize: "11px",
            }}
          >
            <div className="border-r" style={{ padding: "8px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr",
                  gap: "5px",
                  marginBottom: "4px",
                }}
              >
                <span style={{ fontWeight: 700 }}>Invoice No:</span>
                <input
                  className="edit-input"
                  value={invoice.meta.invoiceNo}
                  onChange={(e) =>
                    updateField("meta", "invoiceNo", e.target.value)
                  }
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr",
                  gap: "5px",
                  marginBottom: "4px",
                }}
              >
                <span style={{ fontWeight: 700 }}>Invoice Date:</span>
                <input
                  className="edit-input"
                  type="date"
                  value={invoice.meta.invoiceDate}
                  onChange={(e) =>
                    updateField("meta", "invoiceDate", e.target.value)
                  }
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr",
                  gap: "5px",
                }}
              >
                <span style={{ fontWeight: 700 }}>State:</span>
                <div style={{ display: "flex", gap: "5px" }}>
                  <input
                    className="edit-input"
                    value={invoice.meta.sellerState}
                    onChange={(e) =>
                      updateField("meta", "sellerState", e.target.value)
                    }
                  />
                  <span style={{ fontWeight: 700 }}>Code:</span>
                  <input
                    className="edit-input"
                    style={{ width: "30px" }}
                    value={invoice.meta.sellerCode}
                    onChange={(e) =>
                      updateField("meta", "sellerCode", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
            <div style={{ padding: "8px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: "5px",
                  marginBottom: "4px",
                }}
              >
                <span style={{ fontWeight: 700 }}>Transportation Mode:</span>
                <input
                  className="edit-input"
                  value={invoice.meta.transportation}
                  onChange={(e) =>
                    updateField("meta", "transportation", e.target.value)
                  }
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: "5px",
                  marginBottom: "4px",
                }}
              >
                <span style={{ fontWeight: 700 }}>Vehicle Number:</span>
                <input
                  className="edit-input"
                  value={invoice.meta.vehicle}
                  onChange={(e) =>
                    updateField("meta", "vehicle", e.target.value)
                  }
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: "5px",
                  marginBottom: "4px",
                }}
              >
                <span style={{ fontWeight: 700 }}>Date of Supply:</span>
                <input
                  className="edit-input"
                  type="date"
                  value={invoice.meta.supplyDate}
                  onChange={(e) =>
                    updateField("meta", "supplyDate", e.target.value)
                  }
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: "5px",
                }}
              >
                <span style={{ fontWeight: 700 }}>Place of Supply:</span>
                <div style={{ display: "flex", gap: "5px" }}>
                  <input
                    className="edit-input"
                    value={invoice.meta.placeOfSupply}
                    onChange={(e) =>
                      updateField("meta", "placeOfSupply", e.target.value)
                    }
                  />
                  <span style={{ fontWeight: 700 }}>Code:</span>
                  <input
                    className="edit-input"
                    style={{ width: "30px" }}
                    value={invoice.meta.placeOfSupplyCode}
                    onChange={(e) =>
                      updateField("meta", "placeOfSupplyCode", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Parties Section */}
          <div
            className="border-b"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              fontSize: "10px",
            }}
          >
            <div className="border-r" style={{ padding: "8px" }}>
              <p
                style={{
                  fontWeight: 700,
                  textDecoration: "underline",
                  marginBottom: "5px",
                }}
              >
                Details of Receiver/Billed To:
              </p>
              <input
                className="edit-input"
                style={{
                  fontWeight: 600,
                  fontSize: "11px",
                  marginBottom: "2px",
                }}
                value={invoice.billedTo.name}
                onChange={(e) =>
                  updateField("billedTo", "name", e.target.value)
                }
              />
              <textarea
                className="edit-textarea"
                style={{ height: "32px", marginBottom: "4px" }}
                value={invoice.billedTo.address}
                onChange={(e) =>
                  updateField("billedTo", "address", e.target.value)
                }
              />
              <div style={{ display: "flex", gap: "5px", marginBottom: "2px" }}>
                <span style={{ fontWeight: 700 }}>GSTIN:</span>
                <input
                  className="edit-input"
                  value={invoice.billedTo.gstin}
                  onChange={(e) =>
                    updateField("billedTo", "gstin", e.target.value)
                  }
                />
              </div>
              <div style={{ display: "flex", gap: "5px" }}>
                <span style={{ fontWeight: 700 }}>State:</span>
                <input
                  className="edit-input"
                  value={invoice.billedTo.state}
                  onChange={(e) =>
                    updateField("billedTo", "state", e.target.value)
                  }
                />
                <span style={{ fontWeight: 700 }}>Code:</span>
                <input
                  className="edit-input"
                  style={{ width: "30px" }}
                  value={invoice.billedTo.code}
                  onChange={(e) =>
                    updateField("billedTo", "code", e.target.value)
                  }
                />
              </div>
            </div>
            <div style={{ padding: "8px" }}>
              <p
                style={{
                  fontWeight: 700,
                  textDecoration: "underline",
                  marginBottom: "5px",
                }}
              >
                Details of Consignee/Shipped To:
              </p>
              <input
                className="edit-input"
                style={{
                  fontWeight: 600,
                  fontSize: "11px",
                  marginBottom: "2px",
                }}
                value={invoice.shippedTo.name}
                onChange={(e) =>
                  updateField("shippedTo", "name", e.target.value)
                }
              />
              <textarea
                className="edit-textarea"
                style={{ height: "32px", marginBottom: "4px" }}
                value={invoice.shippedTo.address}
                onChange={(e) =>
                  updateField("shippedTo", "address", e.target.value)
                }
              />
              <div style={{ display: "flex", gap: "5px", marginBottom: "2px" }}>
                <span style={{ fontWeight: 700 }}>PH:</span>
                <input
                  className="edit-input"
                  value={invoice.shippedTo.ph}
                  onChange={(e) =>
                    updateField("shippedTo", "ph", e.target.value)
                  }
                />
              </div>
              <div style={{ display: "flex", gap: "5px", marginBottom: "2px" }}>
                <span style={{ fontWeight: 700 }}>GSTIN:</span>
                <input
                  className="edit-input"
                  value={invoice.shippedTo.gstin}
                  onChange={(e) =>
                    updateField("shippedTo", "gstin", e.target.value)
                  }
                />
              </div>
              <div style={{ display: "flex", gap: "5px" }}>
                <span style={{ fontWeight: 700 }}>State:</span>
                <input
                  className="edit-input"
                  value={invoice.shippedTo.state}
                  onChange={(e) =>
                    updateField("shippedTo", "state", e.target.value)
                  }
                />
                <span style={{ fontWeight: 700 }}>Code:</span>
                <input
                  className="edit-input"
                  style={{ width: "30px" }}
                  value={invoice.shippedTo.code}
                  onChange={(e) =>
                    updateField("shippedTo", "code", e.target.value)
                  }
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <table
            className="invoice-table"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "none",
            }}
          >
            <thead>
              <tr style={{ background: "#f8f8f8" }}>
                <th style={{ width: "30px" }}>Sr.</th>
                <th style={{ textAlign: "left", width: "250px" }}>
                  Name of Product/Service
                </th>
                <th style={{ width: "60px" }}>HSN</th>
                <th style={{ width: "40px" }}>UOM</th>
                <th style={{ width: "50px", textAlign: "right" }}>Qty</th>
                <th style={{ width: "60px", textAlign: "right" }}>Rate</th>
                <th style={{ width: "70px", textAlign: "right" }}>Amount</th>
                <th style={{ width: "70px", textAlign: "right" }}>Taxable</th>
                <th style={{ width: "60px", textAlign: "right" }}>GST</th>
                <th style={{ width: "80px", textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, idx) => {
                const amt = item.qty * item.rate;
                const totalGst =
                  invoice.gst.cgst + invoice.gst.sgst + invoice.gst.igst;
                const gstVal = amt * (totalGst / 100);
                return (
                  <tr key={item.id}>
                    <td style={{ textAlign: "center" }}>{idx + 1}</td>
                    <td>
                      <input
                        className="edit-input"
                        value={item.desc}
                        onChange={(e) =>
                          updateItem(idx, "desc", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="edit-input"
                        style={{ textAlign: "center" }}
                        value={item.hsn}
                        onChange={(e) => updateItem(idx, "hsn", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="edit-input"
                        style={{ textAlign: "center" }}
                        value={item.uom}
                        onChange={(e) => updateItem(idx, "uom", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="edit-input"
                        style={{ textAlign: "right" }}
                        type="number"
                        value={item.qty}
                        onChange={(e) =>
                          updateItem(
                            idx,
                            "qty",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="edit-input"
                        style={{ textAlign: "right" }}
                        type="number"
                        value={item.rate}
                        onChange={(e) =>
                          updateItem(
                            idx,
                            "rate",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />
                    </td>
                    <td style={{ textAlign: "right" }}>{amt.toFixed(2)}</td>
                    <td style={{ textAlign: "right" }}>{amt.toFixed(2)}</td>
                    <td style={{ textAlign: "right" }}>{gstVal.toFixed(2)}</td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        position: "relative",
                        paddingRight: "25px",
                      }}
                    >
                      {(amt + gstVal).toFixed(2)}
                      <button
                        className="no-print"
                        style={{
                          position: "absolute",
                          right: "5px",
                          color: "#ef4444",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          fontSize: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          opacity: 0.6,
                        }}
                        onClick={() => removeItem(idx)}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.opacity = "1")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.opacity = "0.6")
                        }
                        title="Remove Item"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {emptyRows.map((_, i) => (
                <tr key={`empty-${i}`} style={{ height: "22px" }}>
                  <td colSpan={10} style={{ border: "0.5px solid #000" }}></td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, background: "#f8f8f8" }}>
                <td colSpan={4} style={{ textAlign: "right" }}>
                  Total
                </td>
                <td style={{ textAlign: "right" }}>
                  {totals.totalQty.toFixed(2)}
                </td>
                <td></td>
                <td></td>
                <td style={{ textAlign: "right" }}>
                  {totals.taxable.toFixed(2)}
                </td>
                <td style={{ textAlign: "right" }}>
                  {totals.totalGst.toFixed(2)}
                </td>
                <td style={{ textAlign: "right" }}>
                  {totals.grandTotal.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Lower Section */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr",
              fontSize: "11px",
            }}
          >
            <div className="border-r" style={{ padding: "10px" }}>
              <p style={{ fontWeight: 700, marginBottom: "2px" }}>
                Total Amount in words:
              </p>
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: 500,
                  marginBottom: "10px",
                }}
              >
                {numberToWords(totals.grandTotal)}
              </p>

              <div
                style={{ display: "flex", gap: "5px", marginBottom: "10px" }}
              >
                <span style={{ fontWeight: 700 }}>Bundles:</span>
                <input
                  className="edit-input"
                  value={invoice.bank.bundles}
                  onChange={(e) =>
                    updateField("bank", "bundles", e.target.value)
                  }
                />
              </div>

              <p
                style={{
                  fontWeight: 700,
                  textDecoration: "underline",
                  marginBottom: "4px",
                }}
              >
                Bank Details:
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "90px 1fr",
                  rowGap: "2px",
                }}
              >
                <span style={{ fontWeight: 700 }}>BANK NAME:</span>
                <input
                  className="edit-input"
                  value={invoice.bank.name}
                  onChange={(e) => updateField("bank", "name", e.target.value)}
                />
                <span style={{ fontWeight: 700 }}>A/C NO:</span>
                <input
                  className="edit-input"
                  value={invoice.bank.account}
                  onChange={(e) =>
                    updateField("bank", "account", e.target.value)
                  }
                />
                <span style={{ fontWeight: 700 }}>IFSC NO:</span>
                <input
                  className="edit-input"
                  value={invoice.bank.ifsc}
                  onChange={(e) => updateField("bank", "ifsc", e.target.value)}
                />
              </div>

              <div style={{ marginTop: "15px" }}>
                <p style={{ fontWeight: 700 }}>Notes:</p>
                <textarea
                  className="edit-textarea"
                  style={{ height: "40px", fontSize: "10px" }}
                  value={invoice.notes}
                  onChange={(e) => updateField("notes", "", e.target.value)}
                />
              </div>

              <p style={{ marginTop: "30px", color: "#666", fontSize: "10px" }}>
                (Common Seal)
              </p>
            </div>
            <div style={{ padding: "10px" }}>
              <div
                style={{
                  borderBottom: "1px solid #ddd",
                  paddingBottom: "8px",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                  }}
                >
                  <span>Total Amount Before Tax</span>
                  <span>{totals.taxable.toFixed(2)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                  }}
                >
                  <span>Add: CGST %</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <input
                      className="edit-input"
                      style={{ width: "30px", textAlign: "right" }}
                      type="number"
                      value={invoice.gst.cgst}
                      onChange={(e) =>
                        updateField(
                          "gst",
                          "cgst",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                    />
                    <span>{totals.cgstAmt.toFixed(2)}</span>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                  }}
                >
                  <span>Add: SGST %</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <input
                      className="edit-input"
                      style={{ width: "30px", textAlign: "right" }}
                      type="number"
                      value={invoice.gst.sgst}
                      onChange={(e) =>
                        updateField(
                          "gst",
                          "sgst",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                    />
                    <span>{totals.sgstAmt.toFixed(2)}</span>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                  }}
                >
                  <span>Add: IGST %</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <input
                      className="edit-input"
                      style={{ width: "30px", textAlign: "right" }}
                      type="number"
                      value={invoice.gst.igst}
                      onChange={(e) =>
                        updateField(
                          "gst",
                          "igst",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                    />
                    <span>{totals.igstAmt.toFixed(2)}</span>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 600,
                    borderTop: "1px solid #000",
                    paddingTop: "4px",
                  }}
                >
                  <span>Total Amount After Tax</span>
                  <span>{totals.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "5px",
                  fontWeight: 700,
                  marginBottom: "20px",
                }}
              >
                <span>GST Payable on Reverse Charge:</span>
                <CustomSelect
                  className="edit-input"
                  style={{ width: "50px", fontWeight: 500 }}
                  value={invoice.reverseCharge}
                  onChange={(e: any) =>
                    updateField("reverseCharge", "", e.target.value)
                  }
                >
                  <option>No</option>
                  <option>Yes</option>
                </CustomSelect>
              </div>

              <p
                style={{
                  textAlign: "right",
                  fontSize: "9px",
                  fontStyle: "italic",
                  marginTop: "40px",
                }}
              >
                Certified that the particulars given above are true & correct.
              </p>

              <div style={{ textAlign: "right", marginTop: "30px" }}>
                <p
                  style={{
                    fontWeight: 600,
                    fontSize: "11px",
                    marginBottom: "40px",
                  }}
                >
                  For, {invoice.supplier.name}
                </p>
                <p style={{ fontWeight: 700 }}>Authorised Signatory</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div
        className="no-print"
        style={{
          marginTop: "30px",
          display: "flex",
          gap: "15px",
          background: "#fff",
          padding: "15px 30px",
          borderRadius: "50px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        }}
      >
        <button
          onClick={() => setInvoice(initialData)}
          style={btnStyle("outline")}
        >
          <FaUndo /> Reset
        </button>
        <button onClick={addItem} style={btnStyle("outline")}>
          <FaPlus /> Add Item
        </button>
        <button onClick={exportJSON} style={btnStyle("outline")}>
          <FaDownload /> JSON
        </button>
        <button onClick={() => window.print()} style={btnStyle("solid")}>
          <FaPrint /> Print / Save PDF
        </button>
      </div>
    </div>
  );
}

const btnStyle = (v: "solid" | "outline") =>
  ({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 20px",
    borderRadius: "100px",
    border: v === "solid" ? "none" : "1px solid #111",
    background: v === "solid" ? "#111" : "transparent",
    color: v === "solid" ? "#fff" : "#111",
    fontWeight: 700,
    fontSize: "12px",
    cursor: "pointer",
    transition: "0.2s",
  }) as React.CSSProperties;
