import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'erp-secret-key-123'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'postgresql://erpuser:erp123@127.0.0.1:5432/erpdb'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER_BILLS = 'uploads/bills'
    UPLOAD_FOLDER_PROOFS = 'uploads/proofs'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB limit
