from models import db, Account, Transaction, Loan, LoanSchedule
from sqlalchemy import func
from datetime import datetime

def get_trial_balance(company_id, as_of_date=None):
    if not as_of_date:
        as_of_date = datetime.utcnow()
    
    # In this simple model, we use current_balance. 
    # For a historical trial balance, we'd sum transactions.
    accounts = Account.query.filter_by(company_id=company_id).all()
    
    report = []
    total_debit = 0
    total_credit = 0
    
    for acc in accounts:
        balance = acc.current_balance
        acc_type = acc.account_type.upper()
        
        # Determine if balance is debit or credit
        debit = 0
        credit = 0
        
        if acc_type in ['ASSET', 'EXPENSE']:
            if balance >= 0: debit = balance
            else: credit = abs(balance)
        else: # Liability, Equity, Income
            if balance >= 0: credit = balance
            else: debit = abs(balance)
            
        report.append({
            'code': acc.account_code,
            'name': acc.name,
            'debit': float(debit),
            'credit': float(credit)
        })
        total_debit += debit
        total_credit += credit
        
    return {
        'data': report,
        'total_debit': float(total_debit),
        'total_credit': float(total_credit)
    }

def get_profit_loss(company_id, start_date, end_date):
    # Sum Income and Expense account balances
    income_accounts = Account.query.filter_by(company_id=company_id, account_type='INCOME').all()
    expense_accounts = Account.query.filter_by(company_id=company_id, account_type='EXPENSE').all()
    
    # For a real report, we'd filter transactions between start and end date.
    # Here we simplify and return current balances of these accounts.
    # Note: In a real ERP, Income/Expense accounts are reset at year-end.
    
    income_data = [{'name': a.name, 'amount': float(a.current_balance)} for a in income_accounts]
    expense_data = [{'name': a.name, 'amount': float(a.current_balance)} for a in expense_accounts]
    
    total_income = sum(a['amount'] for a in income_data)
    total_expense = sum(a['amount'] for a in expense_data)
    
    return {
        'income': income_data,
        'expenses': expense_data,
        'total_income': total_income,
        'total_expense': total_expense,
        'net_profit': total_income - total_expense
    }

def get_loan_status_report(company_id):
    loans = Loan.query.filter_by(company_id=company_id).all()
    report = []
    for l in loans:
        report.append({
            'id': l.id,
            'party': l.party_name,
            'principal': float(l.principal_amount),
            'outstanding': float(l.outstanding_amount),
            'status': l.status
        })
    return report
