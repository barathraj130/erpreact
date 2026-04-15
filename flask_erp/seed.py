from app import create_app, db
from app.models import Product, Supplier

app = create_app()

def seed():
    with app.app_context():
        # Add Suppliers
        s1 = Supplier(name="Global Fabrics", email="sales@global.com")
        s2 = Supplier(name="Industrial Threads", email="contact@threads.com")
        
        # Add Products
        p1 = Product(name="Cotton Yarn", stock_quantity=100.0, purchase_price=450.0)
        p2 = Product(name="Polyester Resin", stock_quantity=50.0, purchase_price=820.0)
        
        db.session.add_all([s1, s2, p1, p2])
        db.session.commit()
        print("Database seeded successfully!")

if __name__ == '__main__':
    seed()
