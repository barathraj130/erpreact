from flask import Blueprint, request, jsonify
from app.models import db, SupplierBill, SalesInvoice, ITCBalance
from sqlalchemy import func, extract
from decimal import Decimal

gst_bp = Blueprint('gst', __name__)

@gst_bp.route('/gst/monthly', methods=['GET'])
def get_monthly_gst():
    month = int(request.args.get('month', 0))
    year = int(request.args.get('year', 0))
    
    if not month or not year:
        return jsonify({"error": "Month and Year are required"}), 400

    # 1. Calculate Output GST (from Sales)
    sales_query = db.session.query(
        func.sum(SalesInvoice.cgst_amount).label('cgst'),
        func.sum(SalesInvoice.sgst_amount).label('sgst'),
        func.sum(SalesInvoice.igst_amount).label('igst')
    ).filter(
        extract('month', SalesInvoice.invoice_date) == month,
        extract('year', SalesInvoice.invoice_date) == year
    ).first()

    output_cgst = sales_query.cgst or Decimal(0)
    output_sgst = sales_query.sgst or Decimal(0)
    output_igst = sales_query.igst or Decimal(0)

    # 2. Calculate Input GST (from Purchases - only ITC eligible)
    purchase_query = db.session.query(
        func.sum(SupplierBill.cgst_amount).label('cgst'),
        func.sum(SupplierBill.sgst_amount).label('sgst'),
        func.sum(SupplierBill.igst_amount).label('igst')
    ).filter(
        extract('month', SupplierBill.bill_date) == month,
        extract('year', SupplierBill.bill_date) == year,
        SupplierBill.is_itc_eligible == True
    ).first()

    input_cgst = purchase_query.cgst or Decimal(0)
    input_sgst = purchase_query.sgst or Decimal(0)
    input_igst = purchase_query.igst or Decimal(0)

    # 3. Get Previous Month Carry Forward (if any)
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    
    prev_itc = ITCBalance.query.filter_by(month=prev_month, year=prev_year).first()
    cf_cgst = prev_itc.cgst_carry_forward if prev_itc else Decimal(0)
    cf_sgst = prev_itc.sgst_carry_forward if prev_itc else Decimal(0)
    cf_igst = prev_itc.igst_carry_forward if prev_itc else Decimal(0)

    # 4. Final Calculation
    # CGST
    total_itc_cgst = input_cgst + cf_cgst
    payable_cgst = max(output_cgst - total_itc_cgst, Decimal(0))
    new_cf_cgst = max(total_itc_cgst - output_cgst, Decimal(0))

    # SGST
    total_itc_sgst = input_sgst + cf_sgst
    payable_sgst = max(output_sgst - total_itc_sgst, Decimal(0))
    new_cf_sgst = max(total_itc_sgst - output_sgst, Decimal(0))

    # IGST
    total_itc_igst = input_igst + cf_igst
    payable_igst = max(output_igst - total_itc_igst, Decimal(0))
    new_cf_igst = max(total_itc_igst - output_igst, Decimal(0))

    # 5. Store current month carry forward
    current_itc = ITCBalance.query.filter_by(month=month, year=year).first()
    if not current_itc:
        current_itc = ITCBalance(month=month, year=year)
        db.session.add(current_itc)
    
    current_itc.cgst_carry_forward = new_cf_cgst
    current_itc.sgst_carry_forward = new_cf_sgst
    current_itc.igst_carry_forward = new_cf_igst
    db.session.commit()

    return jsonify({
        "period": f"{month}/{year}",
        "output_gst": {
            "cgst": float(output_cgst),
            "sgst": float(output_sgst),
            "igst": float(output_igst),
            "total": float(output_cgst + output_sgst + output_igst)
        },
        "input_gst_itc": {
            "cgst": float(input_cgst),
            "sgst": float(input_sgst),
            "igst": float(input_igst),
            "carry_forward_from_prev": float(cf_cgst + cf_sgst + cf_igst),
            "total_available": float(total_itc_cgst + total_itc_sgst + total_itc_igst)
        },
        "payable_gst": {
            "cgst": float(payable_cgst),
            "sgst": float(payable_sgst),
            "igst": float(payable_igst),
            "net_payable": float(payable_cgst + payable_sgst + payable_igst)
        },
        "carry_forward_to_next_month": {
            "cgst": float(new_cf_cgst),
            "sgst": float(new_cf_sgst),
            "igst": float(new_cf_igst)
        }
    }), 200
