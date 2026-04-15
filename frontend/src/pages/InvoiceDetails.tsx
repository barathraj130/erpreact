import React, { useEffect, useRef, useState } from "react";
import {
  FaArrowLeft,
  FaEdit,
  FaFilePdf,
  FaPrint,
  FaTrash,
} from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../utils/api";

const InvoiceDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    apiFetch(`/invoice/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Invoice not found");
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load invoice. It might have been deleted.");
        setLoading(false);
      });
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm("Delete this invoice permanently?")) return;
    try {
      await apiFetch(`/invoice/${id}`, { method: "DELETE" });
      navigate("/invoices");
    } catch (e) {
      alert("Delete failed");
    }
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open("", "", "width=900,height=650");
    w?.document.write(
      `<html><head><title>Invoice</title><style>body{margin:0;padding:0;font-family:Arial}table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:4px;font-size:10px}@media print{body{margin:0;padding:0}}</style></head><body>${content}</body></html>`,
    );
    w?.document.close();
    w?.focus();
    w?.print();
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const response = await apiFetch(`/invoice/${id}/pdf?t=${Date.now()}`);
      if (!response.ok) throw new Error("PDF generation failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Invoice_${data?.invoice_number || id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert("Failed to download PDF: " + error.message);
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading)
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        Loading Invoice...
      </div>
    );
  if (error || !data)
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h3 style={{ color: "red" }}>Error</h3>
        <p>{error}</p>
        <button
          onClick={() => navigate("/invoices")}
          style={{ marginTop: "20px", cursor: "pointer" }}
        >
          Go Back
        </button>
      </div>
    );

  const val = (n: any) => Number(n) || 0;
  const fmt = (n: any) =>
    val(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Calculate values exactly as in CreateInvoice
  const items = Array.isArray(data.items) ? data.items : [];
  const isSameState =
    (data.company_state_code || "33") ===
    (data.customer_state_code || data.state_code || "33");

  let totalTaxable = 0,
    totalCGST = 0,
    totalSGST = 0,
    totalIGST = 0;
  const rows = items.map((item: any) => {
    const qty = val(item.quantity || item.qty);
    const rate = val(item.unit_price || item.rate);
    const taxable = qty * rate;
    const gstRate = 5; // Fixed rate as used in UI calculations
    const gstAmount = (taxable * gstRate) / 100;

    const cgst = isSameState ? gstAmount / 2 : 0;
    const sgst = isSameState ? gstAmount / 2 : 0;
    const igst = !isSameState ? gstAmount : 0;

    totalTaxable += taxable;
    totalCGST += cgst;
    totalSGST += sgst;
    totalIGST += igst;

    return {
      name: item.description || item.name || "",
      hsn: item.hsn_acs_code || item.hsn || "",
      uom: "Pcs",
      qty,
      rate,
      amount: taxable,
      taxable,
      cgst,
      sgst,
      igst,
      lineTotal: taxable + gstAmount,
    };
  });

  const totalGST = totalCGST + totalSGST + totalIGST;
  const grandTotal = totalTaxable + totalGST;

  const toWords = (num: number): string => {
    const a = [
      "",
      "One ",
      "Two ",
      "Three ",
      "Four ",
      "Five ",
      "Six ",
      "Seven ",
      "Eight ",
      "Nine ",
      "Ten ",
      "Eleven ",
      "Twelve ",
      "Thirteen ",
      "Fourteen ",
      "Fifteen ",
      "Sixteen ",
      "Seventeen ",
      "Eighteen ",
      "Nineteen ",
    ];
    const b = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];
    const formatted = ("000000000" + num).substr(-9);
    const n = formatted.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return "";
    let str = "";
    const n1 = Number(n[1]);
    const n2 = Number(n[2]);
    const n3 = Number(n[3]);
    const n4 = Number(n[4]);
    const n5 = Number(n[5]);
    if (n1 !== 0)
      str += (a[n1] || b[Math.floor(n1 / 10)] + " " + a[n1 % 10]) + "Crore ";
    if (n2 !== 0)
      str += (a[n2] || b[Math.floor(n2 / 10)] + " " + a[n2 % 10]) + "Lakh ";
    if (n3 !== 0)
      str += (a[n3] || b[Math.floor(n3 / 10)] + " " + a[n3 % 10]) + "Thousand ";
    if (n4 !== 0)
      str += (a[n4] || b[Math.floor(n4 / 10)] + " " + a[n4 % 10]) + "Hundred ";
    if (n5 !== 0)
      str +=
        (str !== "" ? "and " : "") +
        (a[n5] || b[Math.floor(n5 / 10)] + " " + a[n5 % 10]) +
        "only ";
    return str;
  };

  return (
    <div
      className="page-transition"
      style={{
        background: "var(--bg-body)",
        minHeight: "100vh",
        paddingBottom: "40px",
      }}
    >
      {/* Header / Toolbar */}
      <div
        style={{
          background: "white",
          borderBottom: "1px solid var(--border-color)",
          padding: window.innerWidth <= 768 ? "12px 16px" : "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "var(--shadow-sm)",
          flexWrap: "wrap",
          gap: windowWidth <= 768 ? "12px" : "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: windowWidth <= 768 ? "12px" : "16px",
            width: windowWidth <= 768 ? "100%" : "auto",
          }}
        >
          <button
            onClick={() => navigate("/invoices")}
            className="btn-secondary"
            style={{
              padding: "8px 12px",
              gap: "6px",
              height: "40px",
              flexShrink: 0,
            }}
          >
            <FaArrowLeft /> {windowWidth <= 480 ? "" : "Back"}
          </button>
          <div style={{ flexGrow: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <h1
                style={{
                  fontSize: windowWidth <= 480 ? "1.1rem" : "1.25rem",
                  fontWeight: 600,
                  color: "var(--text-main)",
                  margin: 0,
                  lineHeight: 1,
                }}
              >
                Invoice #{data.invoice_number}
              </h1>
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  padding: "2px 6px",
                  background: "var(--bg-body)",
                  borderRadius: "4px",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-color)",
                }}
              >
                Viewing
              </span>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginTop: "2px",
                display: "block",
              }}
            >
              {new Date(data.invoice_date).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            width: windowWidth <= 768 ? "100%" : "auto",
          }}
        >
          <button
            onClick={() => navigate(`/invoices/edit/${id}`)}
            className="btn-secondary"
            style={{
              color: "var(--primary)",
              borderColor: "var(--primary-glow)",
              gap: "6px",
              flex: windowWidth <= 480 ? 1 : "initial",
              padding: "8px 12px",
              fontSize: "0.85rem",
            }}
          >
            <FaEdit /> Edit
          </button>
          <button
            onClick={handleDelete}
            className="btn-secondary"
            style={{
              color: "var(--danger)",
              borderColor: "rgba(239, 68, 68, 0.2)",
              gap: "6px",
              flex: windowWidth <= 480 ? 1 : "initial",
              padding: "8px 12px",
              fontSize: "0.85rem",
            }}
          >
            <FaTrash /> Delete
          </button>
          {windowWidth > 480 && (
            <div
              style={{
                width: "1px",
                background: "var(--border-color)",
                margin: "0 4px",
                height: "24px",
                alignSelf: "center",
              }}
            ></div>
          )}
          <button
            onClick={handlePrint}
            className="btn-secondary"
            style={{
              gap: "6px",
              flex: windowWidth <= 480 ? 1 : "initial",
              padding: "8px 12px",
              fontSize: "0.85rem",
            }}
          >
            <FaPrint /> Print
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="btn-primary"
            style={{
              opacity: pdfLoading ? 0.7 : 1,
              gap: "6px",
              flex: windowWidth <= 480 ? 1 : "initial",
              padding: "8px 12px",
              fontSize: "0.85rem",
            }}
          >
            <FaFilePdf />{" "}
            {pdfLoading ? "..." : windowWidth <= 480 ? "PDF" : "Download PDF"}
          </button>
        </div>
      </div>

      {/* Print Preview Container */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: windowWidth <= 768 ? "20px" : "40px",
          padding: windowWidth <= 768 ? "0 10px" : "0 20px",
          overflow: "hidden",
        }}
      >
        <div
          ref={printRef}
          style={{
            width: "210mm",
            minWidth: "210mm",
            minHeight: "297mm",
            background: "#fff",
            padding: windowWidth <= 768 ? "10px" : "15px",
            boxShadow:
              "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
            boxSizing: "border-box",
            flexShrink: 0,
            transform:
              windowWidth < 800 ? `scale(${(windowWidth - 20) / 794})` : "none",
            transformOrigin: "top center",
            marginBottom:
              windowWidth < 800
                ? `-${297 * 3.78 * (1 - (windowWidth - 20) / 794)}px`
                : "0",
          }}
        >
          <div
            style={{
              border: "1px solid #000",
              width: "100%",
              position: "relative",
              padding: "10px",
            }}
          >
            {/* TRIPLICATE INDICATOR */}
            <div
              style={{
                position: "absolute",
                top: "5px",
                right: "5px",
                fontSize: "9px",
                textAlign: "right",
                border: "1px solid #ccc",
                padding: "3px 6px",
                background: "white",
                zIndex: 10,
              }}
            >
              <div style={{ color: "red", fontWeight: "bold" }}>
                Original for Recipient
              </div>
              <div style={{ color: "blue", fontWeight: "bold" }}>
                Duplicate for Supplier
              </div>
              <div style={{ color: "green", fontWeight: "bold" }}>
                Triplicate for Supplier
              </div>
            </div>

            {/* Header */}
            <div
              style={{
                textAlign: "center",
                padding: "10px 0 5px 0",
                clear: "both",
              }}
            >
              <h1
                style={{
                  margin: "0",
                  fontSize: "24px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {data.company_name || "JBS KNITWEAR"}
              </h1>
              <p style={{ margin: "2px 0", fontSize: "11px" }}>
                {data.c_address ||
                  "3/2B, Nesavalar Colony, 2nd Street, PN Road"}
                , {data.c_city || "TIRUPUR"} - {data.c_pincode || "641602"},{" "}
                {data.c_state || "TAMILNADU"}
              </p>
              <p
                style={{
                  margin: "2px 0 0 0",
                  fontSize: "11px",
                  fontWeight: "bold",
                }}
              >
                GSTIN No.: {data.c_gstin || "33CKAPJ7513F1ZK"}
              </p>
            </div>

            <div
              style={{
                borderTop: "2px solid #000",
                borderBottom: "2px solid #000",
                textAlign: "center",
                padding: "4px 5px",
                fontWeight: "700",
                fontSize: "14px",
                textTransform: "uppercase",
              }}
            >
              TAX INVOICE
            </div>

            {/* Metadata Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                borderBottom: "1px solid #000",
                fontSize: "11px",
              }}
            >
              <div style={{ padding: "4px 0" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 1fr",
                    padding: "2px 10px",
                  }}
                >
                  <span style={{ fontWeight: "bold" }}>Invoice No:</span>
                  <span>{data.invoice_number}</span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 1fr",
                    padding: "2px 10px",
                  }}
                >
                  <span style={{ fontWeight: "bold" }}>Invoice Date:</span>
                  <span>
                    {new Date(data.invoice_date).toLocaleDateString("en-GB")}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 1fr",
                    padding: "2px 10px",
                  }}
                >
                  <span style={{ fontWeight: "bold" }}>State:</span>
                  <span>
                    {data.c_state || "TAMILNADU"},{" "}
                    <b style={{ marginLeft: "4px" }}>State Code:</b>{" "}
                    {data.company_state_code || "33"}
                  </span>
                </div>
              </div>
              <div style={{ padding: "4px 0" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "135px 1fr",
                    padding: "2px 10px",
                  }}
                >
                  <span style={{ fontWeight: "bold" }}>
                    Transportation Mode:
                  </span>
                  <span>{data.transport_mode || "N/A"}</span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "135px 1fr",
                    padding: "2px 10px",
                  }}
                >
                  <span style={{ fontWeight: "bold" }}>Vehicle Number:</span>
                  <span>{data.vehicle_number || "N/A"}</span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "135px 1fr",
                    padding: "2px 10px",
                  }}
                >
                  <span style={{ fontWeight: "bold" }}>Date of Supply:</span>
                  <span>
                    {new Date(
                      data.date_of_supply || data.invoice_date,
                    ).toLocaleDateString("en-GB")}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "135px 1fr",
                    padding: "2px 10px",
                  }}
                >
                  <span style={{ fontWeight: "bold" }}>Place of Supply:</span>
                  <span>
                    {data.customer_state || data.state || "KERALA"},{" "}
                    <b style={{ marginLeft: "4px" }}>State Code:</b>{" "}
                    {data.customer_state_code || data.state_code || "32"}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Details */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                borderBottom: "1px solid #000",
                fontSize: "11px",
              }}
            >
              <div style={{ borderRight: "1px solid #000", padding: "5px" }}>
                <b style={{ textDecoration: "underline" }}>
                  Details of Receiver/Billed To:
                </b>
                <div style={{ marginTop: "4px", fontWeight: "bold" }}>
                  {data.customer_name || "TIRUPPUR BAZAR"}
                </div>
                <div>{data.address_line1 || "NEAR NEW ALMA HOSPITAL"}</div>
                <div>{data.city_pincode || "MANNARKKAD"}</div>
                <div>
                  <b>GSTIN:</b> {data.customer_gstin || "32BMSPH6524B1ZA"}
                </div>
                <div>
                  <b>State:</b> {data.state || "KERALA"}, <b>Code:</b>{" "}
                  {data.customer_state_code || data.state_code || "32"}
                </div>
              </div>
              <div style={{ padding: "5px" }}>
                <b style={{ textDecoration: "underline" }}>
                  Details of Consignee/Shipped To:
                </b>
                <div style={{ marginTop: "4px", fontWeight: "bold" }}>
                  {data.ship_to_name || data.customer_name || "JBS KNITWEAR"}
                </div>
                <div>
                  {data.ship_to_address ||
                    "3/2B, Nesavalar Colony, 2nd Street, PN Road"}
                </div>
                <div>{data.ship_to_city || "TIRUPUR - 641602"}</div>
                <div>
                  <b>PH:</b> {data.customer_phone || ""}
                </div>
                <div>
                  <b>GSTIN:</b> {data.customer_gstin || "33CKAPJ7513F1ZK"}
                </div>
                <div>
                  <b>State:</b> {data.ship_to_state || "TAMILNADU"},{" "}
                  <b>Code:</b> {data.ship_to_state_code || "33"}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ minHeight: "380px" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "10px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "2px solid #000",
                      borderTop: "1px solid #000",
                    }}
                  >
                    <th style={{ ...tableHStyle, width: "35px" }}>Sr.</th>
                    <th style={{ ...tableHStyle, textAlign: "center" }}>
                      Name of Product/Service
                    </th>
                    <th style={{ ...tableHStyle, width: "50px" }}>HSN</th>
                    <th style={{ ...tableHStyle, width: "35px" }}>UOM</th>
                    <th style={{ ...tableHStyle, width: "55px" }}>Qty</th>
                    <th style={{ ...tableHStyle, width: "65px" }}>Rate</th>
                    <th style={{ ...tableHStyle, width: "70px" }}>Amount</th>
                    <th style={{ ...tableHStyle, width: "70px" }}>Taxable</th>
                    <th style={{ ...tableHStyle, width: "65px" }}>GST</th>
                    <th
                      style={{
                        ...tableHStyle,
                        borderRight: "none",
                        width: "85px",
                      }}
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 15 }).map((_, i) => {
                    const r = rows[i] || {};
                    // Total GST cell combines CGST, SGST, IGST
                    const itemGST =
                      (r.cgst || 0) + (r.sgst || 0) + (r.igst || 0);

                    return (
                      <tr key={i} style={{ height: "20px" }}>
                        <td style={tableCStyle}>{r.name ? i + 1 : ""}</td>
                        <td
                          style={{
                            ...tableCStyle,
                            textAlign: "left",
                            paddingLeft: "4px",
                          }}
                        >
                          {r.name || ""}
                        </td>
                        <td style={tableCStyle}>{r.hsn || ""}</td>
                        <td style={tableCStyle}>
                          {r.uom || (r.name ? "Pcs" : "")}
                        </td>
                        <td
                          style={{
                            ...tableCStyle,
                            textAlign: "right",
                            paddingRight: "4px",
                          }}
                        >
                          {r.qty ? fmt(r.qty) : ""}
                        </td>
                        <td
                          style={{
                            ...tableCStyle,
                            textAlign: "right",
                            paddingRight: "4px",
                          }}
                        >
                          {r.rate ? fmt(r.rate) : ""}
                        </td>
                        <td
                          style={{
                            ...tableCStyle,
                            textAlign: "right",
                            paddingRight: "4px",
                          }}
                        >
                          {r.amount ? fmt(r.amount) : ""}
                        </td>
                        <td
                          style={{
                            ...tableCStyle,
                            textAlign: "right",
                            paddingRight: "4px",
                          }}
                        >
                          {r.taxable ? fmt(r.taxable) : ""}
                        </td>
                        <td
                          style={{
                            ...tableCStyle,
                            textAlign: "right",
                            paddingRight: "4px",
                          }}
                        >
                          {r.name ? fmt(itemGST) : ""}
                        </td>
                        <td
                          style={{
                            ...tableCStyle,
                            textAlign: "right",
                            paddingRight: "4px",
                            borderRight: "none",
                          }}
                        >
                          {r.lineTotal ? fmt(r.lineTotal) : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr
                    style={{
                      fontWeight: "bold",
                      borderTop: "2px solid #000",
                      borderBottom: "2px solid #000",
                    }}
                  >
                    <td
                      colSpan={4}
                      style={{
                        ...tableCStyle,
                        textAlign: "right",
                        paddingRight: "6px",
                      }}
                    >
                      Total
                    </td>
                    <td
                      style={{
                        ...tableCStyle,
                        textAlign: "right",
                        paddingRight: "4px",
                      }}
                    >
                      {fmt(
                        items.reduce(
                          (s: number, i: any) => s + val(i.qty || i.quantity),
                          0,
                        ),
                      )}
                    </td>
                    <td style={tableCStyle}></td>
                    <td style={tableCStyle}></td>
                    <td
                      style={{
                        ...tableCStyle,
                        textAlign: "right",
                        paddingRight: "4px",
                      }}
                    >
                      {fmt(totalTaxable)}
                    </td>
                    <td
                      style={{
                        ...tableCStyle,
                        textAlign: "right",
                        paddingRight: "4px",
                      }}
                    >
                      {fmt(totalGST)}
                    </td>
                    <td
                      style={{
                        ...tableCStyle,
                        textAlign: "right",
                        paddingRight: "4px",
                        borderRight: "none",
                      }}
                    >
                      {fmt(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer Section */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 0.8fr",
                fontSize: "11px",
                minHeight: "150px",
              }}
            >
              <div
                style={{
                  borderRight: "1px solid #000",
                  padding: "6px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "4px",
                    flexWrap: "wrap",
                    fontWeight: "bold",
                  }}
                >
                  <span>Total Amount in words:</span>
                  <span style={{ textTransform: "uppercase" }}>
                    {grandTotal
                      ? toWords(Math.round(grandTotal))
                      : "ZERO RUPEES ONLY"}
                  </span>
                </div>
                <div style={{ marginTop: "16px", fontWeight: "bold" }}>
                  Bundles: {data.bundles_count || "N/A"}
                </div>
                <div style={{ marginTop: "16px" }}>
                  <b style={{ textDecoration: "underline" }}>Bank Details:</b>
                  <br />
                  <b>BANK NAME:</b> {data.bank_name || "ICICI Bank"}
                  <br />
                  <b>A/C NO:</b> {data.bank_account_no || "540305000194"}
                  <br />
                  <b>IFSC NO:</b> {data.bank_ifsc_code || "ICIC0005403"}
                  <br />
                </div>
                <div style={{ marginTop: "16px", fontWeight: "bold" }}>
                  Notes:
                  <div style={{ marginTop: "4px", fontWeight: "normal" }}>
                    {data.notes || ""}
                  </div>
                </div>
              </div>
              <div
                style={{
                  padding: "6px 12px",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
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
                  <span>{fmt(totalTaxable)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                  }}
                >
                  <span>Add: CGST</span>
                  <span>{fmt(totalCGST)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                  }}
                >
                  <span>Add: SGST</span>
                  <span>{fmt(totalSGST)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                    borderBottom: "1px solid #000",
                    paddingBottom: "4px",
                  }}
                >
                  <span>Add: IGST</span>
                  <span>{fmt(totalIGST)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                    fontWeight: "bold",
                  }}
                >
                  <span>Total Amount After Tax</span>
                  <span>{fmt(grandTotal)}</span>
                </div>

                <div style={{ fontSize: "10px", marginTop: "8px" }}>
                  <b>GST Payable on Reverse Charge:</b>{" "}
                  {data.reverse_charge || "No"}
                </div>

                <div style={{ marginTop: "auto", textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "9px",
                      fontStyle: "italic",
                      marginBottom: "16px",
                      textAlign: "center",
                      width: "100%",
                    }}
                  >
                    Certified that the particulars given above are true &
                    correct.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const tableHStyle: React.CSSProperties = {
  borderRight: "1px solid #000",
  padding: "4px 2px",
  fontSize: "9px",
  fontWeight: "bold",
};
const tableCStyle: React.CSSProperties = {
  borderRight: "1px solid #000",
  textAlign: "center",
  fontSize: "10px",
  borderBottom: "1px solid #000",
};
const footerRowStyle: React.CSSProperties = {
  borderBottom: "1px solid #000",
  padding: "4px",
};
const footerValStyle: React.CSSProperties = {
  borderBottom: "1px solid #000",
  padding: "4px",
  textAlign: "right",
  borderLeft: "1px solid #000",
  width: "100px",
};

export default InvoiceDetails;
