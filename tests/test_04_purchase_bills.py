# tests/test_04_purchase_bills.py
"""
TC-PUR-001 to TC-PUR-010
Purchase Bills Module Tests
"""
import pytest
import time
from selenium.webdriver.common.by import By
from tests.helpers import go, element_exists, take_screenshot
import os

os.makedirs("tests/screenshots", exist_ok=True)


@pytest.mark.purchase
class TestPurchaseBills:

    def test_TC_PUR_001_purchase_bills_list_loads(self, logged_in_driver):
        """TC-PUR-001: Purchase bills list page loads."""
        go(logged_in_driver, "/purchase-bills")
        time.sleep(2)
        assert "/purchase-bills" in logged_in_driver.current_url

    def test_TC_PUR_002_create_bill_page_loads(self, logged_in_driver):
        """TC-PUR-002: Create Purchase Bill page loads."""
        go(logged_in_driver, "/purchase-bills/new")
        time.sleep(2)
        assert "/purchase-bills" in logged_in_driver.current_url

    def test_TC_PUR_003_supplier_field_present(self, logged_in_driver):
        """TC-PUR-003: Supplier selection field is present on create bill form."""
        go(logged_in_driver, "/purchase-bills/new")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_supplier = "supplier" in body or \
                       element_exists(logged_in_driver, "select, input[placeholder*='supplier' i]", timeout=5)
        assert has_supplier, "Purchase bill form should have a supplier field"

    def test_TC_PUR_004_bill_date_field_present(self, logged_in_driver):
        """TC-PUR-004: Bill date field present on create form."""
        go(logged_in_driver, "/purchase-bills/new")
        time.sleep(2)
        has_date = element_exists(logged_in_driver, "input[type='date']", timeout=5)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert has_date or "date" in body, "Purchase bill form should have a date field"

    def test_TC_PUR_005_tax_type_selector_present(self, logged_in_driver):
        """TC-PUR-005: TAX / NON-TAX toggle is present."""
        go(logged_in_driver, "/purchase-bills/new")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "tax" in body or "gst" in body, \
            "Purchase bill should have TAX / NON-TAX option"

    def test_TC_PUR_006_purchase_workflow_steps_present(self, logged_in_driver):
        """TC-PUR-006: Purchase workflow step indicators are present."""
        go(logged_in_driver, "/purchase-bills/new")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_step = "step 01" in body or "receive" in body or "scan" in body
        assert has_step, "Bill creation should start at Step 01: Receive & Scan"


    def test_TC_PUR_007_scan_button_present(self, logged_in_driver):
        """TC-PUR-007: Analyze/Scan button is present in Step 1."""
        go(logged_in_driver, "/purchase-bills/new")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_btn = "analyze" in body or "scan" in body or "upload" in body
        assert has_btn, "Bill form should have an Analyze/Scan button"

    def test_TC_PUR_008_bill_list_shows_content(self, logged_in_driver):
        """TC-PUR-008: Bill list renders content (table or empty state)."""
        go(logged_in_driver, "/purchase-bills")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text
        assert len(body) > 100, "Purchase bills list page should have content"

    def test_TC_PUR_009_create_new_button_present(self, logged_in_driver):
        """TC-PUR-009: New/Create button on purchase bills list."""
        go(logged_in_driver, "/purchase-bills")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "new" in body or "create" in body or "add" in body, \
            "Purchase bills list should have a create/new button"

    def test_TC_PUR_010_screenshot_purchase_bills(self, logged_in_driver):
        """TC-PUR-010: Screenshot the purchase bills list."""
        go(logged_in_driver, "/purchase-bills")
        time.sleep(2)
        take_screenshot(logged_in_driver, "TC_PUR_010_purchase_bills_list")
        assert True
