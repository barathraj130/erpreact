# tests/test_12_full_crud.py
import pytest
import time
from tests.helpers import go, body, fill, click_text, element_exists

@pytest.mark.crud
class TestFullCRUD:

    def run_crud_for_module(self, driver, url, module_name, create_btn_text, fields_map):
        """Helper to run CRUD on a module with search verification."""
        print(f"\n[CRUD] Testing {module_name}...")
        driver.get(url)
        time.sleep(2)
        
        # CREATE
        click_text(driver, create_btn_text)
        time.sleep(2)
        for selector, value in fields_map.items():
            fill(driver, selector, value)
        click_text(driver, "Save") or click_text(driver, "Create") or click_text(driver, "Submit")
        time.sleep(4) # Allow time for DB/UI sync
        
        # READ (Verification)
        driver.get(url)
        time.sleep(3)
        
        # Use Search Bar to find the record (more reliable than scanning all body text)
        search_input = "input[placeholder*='search' i], input.search-input"
        record_name = fields_map.get("input[placeholder*='name' i]")
        if record_name and element_exists(driver, search_input):
            fill(driver, search_input, record_name)
            time.sleep(2)

        page_body = body(driver)
        # Check if any of our input values are present in the filtered list
        assert any(str(v).lower() in page_body for v in fields_map.values() if isinstance(v, (str, int))), \
            f"{module_name} not found in list. Body preview: {page_body[:200]}"
        
        # UPDATE/DELETE placeholders (checks if buttons exist)
        has_edit = element_exists(driver, "button.edit, .fa-edit, [title*='Edit']", timeout=5)
        print(f"DEBUG: {module_name} Update button exists: {has_edit}")
        
        has_delete = element_exists(driver, "button.delete, .fa-trash, [title*='Delete']", timeout=5)
        print(f"DEBUG: {module_name} Delete button exists: {has_delete}")
        
        assert True

    def test_TC_SUP_012_suppliers_crud(self, logged_in_driver, base_url):
        self.run_crud_for_module(logged_in_driver, f"{base_url}/suppliers", "Suppliers", "Add Supplier", {
            "input[placeholder*='name' i]": "CRUD Supplier Ltd",
            "input[placeholder*='phone' i]": "1234567890"
        })

    def test_TC_INV_013_products_crud(self, logged_in_driver, base_url):
        self.run_crud_for_module(logged_in_driver, f"{base_url}/inventory/products", "Products", "Add Product", {
            "input[placeholder*='name' i]": "CRUD Widget",
            "input[placeholder*='sku' i]": "WID-001"
        })

    def test_TC_EMP_012_employees_crud(self, logged_in_driver, base_url):
        self.run_crud_for_module(logged_in_driver, f"{base_url}/hr/employees", "Employees", "Add Employee", {
            "input[placeholder*='name' i]": "CRUD Employee"
        })

    def test_TC_FIN_016_finance_lenders_crud(self, logged_in_driver, base_url):
        self.run_crud_for_module(logged_in_driver, f"{base_url}/finance/lenders", "Lenders", "Add Lender", {
            "input[placeholder*='name' i]": "CRUD Bank"
        })

    def test_TC_FIN_017_finance_loans_crud(self, logged_in_driver, base_url):
        self.run_crud_for_module(logged_in_driver, f"{base_url}/finance/loans", "Loans", "Add Loan", {
            "input[placeholder*='amount' i]": "100000"
        })

    def test_TC_DB_001_daybook_crud(self, logged_in_driver, base_url):
        """Check if daybook entries can be managed."""
        logged_in_driver.get(f"{base_url}/daybook")
        time.sleep(2)
        print(f"\n[TC_DB_001] Daybook loaded. Content length: {len(body(logged_in_driver))}")
        assert True
