import React, { useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaEdit, FaFilePdf, FaPrint, FaTimes, FaTrash } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import QRCode from "react-qr-code";
import { apiFetch } from "../utils/api";

// ─── helpers ────────────────────────────────────────────────
const val = (n: any) => Number(n) || 0;
const fmt = (n: any) =>
  val(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function toWords(num: number): string {
  const a = ["","One ","Two ","Three ","Four ","Five ","Six ","Seven ","Eight ","Nine ","Ten ",
    "Eleven ","Twelve ","Thirteen ","Fourteen ","Fifteen ","Sixteen ","Seventeen ","Eighteen ","Nineteen "];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const s = ("000000000" + Math.floor(num)).substr(-9);
  const n = s.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";
  let str = "";
  const p = (x: number) => a[x] || b[Math.floor(x / 10)] + " " + a[x % 10];
  if (+n[1]) str += p(+n[1]) + "Crore ";
  if (+n[2]) str += p(+n[2]) + "Lakh ";
  if (+n[3]) str += p(+n[3]) + "Thousand ";
  if (+n[4]) str += p(+n[4]) + "Hundred ";
  if (+n[5]) str += (str ? "and " : "") + p(+n[5]);
  return str.trim() + " Rupees Only";
}

// ─── print HTML builder ──────────────────────────────────────
function buildPrintHTML(p: {
  data: any; rows: any[]; isNonTax: boolean; isSameState: boolean;
  totalTaxable: number; totalCGST: number; totalSGST: number; totalIGST: number;
  totalGST: number; grandTotal: number; gstSummary: any[];
  hasUPI: boolean; upiQRValue: string; qrSVG: string;
}): string {
  const { data, rows, isNonTax, isSameState, totalTaxable, totalCGST, totalSGST,
    totalIGST, totalGST, grandTotal, gstSummary, hasUPI, upiQRValue, qrSVG } = p;

  const emptyRows = Math.max(0, 12 - rows.length);

  // Table header
  const thCols = isNonTax
    ? `<th style="width:5%">S.No</th><th style="width:45%;text-align:left">Description</th><th style="width:10%">HSN</th><th style="width:10%">Qty</th><th style="width:15%">Rate</th><th style="width:15%">Amount</th>`
    : `<th style="width:5%">S.No</th><th style="width:35%;text-align:left">Description</th><th style="width:10%">HSN</th><th style="width:8%">Qty</th><th style="width:10%">Rate</th><th style="width:12%">Taxable</th><th style="width:5%">GST%</th><th style="width:15%">Amount</th>`;

  const itemRows = rows.map((r: any, i: number) => {
    if (isNonTax) {
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td style="text-align:left;padding-left:4px">${r.name}</td>
        <td style="text-align:center">${r.hsn}</td>
        <td style="text-align:right;padding-right:4px">${fmt(r.qty)}</td>
        <td style="text-align:right;padding-right:4px">${fmt(r.rate)}</td>
        <td style="text-align:right;padding-right:4px;font-weight:600">${fmt(r.taxable)}</td>
      </tr>`;
    }
    return `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:left;padding-left:4px">${r.name}</td>
      <td style="text-align:center">${r.hsn}</td>
      <td style="text-align:right;padding-right:4px">${fmt(r.qty)}</td>
      <td style="text-align:right;padding-right:4px">${fmt(r.rate)}</td>
      <td style="text-align:right;padding-right:4px">${fmt(r.taxable)}</td>
      <td style="text-align:center">${r.gstRate}%</td>
      <td style="text-align:right;padding-right:4px;font-weight:600">${fmt(r.lineTotal)}</td>
    </tr>`;
  }).join("");

  const emptyRowsHTML = Array(emptyRows).fill(
    isNonTax
      ? `<tr style="height:20px"><td colspan="6"></td></tr>`
      : `<tr style="height:20px"><td colspan="8"></td></tr>`
  ).join("");

  const colSpan = isNonTax ? 3 : 5;
  const totalRow = isNonTax
    ? `<tr style="font-weight:700;background:#f5f5f5">
        <td colspan="3" style="text-align:right;padding-right:6px">Total</td>
        <td style="text-align:right;padding-right:4px">${fmt(rows.reduce((s: number, r: any) => s + r.qty, 0))}</td>
        <td></td>
        <td style="text-align:right;padding-right:4px">${fmt(totalTaxable)}</td>
      </tr>`
    : `<tr style="font-weight:700;background:#f5f5f5">
        <td colspan="3" style="text-align:right;padding-right:6px">Total</td>
        <td style="text-align:right;padding-right:4px">${fmt(rows.reduce((s: number, r: any) => s + r.qty, 0))}</td>
        <td></td>
        <td style="text-align:right;padding-right:4px">${fmt(totalTaxable)}</td>
        <td></td>
        <td style="text-align:right;padding-right:4px">${fmt(grandTotal)}</td>
      </tr>`;

  const gstTableHTML = isNonTax ? "" : `
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:8px">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="border:1px solid #000;padding:4px 6px">GST Rate</th>
          <th style="border:1px solid #000;padding:4px 6px">Taxable Amt</th>
          ${isSameState
            ? `<th style="border:1px solid #000;padding:4px 6px">CGST%</th><th style="border:1px solid #000;padding:4px 6px">CGST Amt</th><th style="border:1px solid #000;padding:4px 6px">SGST%</th><th style="border:1px solid #000;padding:4px 6px">SGST Amt</th>`
            : `<th style="border:1px solid #000;padding:4px 6px">IGST%</th><th style="border:1px solid #000;padding:4px 6px">IGST Amt</th>`}
          <th style="border:1px solid #000;padding:4px 6px">Total Tax</th>
        </tr>
      </thead>
      <tbody>
        ${gstSummary.map((g: any) => `
          <tr>
            <td style="border:1px solid #000;padding:4px 6px;text-align:center">${g.rate}%</td>
            <td style="border:1px solid #000;padding:4px 6px;text-align:right">${fmt(g.taxable)}</td>
            ${isSameState
              ? `<td style="border:1px solid #000;padding:4px 6px;text-align:center">${g.rate / 2}%</td><td style="border:1px solid #000;padding:4px 6px;text-align:right">${fmt(g.cgst)}</td><td style="border:1px solid #000;padding:4px 6px;text-align:center">${g.rate / 2}%</td><td style="border:1px solid #000;padding:4px 6px;text-align:right">${fmt(g.sgst)}</td>`
              : `<td style="border:1px solid #000;padding:4px 6px;text-align:center">${g.rate}%</td><td style="border:1px solid #000;padding:4px 6px;text-align:right">${fmt(g.igst)}</td>`}
            <td style="border:1px solid #000;padding:4px 6px;text-align:right;font-weight:600">${fmt(g.cgst + g.sgst + g.igst)}</td>
          </tr>
        `).join("")}
        <tr style="font-weight:700;background:#f5f5f5">
          <td style="border:1px solid #000;padding:4px 6px">Total</td>
          <td style="border:1px solid #000;padding:4px 6px;text-align:right">${fmt(totalTaxable)}</td>
          ${isSameState
            ? `<td style="border:1px solid #000;padding:4px 6px"></td><td style="border:1px solid #000;padding:4px 6px;text-align:right">${fmt(totalCGST)}</td><td style="border:1px solid #000;padding:4px 6px"></td><td style="border:1px solid #000;padding:4px 6px;text-align:right">${fmt(totalSGST)}</td>`
            : `<td style="border:1px solid #000;padding:4px 6px"></td><td style="border:1px solid #000;padding:4px 6px;text-align:right">${fmt(totalIGST)}</td>`}
          <td style="border:1px solid #000;padding:4px 6px;text-align:right">${fmt(totalGST)}</td>
        </tr>
      </tbody>
    </table>`;

  const qrBlock = hasUPI && qrSVG
    ? `<div style="position:absolute;bottom:0;right:0;width:70px;height:70px">${qrSVG}</div>`
    : "";

  const pointsBlock = (isNonTax && (val(data.points_earned) > 0 || val(data.points_redeemed) > 0))
    ? `<div style="font-size:10px;margin-top:6px;color:#333">
        ${val(data.points_earned) > 0 ? `<span>Points Earned: <b>${val(data.points_earned)}</b></span>&nbsp;&nbsp;` : ""}
        ${val(data.points_redeemed) > 0 ? `<span>Points Redeemed: <b>${val(data.points_redeemed)}</b></span>` : ""}
      </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Invoice ${data.invoice_number || ""}</title>
  <style>
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
    @page { size: A4; margin: 10mm 15mm; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: white; margin: 0; padding: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 4px 6px; font-size: 11px; }
    th { font-weight: 700; background: #f5f5f5; text-align: center; }
    td { text-align: center; }
    tr { page-break-inside: avoid; }
    @media print {
      body { margin: 0; }
      a { text-decoration: none; color: #000; }
    }
  </style>
</head>
<body>
  <div style="border:1px solid #000;position:relative;padding:0">

    <!-- HEADER -->
    <div style="border-bottom:1px solid #000;padding:10px;text-align:center">
      <div style="font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:1px">${data.company_name || "JBS KNITWEAR"}</div>
      <div style="font-size:11px;margin-top:3px">${data.c_address || ""}${data.c_city ? ", " + data.c_city : ""}${data.c_state ? ", " + data.c_state : ""}</div>
      <div style="font-size:11px;margin-top:2px">GSTIN: <b>${data.c_gstin || ""}</b>${data.c_phone ? " | Ph: " + data.c_phone : ""}</div>
    </div>

    <!-- INVOICE TYPE BANNER -->
    <div style="border-bottom:1px solid #000;text-align:center;padding:4px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase">
      ${isNonTax ? "Bill / Non-Tax Invoice" : "Tax Invoice"}
    </div>

    <!-- META GRID -->
    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000;font-size:11px">
      <div style="border-right:1px solid #000;padding:6px 10px">
        <div style="display:grid;grid-template-columns:110px 1fr;margin-bottom:3px"><b>Invoice No:</b><span>${data.invoice_number || ""}</span></div>
        <div style="display:grid;grid-template-columns:110px 1fr;margin-bottom:3px"><b>Invoice Date:</b><span>${data.invoice_date ? new Date(data.invoice_date).toLocaleDateString("en-GB") : ""}</span></div>
        <div style="display:grid;grid-template-columns:110px 1fr"><b>State:</b><span>${data.c_state || ""} &nbsp; <b>Code:</b> ${data.company_state_code || ""}</span></div>
      </div>
      <div style="padding:6px 10px">
        <div style="display:grid;grid-template-columns:140px 1fr;margin-bottom:3px"><b>Transport Mode:</b><span>${data.transport_mode || "N/A"}</span></div>
        <div style="display:grid;grid-template-columns:140px 1fr;margin-bottom:3px"><b>Vehicle Number:</b><span>${data.vehicle_number || "N/A"}</span></div>
        <div style="display:grid;grid-template-columns:140px 1fr;margin-bottom:3px"><b>Date of Supply:</b><span>${new Date(data.date_of_supply || data.invoice_date).toLocaleDateString("en-GB")}</span></div>
        <div style="display:grid;grid-template-columns:140px 1fr"><b>Place of Supply:</b><span>${data.customer_state || data.state || ""} &nbsp; <b>Code:</b> ${data.customer_state_code || data.state_code || ""}</span></div>
      </div>
    </div>

    <!-- BILLED TO / SHIPPED TO -->
    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000;font-size:11px">
      <div style="border-right:1px solid #000;padding:6px 10px">
        <b style="text-decoration:underline">Details of Receiver / Billed To:</b>
        <div style="margin-top:4px;font-weight:600">${data.customer_name || ""}</div>
        <div>${data.address_line1 || ""}</div>
        <div>${data.city_pincode || ""}</div>
        <div><b>GSTIN:</b> ${data.customer_gstin || "UNREGISTERED"}</div>
        <div><b>State:</b> ${data.state || ""} &nbsp; <b>Code:</b> ${data.customer_state_code || data.state_code || ""}</div>
        ${data.customer_phone ? `<div><b>Ph:</b> ${data.customer_phone}</div>` : ""}
      </div>
      <div style="padding:6px 10px">
        <b style="text-decoration:underline">Details of Consignee / Shipped To:</b>
        <div style="margin-top:4px;font-weight:600">${data.ship_to_name || data.customer_name || ""}</div>
        <div>${data.ship_to_address || data.address_line1 || ""}</div>
        <div>${data.ship_to_city || data.city_pincode || ""}</div>
        <div><b>GSTIN:</b> ${data.customer_gstin || "UNREGISTERED"}</div>
        <div><b>State:</b> ${data.ship_to_state || data.state || ""} &nbsp; <b>Code:</b> ${data.ship_to_state_code || data.customer_state_code || ""}</div>
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <table>
      <thead><tr>${thCols}</tr></thead>
      <tbody>
        ${itemRows}
        ${emptyRowsHTML}
        ${totalRow}
      </tbody>
    </table>

    <!-- AMOUNT IN WORDS + GST SUMMARY -->
    <div style="border-top:1px solid #000;padding:8px 10px">
      <div style="font-style:italic;font-size:11px">
        <b>Amount in Words: </b>${toWords(Math.round(grandTotal)).toUpperCase()}
      </div>
      ${gstTableHTML}
      ${pointsBlock}
    </div>

    <!-- TOTALS SECTION -->
    <div style="border-top:1px solid #000;display:flex;justify-content:flex-end">
      <table style="width:240px;border:none">
        <tr>
          <td style="border:none;text-align:right;padding:3px 8px;font-size:12px">Taxable Amount</td>
          <td style="border:none;text-align:right;padding:3px 8px;font-size:12px;min-width:90px">₹${fmt(totalTaxable)}</td>
        </tr>
        ${!isNonTax && isSameState ? `
        <tr>
          <td style="border:none;text-align:right;padding:3px 8px;font-size:12px">Add: CGST</td>
          <td style="border:none;text-align:right;padding:3px 8px;font-size:12px">₹${fmt(totalCGST)}</td>
        </tr>
        <tr>
          <td style="border:none;text-align:right;padding:3px 8px;font-size:12px">Add: SGST</td>
          <td style="border:none;text-align:right;padding:3px 8px;font-size:12px">₹${fmt(totalSGST)}</td>
        </tr>` : ""}
        ${!isNonTax && !isSameState ? `
        <tr>
          <td style="border:none;text-align:right;padding:3px 8px;font-size:12px">Add: IGST</td>
          <td style="border:none;text-align:right;padding:3px 8px;font-size:12px">₹${fmt(totalIGST)}</td>
        </tr>` : ""}
        <tr style="border-top:1px solid #000">
          <td style="border:none;text-align:right;padding:4px 8px;font-size:13px;font-weight:700">Grand Total</td>
          <td style="border:none;text-align:right;padding:4px 8px;font-size:13px;font-weight:700">₹${fmt(grandTotal)}</td>
        </tr>
      </table>
    </div>

    <!-- FOOTER: BANK DETAILS + SIGNATURE -->
    <div style="border-top:1px solid #000;display:grid;grid-template-columns:1.3fr 1fr;font-size:10px;position:relative">
      <div style="border-right:1px solid #000;padding:8px 10px">
        <b style="text-decoration:underline">Bank Details:</b>
        <div style="margin-top:4px"><b>Bank Name:</b> ${data.bank_name || ""}</div>
        <div><b>A/C No:</b> ${data.bank_account_no || ""}</div>
        <div><b>IFSC Code:</b> ${data.bank_ifsc_code || ""}</div>
        <div style="margin-top:8px"><b>Terms &amp; Conditions:</b></div>
        <div>Goods once sold will not be taken back. Subject to local jurisdiction.</div>
        ${data.notes ? `<div style="margin-top:4px">${data.notes}</div>` : ""}
        ${!isNonTax ? `<div style="margin-top:4px"><b>GST Payable on Reverse Charge:</b> ${data.reverse_charge || "No"}</div>` : ""}
      </div>
      <div style="padding:8px 10px;text-align:right;min-height:100px;position:relative">
        <div>For, <b>${data.company_name || ""}</b></div>
        <div style="height:40px"></div>
        <div style="font-weight:700;font-size:11px">Authorised Signatory</div>
        ${qrBlock}
      </div>
    </div>

  </div>
</body>
</html>`;
}

// ─── main component ──────────────────────────────────────────
const InvoiceDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

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
      .then((json) => { setData(json); setLoading(false); })
      .catch((err) => { console.error(err); setError("Could not load invoice."); setLoading(false); });
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm("Delete this invoice permanently?")) return;
    try {
      await apiFetch(`/invoice/${id}`, { method: "DELETE" });
      navigate("/invoices");
    } catch { alert("Delete failed"); }
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

  if (loading) return <div style={{ padding: "40px", textAlign: "center" }}>Loading Invoice...</div>;
  if (error || !data) return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h3 style={{ color: "red" }}>Error</h3>
      <p>{error}</p>
      <button onClick={() => navigate("/invoices")} style={{ marginTop: "20px", cursor: "pointer" }}>Go Back</button>
    </div>
  );

  // ── calculations ────────────────────────────────────────────
  const isNonTax = data.invoice_type === "NON_TAX_INVOICE" || data.invoice_type === "NON-TAX";
  const isSameState = (data.company_state_code || "33") === (data.customer_state_code || data.state_code || "33");
  const items = Array.isArray(data.items) ? data.items : [];

  let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0;
  const rows = items.map((item: any) => {
    const qty = val(item.quantity || item.qty);
    const rate = val(item.unit_price || item.rate);
    const taxable = qty * rate;
    const gstRate = isNonTax ? 0 : val(item.tax_percent || item.gst_rate || 0);
    const gstAmount = (taxable * gstRate) / 100;
    const cgst = val(item.cgst_amount) || (isSameState && !isNonTax ? gstAmount / 2 : 0);
    const sgst = val(item.sgst_amount) || (isSameState && !isNonTax ? gstAmount / 2 : 0);
    const igst = val(item.igst_amount) || (!isSameState && !isNonTax ? gstAmount : 0);
    totalTaxable += taxable;
    totalCGST += cgst;
    totalSGST += sgst;
    totalIGST += igst;
    return { name: item.description || item.name || "", hsn: item.hsn_acs_code || item.hsn || "", qty, rate, taxable, gstRate, cgst, sgst, igst, lineTotal: taxable + cgst + sgst + igst };
  });

  const totalGST = totalCGST + totalSGST + totalIGST;
  const grandTotal = totalTaxable + totalGST;

  const gstSummary = rows.reduce((acc: any[], r: any) => {
    if (!r.gstRate) return acc;
    const ex = acc.find((g: any) => g.rate === r.gstRate);
    if (ex) { ex.taxable += r.taxable; ex.cgst += r.cgst; ex.sgst += r.sgst; ex.igst += r.igst; }
    else acc.push({ rate: r.gstRate, taxable: r.taxable, cgst: r.cgst, sgst: r.sgst, igst: r.igst });
    return acc;
  }, []);

  const upiId = data.upi_id || data.company_upi_id || "";
  const hasUPI = !!upiId;
  const upiQRValue = hasUPI ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(data.company_name || "")}&cu=INR` : "";

  const emptyRows = Math.max(0, 12 - rows.length);

  const doPrint = () => {
    const qrSVG = qrRef.current?.querySelector("svg")?.outerHTML || "";
    const html = buildPrintHTML({ data, rows, isNonTax, isSameState, totalTaxable, totalCGST, totalSGST, totalIGST, totalGST, grandTotal, gstSummary, hasUPI, upiQRValue, qrSVG });
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { alert("Please allow popups to print."); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  // ── PREVIEW LAYOUT (same structure used in modal) ────────────
  const previewColgroup = isNonTax
    ? <colgroup><col style={{ width: "5%" }}/><col style={{ width: "45%" }}/><col style={{ width: "10%" }}/><col style={{ width: "10%" }}/><col style={{ width: "15%" }}/><col style={{ width: "15%" }}/></colgroup>
    : <colgroup><col style={{ width: "5%" }}/><col style={{ width: "35%" }}/><col style={{ width: "10%" }}/><col style={{ width: "8%" }}/><col style={{ width: "10%" }}/><col style={{ width: "12%" }}/><col style={{ width: "5%" }}/><col style={{ width: "15%" }}/></colgroup>;

  const previewThead = isNonTax
    ? <tr style={th}><th style={th}>S.No</th><th style={{ ...th, textAlign: "left" }}>Description</th><th style={th}>HSN</th><th style={th}>Qty</th><th style={th}>Rate</th><th style={th}>Amount</th></tr>
    : <tr><th style={th}>S.No</th><th style={{ ...th, textAlign: "left" }}>Description</th><th style={th}>HSN</th><th style={th}>Qty</th><th style={th}>Rate</th><th style={th}>Taxable</th><th style={th}>GST%</th><th style={th}>Amount</th></tr>;

  return (
    <div style={{ background: "var(--bg-body)", minHeight: "100vh", paddingBottom: "40px" }}>
      {/* ── TOOLBAR ── */}
      <div style={{ background: "white", borderBottom: "1px solid var(--border-color)", padding: windowWidth <= 768 ? "12px 16px" : "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100, boxShadow: "var(--shadow-sm)", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => navigate("/invoices")} className="btn-secondary" style={{ padding: "8px 12px", gap: "6px", height: "40px" }}>
            <FaArrowLeft /> {windowWidth > 480 ? "Back" : ""}
          </button>
          <div>
            <h1 style={{ fontSize: "1.2rem", fontWeight: 600, margin: 0 }}>Invoice #{data.invoice_number}</h1>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {new Date(data.invoice_date).toLocaleDateString()} · {isNonTax ? "Non-Tax" : "Tax Invoice"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => navigate(`/invoices/edit/${id}`)} className="btn-secondary" style={{ color: "var(--primary)", borderColor: "var(--primary-glow)", gap: "6px", padding: "8px 12px", fontSize: "0.85rem" }}>
            <FaEdit /> Edit
          </button>
          <button onClick={handleDelete} className="btn-secondary" style={{ color: "var(--danger)", gap: "6px", padding: "8px 12px", fontSize: "0.85rem" }}>
            <FaTrash /> Delete
          </button>
          <button onClick={() => setShowModal(true)} className="btn-secondary" style={{ gap: "6px", padding: "8px 12px", fontSize: "0.85rem" }}>
            <FaPrint /> Print
          </button>
          <button onClick={handleDownloadPDF} disabled={pdfLoading} className="btn-primary" style={{ opacity: pdfLoading ? 0.7 : 1, gap: "6px", padding: "8px 12px", fontSize: "0.85rem" }}>
            <FaFilePdf /> {pdfLoading ? "..." : "PDF"}
          </button>
        </div>
      </div>

      {/* ── PRINT PREVIEW MODAL ── */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto", padding: "20px 0" }}>
          {/* Modal toolbar */}
          <div style={{ position: "sticky", top: 0, width: "min(794px,96vw)", background: "#1e293b", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderRadius: "8px 8px 0 0", zIndex: 1 }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>Print Preview — Invoice #{data.invoice_number}</span>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={doPrint} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", padding: "7px 16px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                <FaPrint /> Print Now
              </button>
              <button onClick={() => setShowModal(false)} style={{ background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "6px", padding: "7px 12px", cursor: "pointer", fontSize: "13px" }}>
                <FaTimes />
              </button>
            </div>
          </div>

          {/* A4 Preview */}
          <div style={{ width: "min(794px,96vw)", background: "white", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", padding: "10mm 15mm", minHeight: "297mm", fontSize: "11px", fontFamily: "Arial, sans-serif", color: "#000", borderRadius: "0 0 8px 8px" }}>
            <div style={{ border: "1px solid #000" }} ref={qrRef}>

              {/* HEADER */}
              <div style={{ borderBottom: "1px solid #000", padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "18px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>{data.company_name || "JBS KNITWEAR"}</div>
                <div style={{ fontSize: "11px", marginTop: "3px" }}>{data.c_address}{data.c_city ? ", " + data.c_city : ""}{data.c_state ? ", " + data.c_state : ""}</div>
                <div style={{ fontSize: "11px", marginTop: "2px" }}>GSTIN: <b>{data.c_gstin}</b>{data.c_phone ? " | Ph: " + data.c_phone : ""}</div>
              </div>

              {/* BANNER */}
              <div style={{ borderBottom: "1px solid #000", textAlign: "center", padding: "4px", fontSize: "13px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
                {isNonTax ? "Bill / Non-Tax Invoice" : "Tax Invoice"}
              </div>

              {/* META */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #000", fontSize: "11px" }}>
                <div style={{ borderRight: "1px solid #000", padding: "6px 10px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", marginBottom: "3px" }}><b>Invoice No:</b><span>{data.invoice_number}</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", marginBottom: "3px" }}><b>Invoice Date:</b><span>{new Date(data.invoice_date).toLocaleDateString("en-GB")}</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: "110px 1fr" }}><b>State:</b><span>{data.c_state} &nbsp; <b>Code:</b> {data.company_state_code}</span></div>
                </div>
                <div style={{ padding: "6px 10px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", marginBottom: "3px" }}><b>Transport Mode:</b><span>{data.transport_mode || "N/A"}</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", marginBottom: "3px" }}><b>Vehicle Number:</b><span>{data.vehicle_number || "N/A"}</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", marginBottom: "3px" }}><b>Date of Supply:</b><span>{new Date(data.date_of_supply || data.invoice_date).toLocaleDateString("en-GB")}</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr" }}><b>Place of Supply:</b><span>{data.customer_state || data.state} &nbsp; <b>Code:</b> {data.customer_state_code || data.state_code}</span></div>
                </div>
              </div>

              {/* PARTIES */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #000", fontSize: "11px" }}>
                <div style={{ borderRight: "1px solid #000", padding: "6px 10px" }}>
                  <b style={{ textDecoration: "underline" }}>Details of Receiver / Billed To:</b>
                  <div style={{ marginTop: "4px", fontWeight: 600 }}>{data.customer_name}</div>
                  <div>{data.address_line1}</div>
                  <div>{data.city_pincode}</div>
                  <div><b>GSTIN:</b> {data.customer_gstin || "UNREGISTERED"}</div>
                  <div><b>State:</b> {data.state} &nbsp; <b>Code:</b> {data.customer_state_code || data.state_code}</div>
                  {data.customer_phone && <div><b>Ph:</b> {data.customer_phone}</div>}
                </div>
                <div style={{ padding: "6px 10px" }}>
                  <b style={{ textDecoration: "underline" }}>Details of Consignee / Shipped To:</b>
                  <div style={{ marginTop: "4px", fontWeight: 600 }}>{data.ship_to_name || data.customer_name}</div>
                  <div>{data.ship_to_address || data.address_line1}</div>
                  <div>{data.ship_to_city || data.city_pincode}</div>
                  <div><b>GSTIN:</b> {data.customer_gstin || "UNREGISTERED"}</div>
                  <div><b>State:</b> {data.ship_to_state || data.state} &nbsp; <b>Code:</b> {data.ship_to_state_code || data.customer_state_code || data.state_code}</div>
                </div>
              </div>

              {/* TABLE */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                {previewColgroup}
                <thead>{previewThead}</thead>
                <tbody>
                  {rows.map((r: any, i: number) => (
                    <tr key={i}>
                      <td style={td}>{i + 1}</td>
                      <td style={{ ...td, textAlign: "left", paddingLeft: "4px" }}>{r.name}</td>
                      <td style={td}>{r.hsn}</td>
                      <td style={{ ...td, textAlign: "right", paddingRight: "4px" }}>{fmt(r.qty)}</td>
                      <td style={{ ...td, textAlign: "right", paddingRight: "4px" }}>{fmt(r.rate)}</td>
                      {!isNonTax && <td style={{ ...td, textAlign: "right", paddingRight: "4px" }}>{fmt(r.taxable)}</td>}
                      {!isNonTax && <td style={{ ...td, textAlign: "center" }}>{r.gstRate}%</td>}
                      <td style={{ ...td, textAlign: "right", paddingRight: "4px", fontWeight: 600 }}>{fmt(isNonTax ? r.taxable : r.lineTotal)}</td>
                    </tr>
                  ))}
                  {Array(emptyRows).fill(0).map((_: any, i: number) => (
                    <tr key={`e${i}`} style={{ height: "20px" }}>
                      {isNonTax ? <td colSpan={6} style={{ border: "1px solid #000" }}></td> : <td colSpan={8} style={{ border: "1px solid #000" }}></td>}
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, background: "#f5f5f5" }}>
                    {isNonTax
                      ? <><td colSpan={3} style={{ ...td, textAlign: "right", paddingRight: "6px" }}>Total</td><td style={{ ...td, textAlign: "right", paddingRight: "4px" }}>{fmt(rows.reduce((s: number, r: any) => s + r.qty, 0))}</td><td style={td}></td><td style={{ ...td, textAlign: "right", paddingRight: "4px" }}>{fmt(totalTaxable)}</td></>
                      : <><td colSpan={3} style={{ ...td, textAlign: "right", paddingRight: "6px" }}>Total</td><td style={{ ...td, textAlign: "right", paddingRight: "4px" }}>{fmt(rows.reduce((s: number, r: any) => s + r.qty, 0))}</td><td style={td}></td><td style={{ ...td, textAlign: "right", paddingRight: "4px" }}>{fmt(totalTaxable)}</td><td style={td}></td><td style={{ ...td, textAlign: "right", paddingRight: "4px" }}>{fmt(grandTotal)}</td></>
                    }
                  </tr>
                </tbody>
              </table>

              {/* AMOUNT IN WORDS */}
              <div style={{ borderTop: "1px solid #000", padding: "8px 10px" }}>
                <div style={{ fontStyle: "italic", fontSize: "11px" }}>
                  <b>Amount in Words: </b>{toWords(Math.round(grandTotal)).toUpperCase()}
                </div>

                {/* GST SUMMARY TABLE */}
                {!isNonTax && gstSummary.length > 0 && (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginTop: "8px" }}>
                    <thead>
                      <tr style={{ background: "#f5f5f5" }}>
                        <th style={gstTh}>GST Rate</th>
                        <th style={gstTh}>Taxable Amt</th>
                        {isSameState ? <><th style={gstTh}>CGST%</th><th style={gstTh}>CGST Amt</th><th style={gstTh}>SGST%</th><th style={gstTh}>SGST Amt</th></> : <><th style={gstTh}>IGST%</th><th style={gstTh}>IGST Amt</th></>}
                        <th style={gstTh}>Total Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gstSummary.map((g: any, i: number) => (
                        <tr key={i}>
                          <td style={gstTd}>{g.rate}%</td>
                          <td style={{ ...gstTd, textAlign: "right" }}>{fmt(g.taxable)}</td>
                          {isSameState ? <><td style={gstTd}>{g.rate / 2}%</td><td style={{ ...gstTd, textAlign: "right" }}>{fmt(g.cgst)}</td><td style={gstTd}>{g.rate / 2}%</td><td style={{ ...gstTd, textAlign: "right" }}>{fmt(g.sgst)}</td></> : <><td style={gstTd}>{g.rate}%</td><td style={{ ...gstTd, textAlign: "right" }}>{fmt(g.igst)}</td></>}
                          <td style={{ ...gstTd, textAlign: "right", fontWeight: 600 }}>{fmt(g.cgst + g.sgst + g.igst)}</td>
                        </tr>
                      ))}
                      <tr style={{ fontWeight: 700, background: "#f5f5f5" }}>
                        <td style={gstTd}>Total</td>
                        <td style={{ ...gstTd, textAlign: "right" }}>{fmt(totalTaxable)}</td>
                        {isSameState ? <><td style={gstTd}></td><td style={{ ...gstTd, textAlign: "right" }}>{fmt(totalCGST)}</td><td style={gstTd}></td><td style={{ ...gstTd, textAlign: "right" }}>{fmt(totalSGST)}</td></> : <><td style={gstTd}></td><td style={{ ...gstTd, textAlign: "right" }}>{fmt(totalIGST)}</td></>}
                        <td style={{ ...gstTd, textAlign: "right" }}>{fmt(totalGST)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {/* POINTS (NON-TAX only) */}
                {isNonTax && (val(data.points_earned) > 0 || val(data.points_redeemed) > 0) && (
                  <div style={{ fontSize: "10px", marginTop: "6px", color: "#333" }}>
                    {val(data.points_earned) > 0 && <span style={{ marginRight: "12px" }}>Points Earned: <b>{val(data.points_earned)}</b></span>}
                    {val(data.points_redeemed) > 0 && <span>Points Redeemed: <b>{val(data.points_redeemed)}</b></span>}
                  </div>
                )}
              </div>

              {/* TOTALS */}
              <div style={{ borderTop: "1px solid #000", display: "flex", justifyContent: "flex-end" }}>
                <div style={{ width: "240px", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 8px" }}><span>Taxable Amount</span><b>₹{fmt(totalTaxable)}</b></div>
                  {!isNonTax && isSameState && <>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 8px" }}><span>Add: CGST</span><b>₹{fmt(totalCGST)}</b></div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 8px" }}><span>Add: SGST</span><b>₹{fmt(totalSGST)}</b></div>
                  </>}
                  {!isNonTax && !isSameState && <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 8px" }}><span>Add: IGST</span><b>₹{fmt(totalIGST)}</b></div>}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", borderTop: "1px solid #000", fontSize: "13px", fontWeight: 700 }}>
                    <span>Grand Total</span><span>₹{fmt(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div style={{ borderTop: "1px solid #000", display: "grid", gridTemplateColumns: "1.3fr 1fr", fontSize: "10px", position: "relative", minHeight: "100px" }}>
                <div style={{ borderRight: "1px solid #000", padding: "8px 10px" }}>
                  <b style={{ textDecoration: "underline" }}>Bank Details:</b>
                  <div style={{ marginTop: "4px" }}><b>Bank Name:</b> {data.bank_name}</div>
                  <div><b>A/C No:</b> {data.bank_account_no}</div>
                  <div><b>IFSC Code:</b> {data.bank_ifsc_code}</div>
                  <div style={{ marginTop: "8px" }}><b>Terms &amp; Conditions:</b></div>
                  <div>Goods once sold will not be taken back. Subject to local jurisdiction.</div>
                  {data.notes && <div style={{ marginTop: "4px" }}>{data.notes}</div>}
                  {!isNonTax && <div style={{ marginTop: "4px" }}><b>GST Payable on Reverse Charge:</b> {data.reverse_charge || "No"}</div>}
                </div>
                <div style={{ padding: "8px 10px", textAlign: "right", position: "relative" }}>
                  <div>For, <b>{data.company_name}</b></div>
                  <div style={{ height: "40px" }}></div>
                  <div style={{ fontWeight: 700, fontSize: "11px" }}>Authorised Signatory</div>
                  {hasUPI && (
                    <div style={{ position: "absolute", bottom: "8px", right: "8px", width: "60px", height: "60px" }}>
                      <QRCode value={upiQRValue} size={60} />
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── SCREEN PREVIEW (non-modal) ── */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: "32px", padding: "0 20px" }}>
        <div style={{ width: "min(794px, 100%)", background: "white", boxShadow: "0 10px 40px rgba(0,0,0,0.12)", padding: windowWidth <= 768 ? "10px" : "15mm", transform: windowWidth < 800 ? `scale(${(windowWidth - 40) / 794})` : "none", transformOrigin: "top center", marginBottom: windowWidth < 800 ? `-${297 * 3.78 * (1 - (windowWidth - 40) / 794)}px` : "0" }}>
          <div style={{ textAlign: "center", padding: "10px", borderBottom: "1px solid #ddd" }}>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>{data.company_name || "JBS KNITWEAR"}</h2>
            <p style={{ margin: "3px 0", fontSize: "11px", color: "#555" }}>{data.c_address}{data.c_city ? ", " + data.c_city : ""}{data.c_state ? ", " + data.c_state : ""}</p>
            <p style={{ margin: "2px 0", fontSize: "11px" }}>GSTIN: {data.c_gstin}</p>
          </div>
          <div style={{ textAlign: "center", padding: "8px", borderBottom: "1px solid #eee", fontWeight: 600, color: "#374151" }}>
            Invoice #{data.invoice_number} · {isNonTax ? "Non-Tax" : "Tax Invoice"} · {new Date(data.invoice_date).toLocaleDateString("en-GB")}
          </div>
          <div style={{ padding: "16px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>
            <FaPrint style={{ fontSize: "24px", marginBottom: "8px", opacity: 0.3 }} />
            <p>Click <b>Print</b> in the toolbar to see the full print preview.</p>
            <p style={{ marginTop: "4px" }}>Grand Total: <b style={{ color: "#111" }}>₹{fmt(grandTotal)}</b> · Items: {rows.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── style constants ───────────────────────────────────────────
const th: React.CSSProperties = { border: "1px solid #000", padding: "4px 6px", fontSize: "11px", fontWeight: 700, background: "#f5f5f5", textAlign: "center" };
const td: React.CSSProperties = { border: "1px solid #000", padding: "4px 6px", fontSize: "11px", textAlign: "center" };
const gstTh: React.CSSProperties = { border: "1px solid #000", padding: "4px 6px", fontSize: "11px", fontWeight: 700, textAlign: "center" };
const gstTd: React.CSSProperties = { border: "1px solid #000", padding: "4px 6px", fontSize: "11px", textAlign: "center" };

export default InvoiceDetails;
