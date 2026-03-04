from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from models import db, Account, Loan, LoanSchedule, Transaction, BankAccount, BankTransaction, CashReceipt
from automation import post_event, create_default_coa
from loans import generate_loan_schedule, process_interest_accrual
from bank import auto_reconcile_bank
from reports import get_trial_balance, get_profit_loss, get_loan_status_report
from pdf_gen import generate_cash_receipt_pdf
import os
import base64
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Database Config
app.config['SQLALCHEMY_DATABASE_URI'] = f"postgresql://{os.getenv('PG_USER', 'erpuser')}:{os.getenv('PG_PASSWORD', 'erp123')}@{os.getenv('PG_HOST', 'localhost')}:{os.getenv('PG_PORT', '5432')}/{os.getenv('PG_DATABASE', 'erpdb')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Background scheduler for interest accrual
scheduler = BackgroundScheduler()
scheduler.add_job(func=process_interest_accrual, trigger="interval", days=1)
scheduler.start()

@app.before_request
def create_tables():
    # Only runs if tables don't exist
    db.create_all()

# --- ROUTES ---

@app.route('/api/finance/setup', methods=['POST'])
def setup_company():
    data = request.json
    company_id = data.get('company_id')
    if not company_id:
        return jsonify({'error': 'company_id required'}), 400
    
    success = create_default_coa(company_id)
    return jsonify({'success': success})

@app.route('/api/finance/accounts', methods=['GET'])
def get_accounts():
    company_id = request.args.get('company_id')
    if not company_id:
        return jsonify({'error': 'company_id required'}), 400
    accounts = Account.query.filter_by(company_id=company_id).all()
    return jsonify([{
        'id': a.id, 'code': a.account_code, 'name': a.name, 'type': a.account_type, 
        'balance': float(a.current_balance), 'parent_id': a.parent_account_id
    } for a in accounts])

@app.route('/api/finance/loans', methods=['GET'])
def get_loans():
    company_id = request.args.get('company_id')
    if not company_id:
        return jsonify({'error': 'company_id required'}), 400
    loans = Loan.query.filter_by(company_id=company_id).all()
    return jsonify([{
        'id': l.id,
        'party_name': l.party_name,
        'party_type': l.party_type,
        'loan_direction': l.loan_direction,
        'principal_amount': float(l.principal_amount),
        'interest_rate': float(l.interest_rate),
        'interest_type': l.interest_type,
        'outstanding_amount': float(l.outstanding_amount),
        'status': l.status,
        'start_date': l.start_date.isoformat(),
        'duration_months': l.duration_months
    } for l in loans])

@app.route('/api/finance/loans', methods=['POST'])
def create_loan():
    data = request.json
    # data: {company_id, party_name, party_type, loan_direction, principal_amount, interest_rate, interest_type, start_date, duration_months}
    loan = Loan(
        company_id=data['company_id'],
        party_name=data['party_name'],
        party_type=data['party_type'],
        loan_direction=data['loan_direction'],
        principal_amount=data['principal_amount'],
        interest_rate=data['interest_rate'],
        interest_type=data['interest_type'],
        start_date=datetime.strptime(data['start_date'], '%Y-%m-%d').date(),
        duration_months=data['duration_months'],
        outstanding_amount=data['principal_amount']
    )
    db.session.add(loan)
    db.session.commit()
    
    # Generate schedule
    generate_loan_schedule(loan)
    
    # Post accounting event
    event = 'LOAN_GIVEN' if loan.loan_direction == 'GIVEN' else 'LOAN_TAKEN'
    post_event(loan.company_id, event, loan.principal_amount, source_module='LOAN', source_id=loan.id)
    
    return jsonify({'id': loan.id, 'message': 'Loan created and records posted'})

@app.route('/api/finance/loans/<int:id>/schedule', methods=['GET'])
def get_loan_schedule(id):
    schedule = LoanSchedule.query.filter_by(loan_id=id).order_by(LoanSchedule.due_date).all()
    return jsonify([{
        'due_date': s.due_date.isoformat(),
        'principal_component': float(s.principal_component),
        'interest_component': float(s.interest_component),
        'total_due': float(s.total_due),
        'status': s.status
    } for s in schedule])

