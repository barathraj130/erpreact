from flask import Flask
from .models import db
from .routes.bills import bills_bp
from .routes.transactions import transactions_bp
from .routes.reports import reports_bp
from .routes.gst import gst_bp
from flask_migrate import Migrate
import os

from flask_cors import CORS

def create_app():
    app = Flask(__name__)
    CORS(app)
    app.config.from_object('config.Config')
    
    # Initialize DB
    db.init_app(app)
    Migrate(app, db)
    
    # Register Blueprints
    app.register_blueprint(bills_bp, url_prefix='/api')
    app.register_blueprint(transactions_bp, url_prefix='/api')
    app.register_blueprint(reports_bp, url_prefix='/api')
    app.register_blueprint(gst_bp, url_prefix='/api')
    
    # Ensure upload directories exist
    os.makedirs(app.config['UPLOAD_FOLDER_BILLS'], exist_ok=True)
    os.makedirs(app.config['UPLOAD_FOLDER_PROOFS'], exist_ok=True)
    
    with app.app_context():
        db.create_all()
        
    @app.route('/health')
    def health():
        return {"status": "healthy", "service": "Flask ERP"}, 200

    return app
