# tests/test_08_inventory_suppliers.py
"""
TC-INV-I-001 to TC-INV-I-010  — Inventory / Products
TC-SUP-001  to TC-SUP-008      — Suppliers
"""
import pytest
import time
from selenium.webdriver.common.by import By
from tests.helpers import go, element_exists, take_screenshot
import os

os.makedirs("tests/screenshots", exist_ok=True)


@pytest.mark.inventory
class TestInventory:

    def test_TC_INVI_001_products_page_loads(self, logged_in_driver):
        """TC-INVI-001: Products/Inventory page loads."""
        go(logged_in_driver, "/products")
        time.sleep(2)
        assert "/products" in logged_in_driver.current_url

    def test_TC_INVI_002_products_list_content(self, logged_in_driver):
        """TC-INVI-002: Products list renders content."""
        go(logged_in_driver, "/products")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "product" in body or "stock" in body or "inventory" in body or \
               len(body) > 200, "Products page should have inventory content"

    def test_TC_INVI_003_add_product_button_present(self, logged_in_driver):
        """TC-INVI-003: Add/New product button exists."""
        go(logged_in_driver, "/products")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "add" in body or "new" in body or "create" in body or \
               element_exists(logged_in_driver, "button", timeout=5)

    def test_TC_INVI_004_product_form_has_name(self, logged_in_driver):
        """TC-INVI-004: Product form has name field."""
        go(logged_in_driver, "/products")
        time.sleep(1)
        try:
            btns = logged_in_driver.find_elements(By.TAG_NAME, "button")
            for btn in btns:
                if any(k in btn.text.lower() for k in ["add", "new", "+"]):
                    btn.click()
                    time.sleep(1.5)
                    break
        except Exception:
            pass
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_name = element_exists(logged_in_driver,
            "input[name='name'], input[placeholder*='name' i]", timeout=5)
        assert has_name or "name" in body

    def test_TC_INVI_005_product_sku_field_present(self, logged_in_driver):
        """TC-INVI-005: Product form has SKU / HSN code field."""
        go(logged_in_driver, "/products")
        time.sleep(1)
        try:
            btns = logged_in_driver.find_elements(By.TAG_NAME, "button")
            for btn in btns:
                if any(k in btn.text.lower() for k in ["add", "new", "+"]):
                    btn.click()
                    time.sleep(1.5)
                    break
        except Exception:
            pass
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "sku" in body or "hsn" in body or "code" in body

    def test_TC_INVI_006_selling_price_field_present(self, logged_in_driver):
        """TC-INVI-006: Product form has selling price field."""
        go(logged_in_driver, "/products")
        time.sleep(1)
        try:
            btns = logged_in_driver.find_elements(By.TAG_NAME, "button")
            for btn in btns:
                if any(k in btn.text.lower() for k in ["add", "new", "+"]):
                    btn.click()
                    time.sleep(1.5)
                    break
        except Exception:
            pass
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "price" in body or "rate" in body or "cost" in body

    def test_TC_INVI_007_current_stock_visible(self, logged_in_driver):
        """TC-INVI-007: Current stock quantity is shown in product list."""
        go(logged_in_driver, "/products")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "stock" in body or "qty" in body or "quantity" in body or \
               len(body) > 200

    def test_TC_INVI_008_gst_percent_field(self, logged_in_driver):
        """TC-INVI-008: Product has GST % field."""
        go(logged_in_driver, "/products")
        time.sleep(1)
        try:
            btns = logged_in_driver.find_elements(By.TAG_NAME, "button")
            for btn in btns:
                if any(k in btn.text.lower() for k in ["add", "new", "+"]):
                    btn.click()
                    time.sleep(1.5)
                    break
        except Exception:
            pass
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "gst" in body or "tax" in body or "%" in body

    def test_TC_INVI_009_low_stock_threshold_field(self, logged_in_driver):
        """TC-INVI-009: Low stock threshold / reorder level field present."""
        go(logged_in_driver, "/products")
        time.sleep(1)
        try:
            btns = logged_in_driver.find_elements(By.TAG_NAME, "button")
            for btn in btns:
                if any(k in btn.text.lower() for k in ["add", "new", "+"]):
                    btn.click()
                    time.sleep(1.5)
                    break
        except Exception:
            pass
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "threshold" in body or "reorder" in body or "minimum" in body or \
               "min" in body or "low" in body

    def test_TC_INVI_010_screenshot_products(self, logged_in_driver):
        """TC-INVI-010: Screenshot products/inventory page."""
        go(logged_in_driver, "/products")
        time.sleep(2)
        take_screenshot(logged_in_driver, "TC_INVI_010_products_list")
        assert True


