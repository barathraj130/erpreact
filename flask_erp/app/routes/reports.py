from flask import Blueprint, jsonify
from app.models import Supplier, SupplierBill, Product, InventoryMovement, db
from sqlalchemy.sql import func

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/reports/pending-dues', methods=['GET'])
def get_pending_dues():
    """
    Returns supplier-wise pending dues.
    """
    results = db.session.query(
        Supplier.id,
        Supplier.name,
        func.sum(SupplierBill.total_amount - SupplierBill.paid_amount).label('pending_due')
    ).join(SupplierBill).filter(SupplierBill.status != 'paid').group_by(Supplier.id).all()
    
    report = []
    for r in results:
        report.append({
            "supplier_id": r.id,
            "supplier_name": r.name,
            "pending_due": float(r.pending_due)
        })
    
    return jsonify(report), 200

@reports_bp.route('/reports/inventory-movement/<int:product_id>', methods=['GET'])
def get_inventory_movement(product_id):
    """
    Returns movement history for a specific product.
    """
    movements = InventoryMovement.query.filter_by(product_id=product_id).order_by(InventoryMovement.created_at.desc()).all()
    
    history = []
    for m in movements:
        history.append({
            "id": m.id,
            "bill_id": m.bill_id,
            "quantity_change": float(m.quantity_change),
            "new_quantity": float(m.new_quantity),
            "type": m.type,
            "date": m.created_at.isoformat()
        })
        
    return jsonify(history), 200
