from reportlab.lib.pagesizes import A5
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import cm
import os

def generate_cash_receipt_pdf(receipt_data, output_path):
    """
    Generates a printable PDF for a cash receipt.
    """
    c = canvas.Canvas(output_path, pagesize=A5)
    width, height = A5
    
    # Title
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, height - 2*cm, "CASH RECEIPT")
    
    c.setFont("Helvetica", 10)
    c.drawString(2*cm, height - 3.5*cm, f"Receipt No: {receipt_data['id']}")
    c.drawString(width - 5*cm, height - 3.5*cm, f"Date: {receipt_data['date']}")
    
    # Body
    c.line(2*cm, height - 4*cm, width - 2*cm, height - 4*cm)
    
    c.drawString(2*cm, height - 5*cm, f"Received From: {receipt_data['party_name']}")
    c.drawString(2*cm, height - 6*cm, f"Amount: {receipt_data['amount']}")
    c.drawString(2*cm, height - 7*cm, f"Purpose: {receipt_data['purpose']}")
    
    if receipt_data.get('loan_id'):
        c.drawString(2*cm, height - 8*cm, f"Reference Loan ID: {receipt_data['loan_id']}")
        
    # Signature
    if receipt_data.get('signature_path') and os.path.exists(receipt_data['signature_path']):
        c.drawString(width - 6*cm, 4*cm, "Receiver Signature:")
        c.drawImage(receipt_data['signature_path'], width - 6*cm, 1.5*cm, width=4*cm, height=2*cm, preserveAspectRatio=True)
    
    c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(width/2, 1*cm, "Thank you for the payment.")
    
    c.save()
    return output_path
