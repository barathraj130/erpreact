from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Company(db.Model):
    __tablename__ = 'companies'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    # Add other company fields if needed

class Account(db.Model):
    __tablename__ = 'chart_of_accounts'
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, nullable=False, index=True)
    account_code = db.Column(db.String(20), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    account_type = db.Column(db.String(50), nullable=False) # ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
    parent_account_id = db.Column(db.Integer, db.ForeignKey('chart_of_accounts.id'), nullable=True)
    current_balance = db.Column(db.Numeric(15, 2), default=0.00)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship for hierarchy
    parent = db.relationship('Account', remote_side=[id], backref='sub_accounts')

class AutomationRule(db.Model):
    __tablename__ = 'automation_rules'
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, nullable=False, index=True)
    event_type = db.Column(db.String(50), nullable=False) # SALE, PURCHASE, SALARY, LOAN_GIVEN, LOAN_REPAYMENT, etc.
    debit_account_id = db.Column(db.Integer, db.ForeignKey('chart_of_accounts.id'), nullable=False)
    credit_account_id = db.Column(db.Integer, db.ForeignKey('chart_of_accounts.id'), nullable=False)
    description = db.Column(db.String(255))

class Transaction(db.Model):
    __tablename__ = 'finance_ledger'
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, nullable=False, index=True)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    debit_account_id = db.Column(db.Integer, db.ForeignKey('chart_of_accounts.id'), nullable=False)
    credit_account_id = db.Column(db.Integer, db.ForeignKey('chart_of_accounts.id'), nullable=False)
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    source_module = db.Column(db.String(50))
    source_id = db.Column(db.Integer)
    description = db.Column(db.String(255))
    created_by = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Loan(db.Model):
    __tablename__ = 'loans'
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, nullable=False, index=True)
    party_name = db.Column(db.String(255), nullable=False)
    party_type = db.Column(db.String(50), nullable=False) # EMPLOYEE, VENDOR, CUSTOMER, BANK, OTHER
    loan_direction = db.Column(db.String(10), nullable=False) # GIVEN, TAKEN
    principal_amount = db.Column(db.Numeric(15, 2), nullable=False)
    interest_rate = db.Column(db.Numeric(5, 2), nullable=False) # Annual rate
    interest_type = db.Column(db.String(20), nullable=False) # SIMPLE, EMI
    start_date = db.Column(db.Date, nullable=False)
    duration_months = db.Column(db.Integer, nullable=False)
    emi_amount = db.Column(db.Numeric(15, 2))
    outstanding_amount = db.Column(db.Numeric(15, 2))
    status = db.Column(db.String(20), default='ACTIVE') # ACTIVE, CLOSED
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class LoanSchedule(db.Model):
    __tablename__ = 'loan_schedule'
    id = db.Column(db.Integer, primary_key=True)
    loan_id = db.Column(db.Integer, db.ForeignKey('loans.id'), nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    principal_component = db.Column(db.Numeric(15, 2), nullable=False)
    interest_component = db.Column(db.Numeric(15, 2), nullable=False)
    total_due = db.Column(db.Numeric(15, 2), nullable=False)
    status = db.Column(db.String(20), default='PENDING') # PENDING, PAID, OVERDUE

class LoanPayment(db.Model):
    __tablename__ = 'loan_payments'
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, nullable=False, index=True)
    loan_id = db.Column(db.Integer, db.ForeignKey('loans.id'), nullable=False)
    payment_date = db.Column(db.DateTime, default=datetime.utcnow)
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    payment_mode = db.Column(db.String(50)) # CASH, BANK
    reference_id = db.Column(db.String(100))
    remarks = db.Column(db.String(255))

class BankAccount(db.Model):
    __tablename__ = 'bank_accounts'
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, nullable=False, index=True)
    bank_name = db.Column(db.String(100), nullable=False)
    account_number = db.Column(db.String(50), nullable=False)
    ifsc_code = db.Column(db.String(20))
    account_type = db.Column(db.String(50))
    current_balance = db.Column(db.Numeric(15, 2), default=0.00)

class BankTransaction(db.Model):
    __tablename__ = 'bank_transactions'
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, nullable=False, index=True)
    bank_account_id = db.Column(db.Integer, db.ForeignKey('bank_accounts.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    description = db.Column(db.String(255))
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    tx_type = db.Column(db.String(20), nullable=False) # CR (Deposit), DR (Withdrawal)
    reference = db.Column(db.String(100))
    is_reconciled = db.Column(db.Boolean, default=False)
    matched_transaction_id = db.Column(db.Integer, db.ForeignKey('finance_ledger.id'), nullable=True)

class CashReceipt(db.Model):
    __tablename__ = 'cash_receipts'
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, nullable=False, index=True)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    party_name = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    purpose = db.Column(db.String(255))
    loan_id = db.Column(db.Integer, db.ForeignKey('loans.id'), nullable=True)
    created_by = db.Column(db.Integer)
    signature_path = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
