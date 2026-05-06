import os
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from app.models import db, Transaction, SupplierBill
from app.services.accounting import record_payment_accounting
from decimal import Decimal

transactions_bp = Blueprint('transactions', __name__)

@transactions_bp.route('/transactions', methods=['POST'])
def make_payment():
    try:
        data = request.form
        bill_id = data.get('reference_bill_id')
        amount = Decimal(data.get('amount'))
        
        # Validation
        bill = SupplierBill.query.get(bill_id)
        if not bill:
            return jsonify({"error": "Reference Bill not found"}), 404
        
        if bill.status == 'paid':
            return jsonify({"error": "Bill is already fully paid"}), 400

        # Handle proof image
        proof_url = None
        if 'proof' in request.files:
            file = request.files['proof']
            if file:
                filename = secure_filename(file.filename)
                upload_path = os.path.join(current_app.config['UPLOAD_FOLDER_PROOFS'], filename)
                file.save(upload_path)
                proof_url = upload_path

        # 1. Create Transaction (PAYMENT ONLY)
        new_txn = Transaction(
            bill_id=bill.id,
            type=data.get('type'), # cash / bank
            amount=amount,
            proof_image=proof_url
        )
        db.session.add(new_txn)
        db.session.flush()

        # 2. Update Bill Status
        bill.paid_amount = Decimal(bill.paid_amount) + amount
        if bill.paid_amount >= bill.total_amount:
            bill.status = 'paid'
        else:
            bill.status = 'partial'

        # 3. Create Accounting Entries
        record_payment_accounting(new_txn)

        db.session.commit()
        return jsonify({
            "message": "Payment recorded successfully", 
            "transaction_id": new_txn.id,
            "bill_status": bill.status
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
