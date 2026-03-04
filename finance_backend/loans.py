from models import db, Loan, LoanSchedule, Transaction, Account
from automation import post_event
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from decimal import Decimal

def calculate_emi(P, annual_rate, duration_months):
    """
    EMI = [P x r x (1+r)^n] / [(1+r)^n - 1]
    P = Principal, r = monthly interest rate, n = duration in months
    """
    P = float(P)
    r = (float(annual_rate) / 100) / 12
    n = duration_months
    
    if r == 0:
        return Decimal(str(round(P / n, 2)))
        
    emi = (P * r * pow(1 + r, n)) / (pow(1 + r, n) - 1)
    return Decimal(str(round(emi, 2)))

def generate_loan_schedule(loan):
    """
    Generates loan schedule based on interest type.
    """
    P = loan.principal_amount
    rate = loan.interest_rate
    n = loan.duration_months
    start_date = loan.start_date
    
    # Clear existing schedule
    LoanSchedule.query.filter_by(loan_id=loan.id).delete()
    
    if loan.interest_type == 'EMI':
        emi = calculate_emi(P, rate, n)
        loan.emi_amount = emi
        remaining_balance = Decimal(str(P))
        monthly_rate = (Decimal(str(rate)) / 100) / 12
        
        for i in range(1, n + 1):
            interest_comp = round(remaining_balance * monthly_rate, 2)
            principal_comp = emi - interest_comp
            
            # Adjust final payment
            if i == n:
                principal_comp = remaining_balance
                emi = principal_comp + interest_comp
            
            due_date = start_date + relativedelta(months=i)
            entry = LoanSchedule(
                loan_id=loan.id,
                due_date=due_date,
                principal_component=principal_comp,
                interest_component=interest_comp,
                total_due=emi
            )
            db.session.add(entry)
            remaining_balance -= principal_comp
            
    else: # Simple Interest
        # For simple interest, usually principal is paid monthly or at end.
        # Here we assume monthly interest accrual + equal principal repayment.
        monthly_principal = round(P / n, 2)
        total_interest = (P * (Decimal(str(rate)) / 100) * (Decimal(str(n)) / 12))
        monthly_interest = round(total_interest / n, 2)
        
        for i in range(1, n + 1):
            due_date = start_date + relativedelta(months=i)
            entry = LoanSchedule(
                loan_id=loan.id,
                due_date=due_date,
                principal_component=monthly_principal,
                interest_component=monthly_interest,
                total_due=monthly_principal + monthly_interest
            )
            db.session.add(entry)

    db.session.commit()

def process_interest_accrual():
    """
    Job to be run daily/monthly to post interest accruals.
    """
    today = date.today()
    # Find pending schedule entries for today or earlier that haven't been 'accrued'
    # In this model, we'll simplify and say we post 'INTEREST_EARNED' event when due date hits.
    
    pending_items = LoanSchedule.query.filter(
        LoanSchedule.due_date <= today,
        LoanSchedule.status == 'PENDING'
    ).all()
    
    for item in pending_items:
        loan = Loan.query.get(item.loan_id)
        # Post event
        success, tx_id = post_event(
            company_id=loan.company_id,
            event_type='INTEREST_EARNED',
            amount=item.interest_component,
            source_module='LOAN',
            source_id=loan.id,
            description=f"Interest accrual for Loan #{loan.id} - Due {item.due_date}"
        )
        if success:
            # Mark as processed (here we use PAID status as proxy or add another status)
            # Actually, marking as PAID should only happen after payment.
            # Let's add a 'reconciled' or similar if needed. 
            # For simplicity, we'll mark this schedule as 'ACCRUED' (need to update model if so)
            # We'll just update status to 'OVERDUE' if it's past due date and not paid.
            item.status = 'OVERDUE' 
            db.session.commit()
