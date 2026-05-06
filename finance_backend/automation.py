from models import db, Transaction, Account, AutomationRule, Loan, LoanSchedule, LoanPayment
from datetime import datetime
from decimal import Decimal

def post_event(company_id, event_type, amount, source_id=None, source_module=None, description=None, created_by=None):
    """
    Automated Accounting Engine: Posts a financial transaction based on an event.
    """
    rule = AutomationRule.query.filter_by(company_id=company_id, event_type=event_type).first()
    if not rule:
        # Fallback to system default rule if company specific one doesn't exist
        # Assuming company_id 0 or NULL could be system templates (though here we use explicit company_id)
        return False, f"No automation rule found for event: {event_type}"

    amount = Decimal(str(amount))
    
    # Create the transaction
    tx = Transaction(
        company_id=company_id,
        debit_account_id=rule.debit_account_id,
        credit_account_id=rule.credit_account_id,
        amount=amount,
        source_module=source_module,
        source_id=source_id,
        description=description or rule.description,
        created_by=created_by
    )
    
    # Update account balances
    debit_acc = Account.query.get(rule.debit_account_id)
    credit_acc = Account.query.get(rule.credit_account_id)
    
    if not debit_acc or not credit_acc:
        return False, "Invalid account mapping in automation rules"

    # Asset/Expense: Debit increases balance, Credit decreases
    # Liability/Equity/Income: Credit increases balance, Debit decreases
    
    def update_balance(acc, change_amount, is_debit):
        acc_type = acc.account_type.upper()
        if acc_type in ['ASSET', 'EXPENSE']:
            if is_debit:
                acc.current_balance += change_amount
            else:
                acc.current_balance -= change_amount
        elif acc_type in ['LIABILITY', 'EQUITY', 'INCOME']:
            if is_debit:
                acc.current_balance -= change_amount
            else:
                acc.current_balance += change_amount
    
    update_balance(debit_acc, amount, True)
    update_balance(credit_acc, amount, False)
    
    db.session.add(tx)
    db.session.commit()
    return True, tx.id

def create_default_coa(company_id):
    """
    Initializes the Chart of Accounts for a new company.
    """
    defaults = [
        # Root Accounts
        {'code': '1000', 'name': 'Assets', 'type': 'ASSET', 'parent': None},
        {'code': '2000', 'name': 'Liabilities', 'type': 'LIABILITY', 'parent': None},
        {'code': '3000', 'name': 'Equity', 'type': 'EQUITY', 'parent': None},
        {'code': '4000', 'name': 'Income', 'type': 'INCOME', 'parent': None},
        {'code': '5000', 'name': 'Expenses', 'type': 'EXPENSE', 'parent': None},
    ]
    
    # Map for parent IDs
    id_map = {}
    
    for d in defaults:
        acc = Account(company_id=company_id, account_code=d['code'], name=d['name'], account_type=d['type'])
        db.session.add(acc)
        db.session.flush()
        id_map[d['name']] = acc.id
        
    # Sub Accounts
    subs = [
        {'code': '1100', 'name': 'Cash', 'type': 'ASSET', 'parent': 'Assets'},
        {'code': '1200', 'name': 'Bank', 'type': 'ASSET', 'parent': 'Assets'},
        {'code': '1300', 'name': 'Accounts Receivable', 'type': 'ASSET', 'parent': 'Assets'},
        {'code': '1400', 'name': 'Loan to Parties', 'type': 'ASSET', 'parent': 'Assets'},
        {'code': '1500', 'name': 'Interest Receivable', 'type': 'ASSET', 'parent': 'Assets'},
        
        {'code': '2100', 'name': 'Accounts Payable', 'type': 'LIABILITY', 'parent': 'Liabilities'},
        {'code': '2200', 'name': 'Loan from Bank', 'type': 'LIABILITY', 'parent': 'Liabilities'},
        
        {'code': '4100', 'name': 'Sales', 'type': 'INCOME', 'parent': 'Income'},
        {'code': '4200', 'name': 'Interest Income', 'type': 'INCOME', 'parent': 'Income'},
        
        {'code': '5100', 'name': 'Purchase', 'type': 'EXPENSE', 'parent': 'Expenses'},
        {'code': '5200', 'name': 'Salary Expense', 'type': 'EXPENSE', 'parent': 'Expenses'},
        {'code': '5300', 'name': 'Interest Expense', 'type': 'EXPENSE', 'parent': 'Expenses'},
    ]
    
    for s in subs:
        acc = Account(company_id=company_id, account_code=s['code'], name=s['name'], 
                      account_type=s['type'], parent_account_id=id_map[s['parent']])
        db.session.add(acc)
        db.session.flush()
        id_map[s['name']] = acc.id

    # Create Default Rules
    # Event: SALE -> Debit: Bank, Credit: Sales
    # Event: LOAN_GIVEN -> Debit: Loan to Parties, Credit: Cash
    # Event: LOAN_REPAYMENT -> Debit: Cash, Credit: Loan to Parties
    # Event: SALARY -> Debit: Salary Expense, Credit: Cash
    
    rules = [
        ('SALE', 'Bank', 'Sales', 'Record revenue from sale'),
        ('PURCHASE', 'Purchase', 'Bank', 'Record purchase expense'),
        ('SALARY', 'Salary Expense', 'Bank', 'Record salary payment'),
        ('LOAN_GIVEN', 'Loan to Parties', 'Cash', 'Record loan issued to party'),
        ('LOAN_REPAYMENT', 'Cash', 'Loan to Parties', 'Record loan repayment received'),
        ('INTEREST_EARNED', 'Interest Receivable', 'Interest Income', 'Accrue loan interest income'),
    ]
    
    for r_event, d_acc, c_acc, desc in rules:
        rule = AutomationRule(
            company_id=company_id,
            event_type=r_event,
            debit_account_id=id_map[d_acc],
            credit_account_id=id_map[c_acc],
            description=desc
        )
        db.session.add(rule)

    db.session.commit()
    return True
