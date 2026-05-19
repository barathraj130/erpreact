import React, { useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaEdit, FaFilePdf, FaPrint, FaTimes, FaTrash } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../utils/api";

// ─── helpers ─────────────────────────────────────────────────────────────────
const val = (n: any) => Number(n) || 0;
const fmt = (n: any) =>
  val(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: any) =>
  val(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function toWords(num: number): string {
  const a = ["","One ","Two ","Three ","Four ","Five ","Six ","Seven ","Eight ","Nine ",
    "Ten ","Eleven ","Twelve ","Thirteen ","Fourteen ","Fifteen ","Sixteen ","Seventeen ","Eighteen ","Nineteen "];
  const b = ["","","Twenty ","Thirty ","Forty ","Fifty ","Sixty ","Seventy ","Eighty ","Ninety "];
  const s = ("000000000" + Math.floor(num)).substr(-9);
  const n = s.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "ZERO";
  const p = (x: number) => x < 20 ? a[x] : b[Math.floor(x / 10)] + a[x % 10];
  let str = "";
  if (+n[1]) str += p(+n[1]) + "Crore ";
  if (+n[2]) str += p(+n[2]) + "Lakh ";
  if (+n[3]) str += p(+n[3]) + "Thousand ";
  if (+n[4]) str += p(+n[4]) + "Hundred ";
  if (+n[5]) str += (str ? "And " : "") + p(+n[5]);
  return (str.trim() + " Rupees Only").toUpperCase();
}

// ─── print HTML — exact PDF replica ──────────────────────────────────────────
function buildPrintHTML(p: {
  data: any; rows: any[]; isNonTax: boolean; isSameState: boolean;
  totalTaxable: number; totalCGST: number; totalSGST: number; totalIGST: number;
  totalGST: number; grandTotal: number; totalQty: number;
}): string {
  const { data, rows, isNonTax, isSameState,
    totalTaxable, totalCGST, totalSGST, totalIGST, totalGST, grandTotal, totalQty } = p;

  const cgstRate = totalTaxable > 0 ? ((totalCGST / totalTaxable) * 100).toFixed(2) : "0.00";
  const sgstRate = totalTaxable > 0 ? ((totalSGST / totalTaxable) * 100).toFixed(2) : "0.00";
  const igstRate = totalTaxable > 0 ? ((totalIGST / totalTaxable) * 100).toFixed(2) : "0.00";

  const EMPTY_ROWS = 15;
  const emptyCount = Math.max(0, EMPTY_ROWS - rows.length);

  const itemRowsHTML = rows.map((r: any, i: number) => {
    const discount = 0;
    const itemCGSTRate = (!isNonTax && isSameState) ? (r.gstRate / 2) : 0;
    const itemIGSTRate = (!isNonTax && !isSameState) ? r.gstRate : 0;
    return `
      <tr style="font-size:10px">
        <td style="text-align:center;border:1px solid #000;padding:2px 3px">${i + 1}</td>
        <td style="text-align:left;border:1px solid #000;padding:2px 4px;font-weight:500">${r.name}</td>
        <td style="text-align:center;border:1px solid #000;padding:2px 3px">${r.hsn}</td>
        <td style="text-align:center;border:1px solid #000;padding:2px 3px">${r.uom || "Pcs"}</td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px">${fmtInt(r.qty)}</td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px">${fmtInt(r.rate)}</td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px">${fmtInt(r.taxable)}</td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px">${discount || ""}</td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px">${fmtInt(r.taxable)}</td>
        <td style="text-align:center;border:1px solid #000;padding:2px 3px">${itemCGSTRate || 0}</td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px">${fmtInt(isNonTax ? 0 : r.cgst)}</td>
        <td style="text-align:center;border:1px solid #000;padding:2px 3px">${itemIGSTRate || 0}</td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px">${fmtInt(isNonTax ? 0 : r.igst)}</td>
        <td style="text-align:right;border:1px solid #000;padding:2px 4px;font-weight:600">${fmtInt(r.lineTotal)}</td>
      </tr>`;
  }).join("");

  const emptyRowsHTML = Array(emptyCount).fill(`
    <tr style="height:18px">
      ${Array(14).fill('<td style="border:1px solid #000;padding:2px 3px"></td>').join("")}
    </tr>`).join("");

  const invoiceTypeLabel = "INVOICE";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Invoice ${data.invoice_number || ""}</title>
  <style>
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; margin:0; padding:0; }
    @page { size: A4; margin: 8mm 10mm; }
    body { font-family: Arial, sans-serif; font-size: 10px; color: #000; background: white; }
    table { width: 100%; border-collapse: collapse; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
<div style="border:1.5px solid #000;width:100%;position:relative">

  <!-- ══ HEADER ══ -->
  <div style="padding:6px 10px;text-align:center;border-bottom:1px solid #000;position:relative">
    <div style="position:absolute;top:4px;right:4px;font-size:8px;line-height:1.5;text-align:right;border:1px solid #999;padding:3px 6px;background:white">
      <div style="color:#cc0000;font-weight:700">Original for Receipient</div>
      <div style="color:#0000cc;font-weight:700">Duplicate for Supplier / Transporter</div>
      <div style="color:#007700;font-weight:700">Triplicate for Supplier</div>
    </div>
    <div style="font-size:22px;font-weight:700;letter-spacing:0.5px">${data.company_name || "JBS KNIT WEAR"}</div>
    <div style="font-size:10px;margin-top:2px">${data.c_address || ""}${data.c_city ? ", " + data.c_city : ""}</div>
    <div style="font-size:10px">${data.c_state || "TAMILNADU"}</div>
    <div style="font-size:10.5px;font-weight:700;margin-top:2px">GSTIN No. : ${data.c_gstin || ""}</div>
  </div>

  <!-- ══ INVOICE TITLE ══ -->
  <div style="padding:4px;text-align:center;border-bottom:1px solid #000">
    <span style="font-size:18px;font-weight:700;letter-spacing:2px">${invoiceTypeLabel}</span>
  </div>

  <!-- ══ META INFO ══ -->
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000;font-size:10px">
    <div style="border-right:1px solid #000;padding:4px 8px">
      <div style="display:grid;grid-template-columns:110px 1fr;margin-bottom:2px"><span>Reverse Charge</span><span>: ${data.reverse_charge || ""}</span></div>
      <div style="display:grid;grid-template-columns:110px 1fr;margin-bottom:2px"><span><b>Invoice No</b></span><span>: <b>${data.invoice_number || ""}</b></span></div>
      <div style="display:grid;grid-template-columns:110px 1fr;margin-bottom:2px"><span>Invoice Date</span><span>: ${data.invoice_date ? new Date(data.invoice_date).toLocaleDateString("en-GB") : ""}</span></div>
      <div style="display:grid;grid-template-columns:110px 1fr"><span>State</span><span>: ${data.c_state || ""} &nbsp;&nbsp; <b>State Code:</b> ${data.company_state_code || "33"}</span></div>
    </div>
    <div style="padding:4px 8px">
      <div style="display:grid;grid-template-columns:130px 1fr;margin-bottom:2px"><span>Transportation Mode</span><span>: ${data.transport_mode || ""}</span></div>
      <div style="display:grid;grid-template-columns:130px 1fr;margin-bottom:2px"><span>Vehicle Number</span><span>: ${data.vehicle_number || ""}</span></div>
      <div style="display:grid;grid-template-columns:130px 1fr;margin-bottom:2px"><span>Date of Supply</span><span>: ${data.date_of_supply ? new Date(data.date_of_supply).toLocaleDateString("en-GB") : ""}</span></div>
      <div style="display:grid;grid-template-columns:130px 1fr"><span><b>Place of Supply</b></span><span>: ${data.customer_state || data.state || ""} &nbsp;&nbsp; <b>State Code:</b> ${data.customer_state_code || data.state_code || "33"}</span></div>
    </div>
  </div>

  <!-- ══ PARTY DETAILS ══ -->
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000;font-size:10px">
    <div style="border-right:1px solid #000">
      <div style="background:#f0f0f0;border-bottom:1px solid #ccc;padding:2px 8px;font-weight:700;font-size:9px;text-align:center">Details of Receiver Billed To :</div>
      <div style="padding:4px 8px">
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span>Name</span><span>: <b>${data.customer_name || ""}</b></span></div>
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span>Address</span><span>: ${data.address_line1 || ""}</span></div>
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span></span><span>: ${data.city_pincode || ""}</span></div>
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span>GSTIN</span><span>: <b>${data.customer_gstin || ""}</b></span></div>
        <div style="display:grid;grid-template-columns:50px 1fr"><span>State</span><span>: ${data.state || ""} &nbsp; <b>State Code:</b> ${data.customer_state_code || data.state_code || ""}</span></div>
      </div>
    </div>
    <div>
      <div style="background:#f0f0f0;border-bottom:1px solid #ccc;padding:2px 8px;font-weight:700;font-size:9px;text-align:center">Details of Consignee</div>
      <div style="padding:4px 8px">
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span>Name</span><span>: <b>${data.ship_to_name || data.company_name || ""}</b></span></div>
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span>Address</span><span>: ${data.c_address || ""}</span></div>
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span></span><span>: Pin-${data.c_pincode || (data.c_city || "").replace(/[^0-9]/g, "") || ""}</span></div>
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span></span><span>: ${data.c_phone ? "PH-" + data.c_phone : ""}</span></div>
        <div style="display:grid;grid-template-columns:50px 1fr;margin-bottom:2px"><span>GSTIN</span><span>: <b>${data.c_gstin || ""}</b></span></div>
        <div style="display:grid;grid-template-columns:50px 1fr"><span>State</span><span>: ${data.c_state || ""} &nbsp; <b>State Code:</b> ${data.company_state_code || "33"}</span></div>
      </div>
    </div>
  </div>

  <!-- ══ ITEMS TABLE ══ -->
  <table style="width:100%;border-collapse:collapse;font-size:10px">
    <thead>
      <tr style="background:#f0f0f0">
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:28px;font-size:9px">Sr.<br>No</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 4px;text-align:center;font-size:9px">Name of Product / Service</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:52px;font-size:9px">HSN ACS</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:28px;font-size:9px">Uom</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:40px;font-size:9px">Qty</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:42px;font-size:9px">Rate</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:50px;font-size:9px">Amount</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:46px;font-size:9px">Less:<br>Discount</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:52px;font-size:9px">Taxable<br>Value</th>
        <th colspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;font-size:9px">CGST</th>
        <th colspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;font-size:9px">IGST</th>
        <th rowspan="2" style="border:1px solid #000;padding:3px 2px;text-align:center;width:52px;font-size:9px">Total</th>
      </tr>
      <tr style="background:#f0f0f0">
        <th style="border:1px solid #000;padding:2px;text-align:center;width:34px;font-size:9px">Rate</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;width:48px;font-size:9px">Amount</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;width:34px;font-size:9px">Rate</th>
        <th style="border:1px solid #000;padding:2px;text-align:center;width:48px;font-size:9px">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRowsHTML}
      ${emptyRowsHTML}
      <tr style="font-weight:700;background:#f5f5f5;font-size:10px">
        <td colspan="4" style="border:1px solid #000;padding:3px 4px;text-align:center">Total</td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">${fmtInt(totalQty)}</td>
        <td style="border:1px solid #000;padding:3px 4px"></td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">${fmtInt(totalTaxable)}</td>
        <td style="border:1px solid #000;padding:3px 4px"></td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">${fmtInt(totalTaxable)}</td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">${isNonTax ? 0 : 0}</td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">${isNonTax ? 0 : fmtInt(totalCGST)}</td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">0</td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right">${isNonTax ? 0 : fmtInt(totalIGST)}</td>
        <td style="border:1px solid #000;padding:3px 4px;text-align:right;font-weight:700">${fmtInt(grandTotal)}</td>
      </tr>
    </tbody>
  </table>

  <!-- ══ FOOTER ══ -->
  <div style="display:grid;grid-template-columns:1.15fr 1fr;border-top:1px solid #000;font-size:10px">

    <!-- LEFT: Amount in Words + Bank Details -->
    <div style="border-right:1px solid #000;padding:6px 8px;display:flex;flex-direction:column;gap:4px">
      <div style="font-size:9px;font-weight:700;border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:2px">Total Invoice Amount in words</div>
      <div style="font-size:12px;font-style:italic;font-weight:600;line-height:1.4;min-height:32px">${toWords(Math.round(grandTotal))}</div>
      <div style="margin-top:4px"><b>Bundles</b> : ${data.bundles_count || ""}</div>
      <div style="margin-top:8px;font-size:9px;font-weight:700;text-decoration:underline;letter-spacing:0.3px;">&#9654; Bank Details</div>
      <table style="border-collapse:collapse;font-size:9px;margin-top:3px;width:100%;">
        ${data.bank_name       ? `<tr><td style="padding:1px 4px 1px 0;font-weight:600;color:#333;white-space:nowrap;">Bank Name</td><td style="padding:1px 4px;color:#333;">:</td><td style="padding:1px 0;font-weight:700;">${data.bank_name}</td></tr>` : ""}
        ${data.bank_account_no ? `<tr><td style="padding:1px 4px 1px 0;font-weight:600;color:#333;white-space:nowrap;">Account No</td><td style="padding:1px 4px;color:#333;">:</td><td style="padding:1px 0;font-weight:700;letter-spacing:0.5px;">${data.bank_account_no}</td></tr>` : ""}
        ${data.bank_ifsc_code  ? `<tr><td style="padding:1px 4px 1px 0;font-weight:600;color:#333;white-space:nowrap;">IFSC Code</td><td style="padding:1px 4px;color:#333;">:</td><td style="padding:1px 0;font-weight:700;">${data.bank_ifsc_code}</td></tr>` : ""}
        ${data.bank_upi_id     ? `<tr><td style="padding:1px 4px 1px 0;font-weight:600;color:#333;white-space:nowrap;">UPI ID</td><td style="padding:1px 4px;color:#333;">:</td><td style="padding:1px 0;font-weight:700;">${data.bank_upi_id}</td></tr>` : ""}
      </table>
      ${data.notes ? `<div style="margin-top:4px;font-size:9px;color:#444">${data.notes}</div>` : ""}
      <div style="margin-top:auto;padding-top:20px;text-align:center;font-size:9px;color:#666">(Common Seal)</div>
    </div>

    <!-- RIGHT: Totals + Signature -->
    <div style="padding:6px 10px;display:flex;flex-direction:column">
      <table style="width:100%;border-collapse:collapse;font-size:10px">
        <tr>
          <td style="padding:2px 4px">Total Amount Before Tax</td>
          <td style="padding:2px 4px;text-align:center">:</td>
          <td style="padding:2px 4px;text-align:right;font-weight:600">${fmtInt(totalTaxable)}</td>
        </tr>
        ${!isNonTax && isSameState ? `
        <tr>
          <td style="padding:2px 4px">Add: &nbsp; CGST &nbsp; ${cgstRate}%</td>
          <td style="padding:2px 4px;text-align:center">:</td>
          <td style="padding:2px 4px;text-align:right;font-weight:600">${fmtInt(totalCGST)}</td>
        </tr>
        <tr>
          <td style="padding:2px 4px">Add: &nbsp; SGST &nbsp; ${sgstRate}%</td>
          <td style="padding:2px 4px;text-align:center">:</td>
          <td style="padding:2px 4px;text-align:right;font-weight:600">${fmtInt(totalSGST)}</td>
        </tr>
        <tr>
          <td style="padding:2px 4px">Add: &nbsp; IGST</td>
          <td style="padding:2px 4px;text-align:center">:</td>
          <td style="padding:2px 4px;text-align:right"></td>
        </tr>` : ""}
        ${!isNonTax && !isSameState ? `
        <tr>
          <td style="padding:2px 4px">Add: &nbsp; CGST</td>
          <td style="padding:2px 4px;text-align:center">:</td>
          <td style="padding:2px 4px;text-align:right"></td>
        </tr>
        <tr>
          <td style="padding:2px 4px">Add: &nbsp; SGST</td>
          <td style="padding:2px 4px;text-align:center">:</td>
          <td style="padding:2px 4px;text-align:right"></td>
        </tr>
        <tr>
          <td style="padding:2px 4px">Add: &nbsp; IGST &nbsp; ${igstRate}%</td>
          <td style="padding:2px 4px;text-align:center">:</td>
          <td style="padding:2px 4px;text-align:right;font-weight:600">${fmtInt(totalIGST)}</td>
        </tr>` : ""}
        ${!isNonTax ? `
        <tr style="border-top:1px solid #ccc">
          <td style="padding:2px 4px"><b>Tax Amount: &nbsp; GST</b></td>
          <td style="padding:2px 4px;text-align:center">:</td>
          <td style="padding:2px 4px;text-align:right;font-weight:700">${fmtInt(totalGST)}</td>
        </tr>` : ""}
        <tr style="border-top:1.5px solid #000">
          <td style="padding:3px 4px;font-weight:700">Total Amount After Tax</td>
          <td style="padding:3px 4px;text-align:center;font-weight:700">:</td>
          <td style="padding:3px 4px;text-align:right;font-weight:700;font-size:12px">${fmtInt(grandTotal)}</td>
        </tr>
      </table>

      <div style="margin-top:6px;border-top:1px solid #ddd;padding-top:4px">
        <div>GST Payable on Reverse Charge &nbsp;: ${data.reverse_charge || ""}</div>
        <div style="margin-top:4px;font-size:9px;font-style:italic">Certified that the particulars given above are true &amp; correct.</div>
        <div style="margin-top:4px;font-weight:700">For, ${data.company_name || ""}</div>
      </div>

      <div style="margin-top:auto;padding-top:30px;text-align:right">
        <div style="font-weight:700;font-size:11px">Authorised Signatory</div>
        <div style="font-size:9px;margin-top:2px">[E &amp; OE]</div>
      </div>
    </div>

  </div>
</div>
</body>
</html>`;
}

// ─── component ────────────────────────────────────────────────────────────────
const InvoiceDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    apiFetch(`/invoice/${id}`)
      .then((res) => { if (!res.ok) throw new Error("Not found"); return res.json(); })
      .then((json) => { setData(json); setLoading(false); })
      .catch((err) => { console.error(err); setError("Could not load invoice."); setLoading(false); });
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm("Delete this invoice permanently?")) return;
    try { await apiFetch(`/invoice/${id}`, { method: "DELETE" }); navigate("/invoices"); }
    catch { alert("Delete failed"); }
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const response = await apiFetch(`/invoice/${id}/pdf?t=${Date.now()}`);
      if (!response.ok) throw new Error("PDF generation failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `Invoice_${data?.invoice_number || id}.pdf`;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); window.URL.revokeObjectURL(url);
    } catch (e: any) { alert("Failed to download PDF: " + e.message); }
    finally { setPdfLoading(false); }
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center" }}>Loading Invoice...</div>;
  if (error || !data) return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h3 style={{ color: "red" }}>Error</h3><p>{error}</p>
      <button onClick={() => navigate("/invoices")} style={{ marginTop: "20px", cursor: "pointer" }}>Go Back</button>
    </div>
  );

  // ── compute ──────────────────────────────────────────────────────────────────
  const isNonTax = data.invoice_type === "NON_TAX_INVOICE" || data.invoice_type === "NON-TAX";
  const isSameState = (data.company_state_code || "33") === (data.customer_state_code || data.state_code || "33");
  const items = Array.isArray(data.items) ? data.items : [];

  // Sale totals (for Before/After Tax box — returns excluded)
  let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0, totalQty = 0;
  const rows = items.map((item: any) => {
    const isReturn = item.is_return === true || item.is_return === 1 || Number(item.quantity || item.qty) < 0;
    const qty = val(item.quantity || item.qty);
    const rate = val(item.unit_price || item.rate);
    const taxable = Math.abs(qty) * rate;
    const gstRate = isNonTax ? 0 : val(item.tax_percent || item.gst_rate || 0);
    const gstAmt = (taxable * gstRate) / 100;
    const cgst = val(item.cgst_amount) || (isSameState && !isNonTax ? gstAmt / 2 : 0);
    const sgst = val(item.sgst_amount) || (isSameState && !isNonTax ? gstAmt / 2 : 0);
    const igst = val(item.igst_amount) || (!isSameState && !isNonTax ? gstAmt : 0);
    // Only add SALE items to the tax totals (not returns)
    if (!isReturn) {
      totalTaxable += taxable; totalCGST += cgst; totalSGST += sgst; totalIGST += igst; totalQty += Math.abs(qty);
    }
    return {
      name: item.description || item.name || "",
      hsn: item.hsn_acs_code || item.hsn || "",
      uom: item.uom || "Pcs",
      qty: Math.abs(qty), rate, taxable, gstRate, cgst, sgst, igst,
      isReturn,
      lineTotal: taxable + cgst + sgst + igst,
    };
  });

  const totalGST = totalCGST + totalSGST + totalIGST;
  // grandTotal = pure sale total (taxable + GST), NO returns/discounts
  const grandTotal = totalTaxable + totalGST;
  const cgstRate = totalTaxable > 0 ? ((totalCGST / totalTaxable) * 100).toFixed(2) : "0.00";
  const sgstRate = totalTaxable > 0 ? ((totalSGST / totalTaxable) * 100).toFixed(2) : "0.00";
  const igstRate = totalTaxable > 0 ? ((totalIGST / totalTaxable) * 100).toFixed(2) : "0.00";
  const EMPTY_ROWS = 15;
  const emptyCount = Math.max(0, EMPTY_ROWS - rows.length);

  const doPrint = () => {
    const html = buildPrintHTML({ data, rows, isNonTax, isSameState, totalTaxable, totalCGST, totalSGST, totalIGST, totalGST, grandTotal, totalQty });
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { alert("Please allow popups to print."); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  // ── PREVIEW content (same layout as print, rendered in React) ─────────────
  const InvoicePreview = () => (
    <div style={{ border: "1.5px solid #000", position: "relative", fontSize: "10px", fontFamily: "Arial, sans-serif", color: "#000" }}>

      {/* HEADER */}
      <div style={{ padding: "8px 10px", textAlign: "center", borderBottom: "1px solid #000", position: "relative" }}>
        <div style={{ position: "absolute", top: "4px", right: "4px", fontSize: "8px", lineHeight: 1.6, textAlign: "right", border: "1px solid #999", padding: "3px 6px", background: "white" }}>
          <div style={{ color: "#cc0000", fontWeight: 700 }}>Original for Receipient</div>
          <div style={{ color: "#0000cc", fontWeight: 700 }}>Duplicate for Supplier / Transporter</div>
          <div style={{ color: "#007700", fontWeight: 700 }}>Triplicate for Supplier</div>
        </div>
        <div style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "0.5px" }}>{data.company_name || "JBS KNIT WEAR"}</div>
        <div style={{ fontSize: "10px", marginTop: "2px" }}>{data.c_address}{data.c_city ? ", " + data.c_city : ""}</div>
        <div style={{ fontSize: "10px" }}>{data.c_state || "TAMILNADU"}</div>
        <div style={{ fontSize: "10.5px", fontWeight: 700, marginTop: "2px" }}>GSTIN No. : {data.c_gstin}</div>
      </div>

      {/* TITLE */}
      <div style={{ textAlign: "center", padding: "4px", borderBottom: "1px solid #000" }}>
        <span style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "2px" }}>INVOICE</span>
      </div>

      {/* META */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #000", fontSize: "10px" }}>
        <div style={{ borderRight: "1px solid #000", padding: "4px 8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", marginBottom: "2px" }}><span>Reverse Charge</span><span>: {data.reverse_charge || ""}</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", marginBottom: "2px" }}><b>Invoice No</b><span>: <b>{data.invoice_number}</b></span></div>
          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", marginBottom: "2px" }}><span>Invoice Date</span><span>: {new Date(data.invoice_date).toLocaleDateString("en-GB")}</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr" }}><span>State</span><span>: {data.c_state} &nbsp; <b>State Code:</b> {data.company_state_code || "33"}</span></div>
        </div>
        <div style={{ padding: "4px 8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", marginBottom: "2px" }}><span>Transportation Mode</span><span>: {data.transport_mode || ""}</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", marginBottom: "2px" }}><span>Vehicle Number</span><span>: {data.vehicle_number || ""}</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", marginBottom: "2px" }}><span>Date of Supply</span><span>: {data.date_of_supply ? new Date(data.date_of_supply).toLocaleDateString("en-GB") : ""}</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "130px 1fr" }}><b>Place of Supply</b><span>: {data.customer_state || data.state} &nbsp; <b>State Code:</b> {data.customer_state_code || data.state_code || ""}</span></div>
        </div>
      </div>

      {/* PARTIES */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #000", fontSize: "10px" }}>
        <div style={{ borderRight: "1px solid #000" }}>
          <div style={{ background: "#f0f0f0", borderBottom: "1px solid #ccc", padding: "2px 8px", fontWeight: 700, fontSize: "9px", textAlign: "center" }}>Details of Receiver Billed To :</div>
          <div style={{ padding: "4px 8px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "50px 1fr", marginBottom: "2px" }}><span>Name</span><span>: <b>{data.customer_name}</b></span></div>
            <div style={{ display: "grid", gridTemplateColumns: "50px 1fr", marginBottom: "2px" }}><span>Address</span><span>: {data.address_line1}</span></div>
            {data.city_pincode && <div style={{ display: "grid", gridTemplateColumns: "50px 1fr", marginBottom: "2px" }}><span></span><span>: {data.city_pincode}</span></div>}
            {data.customer_gstin && <div style={{ display: "grid", gridTemplateColumns: "50px 1fr", marginBottom: "2px" }}><span>GSTIN</span><span>: <b>{data.customer_gstin}</b></span></div>}
            <div style={{ display: "grid", gridTemplateColumns: "50px 1fr" }}><span>State</span><span>: {data.state} &nbsp; <b>State Code:</b> {data.customer_state_code || data.state_code}</span></div>
          </div>
        </div>
        <div>
          <div style={{ background: "#f0f0f0", borderBottom: "1px solid #ccc", padding: "2px 8px", fontWeight: 700, fontSize: "9px", textAlign: "center" }}>Details of Consignee</div>
          <div style={{ padding: "4px 8px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "50px 1fr", marginBottom: "2px" }}><span>Name</span><span>: <b>{data.ship_to_name || data.company_name}</b></span></div>
            <div style={{ display: "grid", gridTemplateColumns: "50px 1fr", marginBottom: "2px" }}><span>Address</span><span>: {data.c_address}</span></div>
            {data.c_phone && <div style={{ display: "grid", gridTemplateColumns: "50px 1fr", marginBottom: "2px" }}><span></span><span>: PH-{data.c_phone}</span></div>}
            <div style={{ display: "grid", gridTemplateColumns: "50px 1fr", marginBottom: "2px" }}><span>GSTIN</span><span>: <b>{data.c_gstin}</b></span></div>
            <div style={{ display: "grid", gridTemplateColumns: "50px 1fr" }}><span>State</span><span>: {data.c_state} &nbsp; <b>State Code:</b> {data.company_state_code || "33"}</span></div>
          </div>
        </div>
      </div>

      {/* ITEMS TABLE */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px" }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th rowSpan={2} style={TH}>Sr.<br/>No</th>
            <th rowSpan={2} style={{ ...TH, textAlign: "left", paddingLeft: "4px" }}>Name of Product / Service</th>
            <th rowSpan={2} style={{ ...TH, width: "52px" }}>HSN ACS</th>
            <th rowSpan={2} style={{ ...TH, width: "28px" }}>Uom</th>
            <th rowSpan={2} style={{ ...TH, width: "40px" }}>Qty</th>
            <th rowSpan={2} style={{ ...TH, width: "42px" }}>Rate</th>
            <th rowSpan={2} style={{ ...TH, width: "50px" }}>Amount</th>
            <th rowSpan={2} style={{ ...TH, width: "46px" }}>Less:<br/>Discount</th>
            <th rowSpan={2} style={{ ...TH, width: "52px" }}>Taxable<br/>Value</th>
            <th colSpan={2} style={TH}>CGST</th>
            <th colSpan={2} style={TH}>IGST</th>
            <th rowSpan={2} style={{ ...TH, width: "52px" }}>Total</th>
          </tr>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={{ ...TH, width: "34px" }}>Rate</th>
            <th style={{ ...TH, width: "48px" }}>Amount</th>
            <th style={{ ...TH, width: "34px" }}>Rate</th>
            <th style={{ ...TH, width: "48px" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, i: number) => {
            const cgstR = (!isNonTax && isSameState) ? r.gstRate / 2 : 0;
            const igstR = (!isNonTax && !isSameState) ? r.gstRate : 0;
            return (
              <tr key={i}>
                <td style={{ ...TD, textAlign: "center" }}>{i + 1}</td>
                <td style={{ ...TD, textAlign: "left", paddingLeft: "4px", fontWeight: 500 }}>{r.name}</td>
                <td style={{ ...TD, textAlign: "center" }}>{r.hsn}</td>
                <td style={{ ...TD, textAlign: "center" }}>{r.uom}</td>
                <td style={{ ...TD, textAlign: "right" }}>{fmtInt(r.qty)}</td>
                <td style={{ ...TD, textAlign: "right" }}>{fmtInt(r.rate)}</td>
                <td style={{ ...TD, textAlign: "right" }}>{fmtInt(r.taxable)}</td>
                <td style={TD}></td>
                <td style={{ ...TD, textAlign: "right" }}>{fmtInt(r.taxable)}</td>
                <td style={{ ...TD, textAlign: "center" }}>{cgstR || 0}</td>
                <td style={{ ...TD, textAlign: "right" }}>{fmtInt(isNonTax ? 0 : r.cgst)}</td>
                <td style={{ ...TD, textAlign: "center" }}>{igstR || 0}</td>
                <td style={{ ...TD, textAlign: "right" }}>{fmtInt(isNonTax ? 0 : r.igst)}</td>
                <td style={{ ...TD, textAlign: "right", fontWeight: 600 }}>{fmtInt(r.lineTotal)}</td>
              </tr>
            );
          })}
          {Array(emptyCount).fill(0).map((_: any, i: number) => (
            <tr key={`e${i}`} style={{ height: "18px" }}>
              {Array(14).fill(0).map((__: any, j: number) => <td key={j} style={TD}></td>)}
            </tr>
          ))}
          <tr style={{ fontWeight: 700, background: "#f5f5f5" }}>
            <td colSpan={4} style={{ ...TD, textAlign: "center" }}>Total</td>
            <td style={{ ...TD, textAlign: "right" }}>{fmtInt(totalQty)}</td>
            <td style={TD}></td>
            <td style={{ ...TD, textAlign: "right" }}>{fmtInt(totalTaxable)}</td>
            <td style={TD}></td>
            <td style={{ ...TD, textAlign: "right" }}>{fmtInt(totalTaxable)}</td>
            <td style={{ ...TD, textAlign: "right" }}>0</td>
            <td style={{ ...TD, textAlign: "right" }}>{isNonTax ? 0 : fmtInt(totalCGST)}</td>
            <td style={{ ...TD, textAlign: "right" }}>0</td>
            <td style={{ ...TD, textAlign: "right" }}>{isNonTax ? 0 : fmtInt(totalIGST)}</td>
            <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{fmtInt(grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      {/* FOOTER */}
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", borderTop: "1px solid #000", fontSize: "10px" }}>
        {/* Left */}
        <div style={{ borderRight: "1px solid #000", padding: "6px 8px", display: "flex", flexDirection: "column", gap: "3px" }}>
          <div style={{ fontSize: "9px", fontWeight: 700, borderBottom: "1px solid #ddd", paddingBottom: "2px", marginBottom: "2px" }}>Total Invoice Amount in words</div>
          <div style={{ fontSize: "11px", fontStyle: "italic", fontWeight: 600, lineHeight: 1.4, minHeight: "28px" }}>{toWords(Math.round(grandTotal))}</div>
          <div style={{ marginTop: "4px" }}><b>Bundles</b> : {data.bundles_count || ""}</div>
          <div style={{ marginTop: "8px", fontSize: "9px", fontWeight: 700, textDecoration: "underline", letterSpacing: "0.3px" }}>▶ Bank Details</div>
          <table style={{ borderCollapse: "collapse", fontSize: "9px", marginTop: "3px", width: "100%" }}>
            <tbody>
              {data.bank_name       && <tr><td style={{ padding: "1px 4px 1px 0", fontWeight: 600, color: "#333", whiteSpace: "nowrap" }}>Bank Name</td><td style={{ padding: "1px 4px", color: "#333" }}>:</td><td style={{ padding: "1px 0", fontWeight: 700 }}>{data.bank_name}</td></tr>}
              {data.bank_account_no && <tr><td style={{ padding: "1px 4px 1px 0", fontWeight: 600, color: "#333", whiteSpace: "nowrap" }}>Account No</td><td style={{ padding: "1px 4px", color: "#333" }}>:</td><td style={{ padding: "1px 0", fontWeight: 700, letterSpacing: "0.5px" }}>{data.bank_account_no}</td></tr>}
              {data.bank_ifsc_code  && <tr><td style={{ padding: "1px 4px 1px 0", fontWeight: 600, color: "#333", whiteSpace: "nowrap" }}>IFSC Code</td><td style={{ padding: "1px 4px", color: "#333" }}>:</td><td style={{ padding: "1px 0", fontWeight: 700 }}>{data.bank_ifsc_code}</td></tr>}
              {data.bank_upi_id     && <tr><td style={{ padding: "1px 4px 1px 0", fontWeight: 600, color: "#333", whiteSpace: "nowrap" }}>UPI ID</td><td style={{ padding: "1px 4px", color: "#333" }}>:</td><td style={{ padding: "1px 0", fontWeight: 700 }}>{data.bank_upi_id}</td></tr>}
            </tbody>
          </table>
          {data.notes && <div style={{ fontSize: "9px", color: "#444", marginTop: "4px" }}>{data.notes}</div>}
          <div style={{ marginTop: "auto", paddingTop: "16px", textAlign: "center", fontSize: "9px", color: "#666" }}>(Common Seal)</div>
        </div>
        {/* Right */}
        <div style={{ padding: "6px 10px", display: "flex", flexDirection: "column" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <tbody>
              <tr><td style={{ padding: "2px 4px" }}>Total Amount Before Tax</td><td style={{ padding: "2px", textAlign: "center" }}>:</td><td style={{ padding: "2px 4px", textAlign: "right", fontWeight: 600 }}>{fmtInt(totalTaxable)}</td></tr>
              {!isNonTax && isSameState && <>
                <tr><td style={{ padding: "2px 4px" }}>Add: &nbsp; CGST &nbsp; {cgstRate}%</td><td style={{ padding: "2px", textAlign: "center" }}>:</td><td style={{ padding: "2px 4px", textAlign: "right", fontWeight: 600 }}>{fmtInt(totalCGST)}</td></tr>
                <tr><td style={{ padding: "2px 4px" }}>Add: &nbsp; SGST &nbsp; {sgstRate}%</td><td style={{ padding: "2px", textAlign: "center" }}>:</td><td style={{ padding: "2px 4px", textAlign: "right", fontWeight: 600 }}>{fmtInt(totalSGST)}</td></tr>
                <tr><td style={{ padding: "2px 4px" }}>Add: &nbsp; IGST</td><td style={{ padding: "2px", textAlign: "center" }}>:</td><td style={{ padding: "2px 4px" }}></td></tr>
              </>}
              {!isNonTax && !isSameState && <>
                <tr><td style={{ padding: "2px 4px" }}>Add: &nbsp; CGST</td><td style={{ padding: "2px", textAlign: "center" }}>:</td><td style={{ padding: "2px 4px" }}></td></tr>
                <tr><td style={{ padding: "2px 4px" }}>Add: &nbsp; SGST</td><td style={{ padding: "2px", textAlign: "center" }}>:</td><td style={{ padding: "2px 4px" }}></td></tr>
                <tr><td style={{ padding: "2px 4px" }}>Add: &nbsp; IGST &nbsp; {igstRate}%</td><td style={{ padding: "2px", textAlign: "center" }}>:</td><td style={{ padding: "2px 4px", textAlign: "right", fontWeight: 600 }}>{fmtInt(totalIGST)}</td></tr>
              </>}
              {!isNonTax && <tr style={{ borderTop: "1px solid #ccc" }}><td style={{ padding: "2px 4px" }}><b>Tax Amount: &nbsp; GST</b></td><td style={{ padding: "2px", textAlign: "center" }}>:</td><td style={{ padding: "2px 4px", textAlign: "right", fontWeight: 700 }}>{fmtInt(totalGST)}</td></tr>}
              <tr style={{ borderTop: "2px solid #000" }}><td style={{ padding: "3px 4px", fontWeight: 700 }}>Total Amount After Tax</td><td style={{ padding: "3px 2px", textAlign: "center", fontWeight: 700 }}>:</td><td style={{ padding: "3px 4px", textAlign: "right", fontWeight: 700, fontSize: "12px" }}>{fmtInt(grandTotal)}</td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: "6px", borderTop: "1px solid #ddd", paddingTop: "4px" }}>
            <div>GST Payable on Reverse Charge : {data.reverse_charge || ""}</div>
            <div style={{ marginTop: "4px", fontSize: "9px", fontStyle: "italic" }}>Certified that the particulars given above are true &amp; correct.</div>
            <div style={{ marginTop: "4px", fontWeight: 700 }}>For, {data.company_name}</div>
          </div>
          <div style={{ marginTop: "auto", paddingTop: "28px", textAlign: "right" }}>
            <div style={{ fontWeight: 700, fontSize: "11px" }}>Authorised Signatory</div>
            <div style={{ fontSize: "9px", marginTop: "2px" }}>[E &amp; OE]</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: "var(--bg-body)", minHeight: "100vh", paddingBottom: "40px" }}>
      {/* TOOLBAR */}
      <div style={{ background: "white", borderBottom: "1px solid var(--border-color)", padding: windowWidth <= 768 ? "12px 16px" : "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100, boxShadow: "var(--shadow-sm)", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => navigate("/invoices")} className="btn-secondary" style={{ padding: "8px 12px", gap: "6px", height: "38px" }}><FaArrowLeft /> Back</button>
          <div>
            <h1 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>Invoice #{data.invoice_number}</h1>
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{new Date(data.invoice_date).toLocaleDateString()} · {isNonTax ? "Non-Tax" : "Tax Invoice"}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => navigate(`/invoices/edit/${id}`)} className="btn-secondary" style={{ color: "var(--primary)", gap: "6px", padding: "8px 12px", fontSize: "0.82rem" }}><FaEdit /> Edit</button>
          <button onClick={handleDelete} className="btn-secondary" style={{ color: "var(--danger)", gap: "6px", padding: "8px 12px", fontSize: "0.82rem" }}><FaTrash /> Delete</button>
          <button onClick={() => setShowModal(true)} className="btn-secondary" style={{ gap: "6px", padding: "8px 12px", fontSize: "0.82rem" }}><FaPrint /> Print</button>
          <button onClick={handleDownloadPDF} disabled={pdfLoading} className="btn-primary" style={{ opacity: pdfLoading ? 0.7 : 1, gap: "6px", padding: "8px 12px", fontSize: "0.82rem" }}><FaFilePdf /> {pdfLoading ? "..." : "PDF"}</button>
        </div>
      </div>

      {/* PRINT PREVIEW MODAL */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto", padding: "16px 0 40px" }}>
          {/* Sticky bar */}
          <div style={{ position: "sticky", top: 0, width: "min(794px,96vw)", background: "#1e293b", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderRadius: "8px 8px 0 0", zIndex: 1, flexShrink: 0 }}>
            <span style={{ fontWeight: 600, fontSize: "13px" }}>Print Preview — Invoice #{data.invoice_number}</span>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={doPrint} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", padding: "7px 16px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}><FaPrint /> Print Now</button>
              <button onClick={() => setShowModal(false)} style={{ background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "6px", padding: "7px 12px", cursor: "pointer" }}><FaTimes /></button>
            </div>
          </div>
          {/* A4 preview */}
          <div style={{ width: "min(794px,96vw)", background: "white", padding: "8mm 10mm", flexShrink: 0 }}>
            <InvoicePreview />
          </div>
        </div>
      )}

      {/* SCREEN SUMMARY CARD */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: "32px", padding: "0 20px" }}>
        <div style={{ width: "min(794px,100%)", background: "white", boxShadow: "0 8px 30px rgba(0,0,0,0.1)", borderRadius: "10px", overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg,#1e293b,#334155)", color: "white", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 700 }}>Invoice #{data.invoice_number}</div>
              <div style={{ opacity: 0.7, fontSize: "12px", marginTop: "3px" }}>{isNonTax ? "Non-Tax Invoice" : "Tax Invoice"} · {new Date(data.invoice_date).toLocaleDateString("en-GB")}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "22px", fontWeight: 800 }}>₹{fmtInt(grandTotal)}</div>
              <div style={{ opacity: 0.7, fontSize: "11px" }}>{items.length} item{items.length !== 1 ? "s" : ""} · {data.customer_name}</div>
            </div>
          </div>
          <div style={{ padding: "16px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "12px", fontSize: "12px" }}>
            <div><div style={{ color: "#6b7280", fontSize: "11px", marginBottom: "2px" }}>Taxable</div><div style={{ fontWeight: 600 }}>₹{fmtInt(totalTaxable)}</div></div>
            {!isNonTax && <div><div style={{ color: "#6b7280", fontSize: "11px", marginBottom: "2px" }}>GST</div><div style={{ fontWeight: 600 }}>₹{fmtInt(totalGST)}</div></div>}
            <div><div style={{ color: "#6b7280", fontSize: "11px", marginBottom: "2px" }}>Grand Total</div><div style={{ fontWeight: 700, color: "#111" }}>₹{fmtInt(grandTotal)}</div></div>
            <div><div style={{ color: "#6b7280", fontSize: "11px", marginBottom: "2px" }}>Status</div><div style={{ fontWeight: 600, color: data.status === "PAID" ? "#16a34a" : data.status === "PARTIAL" ? "#d97706" : "#dc2626" }}>{data.status}</div></div>
          </div>
          <div style={{ borderTop: "1px solid #f1f5f9", padding: "12px 24px", background: "#f8fafc" }}>
            <button onClick={() => setShowModal(true)} style={{ background: "#1e293b", color: "white", border: "none", borderRadius: "7px", padding: "9px 20px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "13px" }}>
              <FaPrint /> Preview &amp; Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TH: React.CSSProperties = { border: "1px solid #000", padding: "3px 2px", fontSize: "9px", fontWeight: 700, textAlign: "center", verticalAlign: "middle" };
const TD: React.CSSProperties = { border: "1px solid #000", padding: "2px 3px", fontSize: "9.5px", textAlign: "center", verticalAlign: "middle" };

export default InvoiceDetails;
