import os
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from app.models import db, SupplierBill, SupplierBillItem, Product, Supplier
from app.services.accounting import record_bill_accounting
from decimal import Decimal

bills_bp = Blueprint('bills', __name__)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'pdf', 'png', 'jpg', 'jpeg'}

@bills_bp.route('/supplier-bills', methods=['POST'])
def create_bill():
    try:
        data = request.form
        # Handle file upload
        file_url = None
        if 'file' in request.files:
            file = request.files['file']
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                upload_path = os.path.join(current_app.config['UPLOAD_FOLDER_BILLS'], filename)
                file.save(upload_path)
                file_url = upload_path

        # 1. Create Supplier Bill
        new_bill = SupplierBill(
            supplier_id=data.get('supplier_id'),
            bill_number=data.get('bill_number'),
            bill_date=data.get('bill_date'),
            bill_type=data.get('bill_type', 'Tax'), # Tax or Non-Tax
            total_amount=Decimal(data.get('total_amount')),
            tax_amount=Decimal(data.get('tax_amount', 0)),
            file_url=file_url
        )
        db.session.add(new_bill)
        db.session.flush() # Get bill ID

        # 2. Save simultaneously in Documents section
        if file_url:
            from app.models import Document
            new_doc = Document(
                name=f"Supplier Bill {new_bill.bill_number}",
                file_path=file_url,
                file_type="bill",
                reference_type="supplier_bill",
                reference_id=new_bill.id
            )
            db.session.add(new_doc)

        # 3. Process Items and Update Inventory
        import json
        items_data = json.loads(data.get('items', '[]'))
        
        for item in items_data:
            qty = Decimal(item['quantity'])
            price = Decimal(item['unit_price'])
            
            # Create bill item
            bill_item = SupplierBillItem(
                bill_id=new_bill.id,
                product_id=item['product_id'],
                quantity=qty,
                unit_price=price,
                total_price=qty * price
            )
            db.session.add(bill_item)
            
            # AUTO UPDATE INVENTORY
            product = Product.query.get(item['product_id'])
            if product:
                movement = product.update_stock(qty, price, new_bill.id)
                db.session.add(movement)
            else:
                return jsonify({"error": f"Product {item['product_id']} not found"}), 404

        # 3. Create Accounting Entries
        record_bill_accounting(new_bill)

        db.session.commit()
        return jsonify({"message": "Bill created successfully", "bill_id": new_bill.id}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bills_bp.route('/supplier-bills', methods=['GET'])
def get_bills():
    bills = SupplierBill.query.all()
    result = []
    for b in bills:
        result.append({
            "id": b.id,
            "supplier_id": b.supplier_id,
            "bill_number": b.bill_number,
            "total_amount": float(b.total_amount),
            "status": b.status,
            "created_at": b.created_at.isoformat()
        })
    return jsonify(result), 200

@bills_bp.route('/supplier-bills/<int:id>', methods=['GET'])
def get_bill_detail(id):
    bill = SupplierBill.query.get_or_404(id)
    items = []
    for item in bill.items:
        items.append({
            "product_id": item.product_id,
            "quantity": float(item.quantity),
            "unit_price": float(item.unit_price),
            "total_price": float(item.total_price)
        })
    
    return jsonify({
        "id": bill.id,
        "supplier_id": bill.supplier_id,
        "bill_number": bill.bill_number,
        "total_amount": float(bill.total_amount),
        "tax_amount": float(bill.tax_amount),
        "status": bill.status,
        "file_url": bill.file_url,
        "items": items
    }), 200
