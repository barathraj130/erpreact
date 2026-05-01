from app.models import db, LedgerEntry

def record_bill_accounting(bill):
    """
    On Supplier Bill creation:
    Debit: Inventory (Assets increase)
    Credit: Accounts Payable (Supplier Liability increase)
    """
    # 1. Debit Inventory
    entry_inv = LedgerEntry(
        account_name="Inventory",
        debit=bill.total_amount,
        credit=0,
        reference_type="supplier_bill",
        reference_id=bill.id
    )
    
    # 2. Credit Accounts Payable
    entry_ap = LedgerEntry(
        account_name="Accounts Payable",
        debit=0,
        credit=bill.total_amount,
        reference_type="supplier_bill",
        reference_id=bill.id
    )
    
    db.session.add(entry_inv)
    db.session.add(entry_ap)

def record_payment_accounting(transaction):
    """
    On Payment (Transaction):
    Debit: Accounts Payable (Liability decrease)
    Credit: Cash/Bank (Asset decrease)
    """
    # 1. Debit Accounts Payable
    entry_ap = LedgerEntry(
        account_name="Accounts Payable",
        debit=transaction.amount,
        credit=0,
        reference_type="transaction",
        reference_id=transaction.id
    )
    
    # 2. Credit Cash/Bank
    account = "Cash" if transaction.type.lower() == "cash" else "Bank"
    entry_asset = LedgerEntry(
        account_name=account,
        debit=0,
        credit=transaction.amount,
        reference_type="transaction",
        reference_id=transaction.id
    )
    
    db.session.add(entry_ap)
    db.session.add(entry_asset)
