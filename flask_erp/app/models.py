from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy.sql import func

db = SQLAlchemy()

class Supplier(db.Model):
    __tablename__ = 'suppliers'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255))
    phone = db.Column(db.String(50))
    bills = db.relationship('SupplierBill', backref='supplier', lazy=True)

class InventoryMovement(db.Model):
    __tablename__ = 'inventory_movements'
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    bill_id = db.Column(db.Integer, db.ForeignKey('purchase_bills.id'))
    quantity_change = db.Column(db.Numeric(12, 2), nullable=False)
    new_quantity = db.Column(db.Numeric(12, 2), nullable=False)
    type = db.Column(db.String(20)) # purchase, sale, adjustment
    created_at = db.Column(db.DateTime, server_default=func.now())

class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    stock_quantity = db.Column(db.Numeric(12, 2), default=0.0)
    purchase_price = db.Column(db.Numeric(12, 2), default=0.0)
    
    def update_stock(self, qty, price, bill_id):
        old_qty = float(self.stock_quantity)
        new_qty = old_qty + float(qty)
        
        # Weighted Average Calculation
        if new_qty > 0:
            current_val = old_qty * float(self.purchase_price)
            added_val = float(qty) * float(price)
            self.purchase_price = (current_val + added_val) / new_qty
            
        self.stock_quantity = new_qty
        
        # Record Movement
        movement = InventoryMovement(
            product_id=self.id,
            bill_id=bill_id,
            quantity_change=qty,
            new_quantity=new_qty,
            type='purchase'
        )
        return movement

class SupplierBill(db.Model):
    __tablename__ = 'purchase_bills'
    id = db.Column(db.Integer, primary_key=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=False)
    bill_number = db.Column(db.String(50), nullable=False, unique=True)
    bill_date = db.Column(db.Date, nullable=False, default=func.current_date())
    bill_type = db.Column(db.String(20), default='Tax') # Tax, Non-Tax
    total_amount = db.Column(db.Numeric(12, 2), nullable=False)
    tax_amount = db.Column(db.Numeric(12, 2), default=0.0)
    cgst_amount = db.Column(db.Numeric(12, 2), default=0.0)
    sgst_amount = db.Column(db.Numeric(12, 2), default=0.0)
    igst_amount = db.Column(db.Numeric(12, 2), default=0.0)
    paid_amount = db.Column(db.Numeric(12, 2), default=0.0)
    status = db.Column(db.String(20), default='unpaid')
    is_itc_eligible = db.Column(db.Boolean, default=True)
    file_url = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, server_default=func.now())
    
    items = db.relationship('SupplierBillItem', backref='bill', cascade="all, delete-orphan", lazy=True)
    payments = db.relationship('Transaction', backref='bill', lazy=True)

class SupplierBillItem(db.Model):
    __tablename__ = 'supplier_bill_items'
    id = db.Column(db.Integer, primary_key=True)
    bill_id = db.Column(db.Integer, db.ForeignKey('purchase_bills.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Numeric(12, 2), nullable=False)
    unit_price = db.Column(db.Numeric(12, 2), nullable=False)
    total_price = db.Column(db.Numeric(12, 2), nullable=False)

class Transaction(db.Model):
    __tablename__ = 'transactions'
    id = db.Column(db.Integer, primary_key=True)
    bill_id = db.Column(db.Integer, db.ForeignKey('purchase_bills.id'), nullable=False)
    type = db.Column(db.String(20), nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    proof_image = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, server_default=func.now())

class LedgerEntry(db.Model):
    __tablename__ = 'ledger_entries'
    id = db.Column(db.Integer, primary_key=True)
    account_name = db.Column(db.String(100), nullable=False)
    debit = db.Column(db.Numeric(12, 2), default=0.0)
    credit = db.Column(db.Numeric(12, 2), default=0.0)
    reference_type = db.Column(db.String(50))
    reference_id = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, server_default=func.now())

class Document(db.Model):
    __tablename__ = 'documents'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(512), nullable=False)
    file_type = db.Column(db.String(50)) # invoice, bill, proof
    reference_type = db.Column(db.String(50)) # supplier_bill, transaction
    reference_id = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, server_default=func.now())

class SalesInvoice(db.Model):
    __tablename__ = 'invoices'
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(50), unique=True, nullable=False)
    invoice_date = db.Column(db.Date, nullable=False, default=func.current_date())
    total_amount = db.Column(db.Numeric(12, 2), nullable=False)
    cgst_amount = db.Column(db.Numeric(12, 2), default=0.0)
    sgst_amount = db.Column(db.Numeric(12, 2), default=0.0)
    igst_amount = db.Column(db.Numeric(12, 2), default=0.0)
    created_at = db.Column(db.DateTime, server_default=func.now())

class ITCBalance(db.Model):
    __tablename__ = 'itc_balances'
    id = db.Column(db.Integer, primary_key=True)
    month = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    cgst_carry_forward = db.Column(db.Numeric(12, 2), default=0.0)
    sgst_carry_forward = db.Column(db.Numeric(12, 2), default=0.0)
    igst_carry_forward = db.Column(db.Numeric(12, 2), default=0.0)
    updated_at = db.Column(db.DateTime, server_default=func.now())