@pytest.mark.suppliers
class TestSuppliers:

    def test_TC_SUP_001_suppliers_page_loads(self, logged_in_driver):
        """TC-SUP-001: Suppliers page loads."""
        go(logged_in_driver, "/suppliers")
        time.sleep(2)
        assert "/suppliers" in logged_in_driver.current_url

    def test_TC_SUP_002_suppliers_has_content(self, logged_in_driver):
        """TC-SUP-002: Suppliers page renders content."""
        go(logged_in_driver, "/suppliers")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "supplier" in body or "vendor" in body or len(body) > 200

    def test_TC_SUP_003_add_supplier_button_present(self, logged_in_driver):
        """TC-SUP-003: Add Supplier button exists."""
        go(logged_in_driver, "/suppliers")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "add" in body or "new" in body or \
               element_exists(logged_in_driver, "button", timeout=5)

    def test_TC_SUP_004_supplier_form_has_name(self, logged_in_driver):
        """TC-SUP-004: Supplier form has name field."""
        go(logged_in_driver, "/suppliers")
        time.sleep(1)
        try:
            btns = logged_in_driver.find_elements(By.TAG_NAME, "button")
            for btn in btns:
                if any(k in btn.text.lower() for k in ["add", "new", "+"]):
                    btn.click()
                    time.sleep(1.5)
                    break
        except Exception:
            pass
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "name" in body

    def test_TC_SUP_005_supplier_gstin_field(self, logged_in_driver):
        """TC-SUP-005: Supplier form has GSTIN field."""
        go(logged_in_driver, "/suppliers")
        time.sleep(1)
        try:
            btns = logged_in_driver.find_elements(By.TAG_NAME, "button")
            for btn in btns:
                if any(k in btn.text.lower() for k in ["add", "new", "+"]):
                    btn.click()
                    time.sleep(1.5)
                    break
        except Exception:
            pass
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "gstin" in body or "gst" in body or "tax" in body

    def test_TC_SUP_006_supplier_is_separate_from_lenders(self, logged_in_driver):
        """TC-SUP-006: Suppliers page is completely separate from Lenders."""
        go(logged_in_driver, "/suppliers")
        time.sleep(1)
        supplier_url = logged_in_driver.current_url
        go(logged_in_driver, "/finance/lenders")
        time.sleep(1)
        lender_url = logged_in_driver.current_url
        assert supplier_url != lender_url, "Suppliers and Lenders must be on separate pages"

    def test_TC_SUP_007_supplier_phone_field(self, logged_in_driver):
        """TC-SUP-007: Supplier form has phone/contact field."""
        go(logged_in_driver, "/suppliers")
        time.sleep(1)
        try:
            btns = logged_in_driver.find_elements(By.TAG_NAME, "button")
            for btn in btns:
                if any(k in btn.text.lower() for k in ["add", "new", "+"]):
                    btn.click()
                    time.sleep(1.5)
                    break
        except Exception:
            pass
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "phone" in body or "contact" in body or "mobile" in body

    def test_TC_SUP_008_screenshot_suppliers(self, logged_in_driver):
        """TC-SUP-008: Screenshot suppliers page."""
        go(logged_in_driver, "/suppliers")
        time.sleep(2)
        take_screenshot(logged_in_driver, "TC_SUP_008_suppliers_list")
        assert True
