// frontend/src/utils/deliveryChallanPrint.ts
//
// Delivery orders in this app track bundle-wise quantities only (no price —
// see delivery_order_items, which has no rate/amount column), and until now
// the only printable document tied to one was the tax invoice generated
// after "Convert to Invoice". But goods often need to physically move with
// a Delivery Challan alone — samples, job-work, branch transfers, or any
// shipment where the invoice isn't ready yet (or never happens). This opens
// a plain, non-tax printable challan for any delivery order regardless of
// its status, reusing the same client-side print pattern already used for
// HR forms (open a blank window, write the HTML, print) rather than adding
// a new backend PDF route for a document with no pricing to compute.
import { fetchProfile } from "../api/companyApi";

interface BundleLine {
  bundles: number;
  pieces_per_bundle: number;
  total: number;
}

interface DOItemForPrint {
  product_name: string;
  bundle_lines: BundleLine[];
  total_bundles: number;
  total_pieces: number;
}

interface DOForPrint {
  order_number: string;
  order_date: string;
  customer_name: string;
  items: DOItemForPrint[];
}

const escapeHtml = (s: string) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmtDate = (d: string) => {
  if (!d) return "-";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export async function printDeliveryChallan(order: DOForPrint) {
  let companyName = "Company Name";
  let addressLine = "";
  try {
    const p = await fetchProfile();
    addressLine = [p.address_line1, p.city_pincode, p.state].filter(Boolean).join(", ");
    companyName = p.company_name || companyName;
  } catch {
    // Best-effort — print with a blank header rather than failing entirely.
  }

  const totalBundles = order.items.reduce((s, i) => s + (Number(i.total_bundles) || 0), 0);
  const totalPieces = order.items.reduce((s, i) => s + (Number(i.total_pieces) || 0), 0);

  const rowsHtml = order.items.map((item, idx) => {
    const bundleDetail = (item.bundle_lines || [])
      .map((b) => `${b.bundles}×${b.pieces_per_bundle}`)
      .join(", ");
    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(item.product_name || "-")}</td>
        <td style="font-size:10px;color:#555;">${escapeHtml(bundleDetail)}</td>
        <td class="text-center">${item.total_bundles || 0}</td>
        <td class="text-center">${item.total_pieces || 0}</td>
      </tr>`;
  }).join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Delivery Challan ${escapeHtml(order.order_number)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Arial', sans-serif; background: white; color: #000; padding: 32px; max-width: 794px; margin: 0 auto; }
  .header { border: 3px solid #000; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
  .company-name { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; }
  .company-sub { font-size: 10px; color: #333; margin-top: 2px; }
  .title-block { text-align: right; }
  .title { font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .not-tax-invoice { font-size: 10px; color: #b45309; font-weight: 700; margin-top: 2px; }
  .meta-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .meta-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #333; margin-bottom: 4px; }
  .meta-value { font-size: 13px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th, td { border: 1px solid #000; padding: 8px 10px; font-size: 12px; text-align: left; }
  th { background: #f1f1f1; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
  .text-center { text-align: center; }
  tfoot td { font-weight: 800; background: #f8f8f8; }
  .signature-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 48px; align-items: end; }
  .signature-block { text-align: center; }
  .signature-line { border-top: 1.5px solid #000; margin-bottom: 6px; padding-top: 48px; }
  .signature-label { font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .seal-box { border: 1.5px dashed #999; border-radius: 6px; height: 84px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; }
  .seal-box-label { font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
  .footer-note { margin-top: 20px; font-size: 9px; color: #666; text-align: center; }
  @media print { body { padding: 20px; } .no-print { display: none; } @page { size: A4; margin: 15mm; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${escapeHtml(companyName)}</div>
      ${addressLine ? `<div class="company-sub">${escapeHtml(addressLine)}</div>` : ""}
    </div>
    <div class="title-block">
      <div class="title">Delivery Challan</div>
      <div class="not-tax-invoice">Not a Tax Invoice — for goods movement only</div>
    </div>
  </div>

  <div class="meta-row">
    <div>
      <div class="meta-label">Challan No.</div>
      <div class="meta-value">${escapeHtml(order.order_number)}</div>
    </div>
    <div>
      <div class="meta-label">Date</div>
      <div class="meta-value">${fmtDate(order.order_date)}</div>
    </div>
    <div>
      <div class="meta-label">Delivered To</div>
      <div class="meta-value">${escapeHtml(order.customer_name || "-")}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr><th style="width:32px;">#</th><th>Product</th><th>Bundle Breakdown</th><th class="text-center">Bundles</th><th class="text-center">Pieces</th></tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot>
      <tr><td colspan="3" style="text-align:right;">TOTAL</td><td class="text-center">${totalBundles}</td><td class="text-center">${totalPieces}</td></tr>
    </tfoot>
  </table>

  <div class="signature-row">
    <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Dispatched By</div></div>
    <div class="signature-block">
      <div class="seal-box"><span class="seal-box-label">Company Seal</span></div>
      <div class="signature-label">${escapeHtml(companyName)}</div>
    </div>
    <div class="signature-block"><div class="signature-line"></div><div class="signature-label">Received By</div></div>
  </div>

  <div class="footer-note">Goods received in good condition as per the quantities listed above.</div>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=794,height=1123");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}
