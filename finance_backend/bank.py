from models import db, BankTransaction, Transaction, BankAccount
from datetime import timedelta

def auto_reconcile_bank(company_id, bank_account_id):
    """
    Attempts to match bank transactions with ledger transactions automatically.
    """
    unreconciled_bank_txs = BankTransaction.query.filter_by(
        company_id=company_id, 
        bank_account_id=bank_account_id,
        is_reconciled=False
    ).all()
    
    match_count = 0
    
    for btx in unreconciled_bank_txs:
        # Search for a matching ledger transaction
        # Match criteria: Same amount, date within +/- 3 days, and not already matched.
        # Ensure we look at the right account (Bank account in COA)
        
        # We need to knowing which COA account links to this BankAccount
        # In a real system, BankAccount table would have a foreign key to Account table.
        # Let's assume bank_account.coa_id exists or we search by name/number
        
        # Simplified: Match by amount and date window
        start_date = btx.date - timedelta(days=3)
        end_date = btx.date + timedelta(days=3)
        
        match = Transaction.query.filter(
            Transaction.company_id == company_id,
            Transaction.amount == btx.amount,
            Transaction.date >= start_date,
            Transaction.date <= end_date
        ).first() # In real life, we should be more specific about accounts
        
        if match:
            btx.is_reconciled = True
            btx.matched_transaction_id = match.id
            match_count += 1
            
    db.session.commit()
    return match_count

def import_bank_statement(company_id, bank_account_id, csv_file_path):
    """
    Imports bank statement from CSV and creates BankTransaction records.
    """
    import pandas as pd
    df = pd.read_csv(csv_file_path)
    # Expected columns: Date, Description, Amount, Type (CR/DR), Reference
    
    new_records = 0
    for _, row in df.iterrows():
        # Check for duplicates by reference if possible
        exists = BankTransaction.query.filter_by(
            company_id=company_id,
            bank_account_id=bank_account_id,
            reference=str(row['Reference'])
        ).first()
        
        if not exists:
            btx = BankTransaction(
                company_id=company_id,
                bank_account_id=bank_account_id,
                date=pd.to_datetime(row['Date']),
                description=row['Description'],
                amount=Decimal(str(row['Amount'])),
                tx_type=row['Type'],
                reference=row['Reference']
            )
            db.session.add(btx)
            new_records += 1
            
    db.session.commit()
    return new_records
