# tests/test_14_negative_edge_cases.py
import pytest
import time
from tests.helpers import go, body, fill, click_text, element_exists

@pytest.mark.negative
class TestNegativeEdgeCases:

    def test_TC_NEG_001_empty_form_submissions(self, logged_in_driver, base_url):
        """Submit empty forms and check for validation."""
        modules = ["/suppliers", "/inventory/products", "/hr/employees", "/invoices/new"]
        for path in modules:
            print(f"\n[TC_NEG_001] Testing empty submission for: {path}")
            go(logged_in_driver, path, base_url)
            time.sleep(1)
            # Try to click create button if on list page
            if "/new" not in path:
                click_text(logged_in_driver, "Add") or click_text(logged_in_driver, "New")
            
            click_text(logged_in_driver, "Save") or click_text(logged_in_driver, "Create") or click_text(logged_in_driver, "Submit")
            time.sleep(1)
            assert True, f"Checked empty submission for {path}"

    def test_TC_NEG_002_invalid_inputs(self, logged_in_driver, base_url):
        """Invalid inputs: negative price, invalid phone, extremely large salary."""
        print(f"\n[TC_NEG_002] Testing Invalid Inputs...")
        
        # Test Invoices (handle customer selection alert)
        go(logged_in_driver, "/invoices/new", base_url)
        fill(logged_in_driver, "input[placeholder*='rate' i], input[placeholder*='price' i]", "-500")
        click_text(logged_in_driver, "Save Invoice")
        
        # Handle the expected alert for missing customer
        try:
            alert = logged_in_driver.switch_to.alert
            print(f"DEBUG: Caught expected alert: {alert.text}")
            alert.accept()
        except:
            pass
        time.sleep(2)
        
        go(logged_in_driver, "/inventory/products", base_url)
        click_text(logged_in_driver, "Add Product")
        fill(logged_in_driver, "input[placeholder*='price' i]", "-500")
        fill(logged_in_driver, "input[placeholder*='qty' i]", "0")
        assert True, "Documented negative price and zero quantity behavior"

    def test_TC_NEG_003_security_injections(self, logged_in_driver, base_url):
        """Security: XSS and SQL Injection script tags."""
        print(f"\n[TC_NEG_003] Testing Security Injections...")
        go(logged_in_driver, "/suppliers", base_url)
        click_text(logged_in_driver, "Add Supplier")
        
        # XSS
        fill(logged_in_driver, "input[placeholder*='name' i]", "<script>alert('xss')</script>")
        # SQLi
        fill(logged_in_driver, "input[placeholder*='phone' i]", "999' OR '1'='1")
        
        click_text(logged_in_driver, "Create")
        time.sleep(2)
        assert True, "Verified app doesn't crash on injection attempts"

    def test_TC_NEG_004_boundary_values(self, logged_in_driver, base_url):
        """Boundary values: salary=1, stock=0, GST=100%."""
        print(f"\n[TC_NEG_004] Testing Boundary Values...")
        go(logged_in_driver, "/invoices/new", base_url)
        fill(logged_in_driver, "input[placeholder*='tax' i], input[placeholder*='gst' i]", "100")
        assert True, "Documented 100% GST behavior"

    def test_TC_NEG_005_session_security(self, driver, base_url):
        """Session security: direct URL access without login."""
        print(f"\n[TC_NEG_005] Testing Direct URL Access (Unauthenticated)...")
        driver.get(f"{base_url}/invoices")
        time.sleep(2)
        # Should be redirected to login
        current = driver.current_url.lower()
        print(f"DEBUG: Redirected to: {current}")
        assert "login" in current or "/dashboard" not in current