@app.route('/api/finance/cash-receipt', methods=['POST'])
def create_cash_receipt():
    data = request.json
    # data: {company_id, party_name, amount, purpose, loan_id, created_by, signature_base64}
    
    sig_path = None
    if data.get('signature_base64'):
        sig_data = data['signature_base64'].split(',')[1] # Remove prefix
        sig_path = f"uploads/signatures/sig_{datetime.now().timestamp()}.png"
        with open(sig_path, "wb") as fh:
            fh.write(base64.b64decode(sig_data))
            
    receipt = CashReceipt(
        company_id=data['company_id'],
        party_name=data['party_name'],
        amount=data['amount'],
        purpose=data['purpose'],
        loan_id=data.get('loan_id'),
        created_by=data.get('created_by'),
        signature_path=sig_path
    )
    db.session.add(receipt)
    db.session.commit()
    
    # Post accounting event
    event = 'LOAN_REPAYMENT' if receipt.loan_id else 'SALE' # Simplified
    post_event(receipt.company_id, event, receipt.amount, source_module='CASH_RECEIPT', source_id=receipt.id)
    
    return jsonify({'id': receipt.id, 'receipt_url': f'/api/finance/cash-receipt/{receipt.id}/pdf'})

@app.route('/api/finance/cash-receipt/<int:id>/pdf', methods=['GET'])
def get_receipt_pdf(id):
    receipt = CashReceipt.query.get_or_404(id)
    output_path = f"uploads/reports/receipt_{id}.pdf"
    
    receipt_data = {
        'id': receipt.id,
        'date': receipt.date.strftime('%Y-%m-%d %H:%M'),
        'party_name': receipt.party_name,
        'amount': float(receipt.amount),
        'purpose': receipt.purpose,
        'loan_id': receipt.loan_id,
        'signature_path': receipt.signature_path
    }
    
    generate_cash_receipt_pdf(receipt_data, output_path)
    return send_file(output_path, as_attachment=True)

@app.route('/api/finance/reports/trial-balance', methods=['GET'])
def report_trial_balance():
    company_id = request.args.get('company_id')
    return jsonify(get_trial_balance(company_id))

@app.route('/api/finance/reports/profit-loss', methods=['GET'])
def report_pl():
    company_id = request.args.get('company_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    return jsonify(get_profit_loss(company_id, start_date, end_date))

@app.route('/api/finance/bank/accounts', methods=['GET'])
def get_bank_accounts():
    company_id = request.args.get('company_id')
    accounts = BankAccount.query.filter_by(company_id=company_id).all()
    return jsonify([{
        'id': b.id, 'bank_name': b.bank_name, 'account_number': b.account_number,
        'balance': float(b.current_balance)
    } for b in accounts])

@app.route('/api/finance/bank/transactions', methods=['GET'])
def get_bank_transactions():
    company_id = request.args.get('company_id')
    bank_id = request.args.get('bank_account_id')
    txs = BankTransaction.query.filter_by(company_id=company_id, bank_account_id=bank_id).all()
    return jsonify([{
        'id': t.id, 'date': t.date.isoformat(), 'description': t.description,
        'amount': float(t.amount), 'type': t.tx_type, 'reconciled': t.is_reconciled
    } for t in txs])

@app.route('/api/finance/bank/reconcile', methods=['POST'])
def bank_reconcile():
    data = request.json
    count = auto_reconcile_bank(data['company_id'], data['bank_account_id'])
    return jsonify({'matched_count': count})

if __name__ == '__main__':
    if not os.path.exists('uploads/signatures'):
        os.makedirs('uploads/signatures')
    if not os.path.exists('uploads/reports'):
        os.makedirs('uploads/reports')
    app.run(host='0.0.0.0', port=5001, debug=True)
