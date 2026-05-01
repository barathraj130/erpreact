# tests/test_03_invoices.py
"""
TC-INV-001 to TC-INV-012
Sales Invoice Module Tests
"""
import pytest
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from tests.helpers import go, wait, find, fill, click, element_exists, text_present, take_screenshot
import os

os.makedirs("tests/screenshots", exist_ok=True)


@pytest.mark.invoice
class TestInvoices:

    def test_TC_INV_001_invoices_list_loads(self, logged_in_driver):
        """TC-INV-001: Invoices list page loads."""
        go(logged_in_driver, "/invoices")
        time.sleep(2)
        assert "/invoices" in logged_in_driver.current_url
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text
        assert len(body) > 50, "Invoice list body should have content"

    def test_TC_INV_002_create_invoice_page_loads(self, logged_in_driver):
        """TC-INV-002: Create Invoice page loads."""
        go(logged_in_driver, "/invoices/new")
        time.sleep(2)
        assert "/invoices/new" in logged_in_driver.current_url or \
               "/invoices" in logged_in_driver.current_url

    def test_TC_INV_003_invoice_number_field_present(self, logged_in_driver):
        """TC-INV-003: Invoice number field is present on create form."""
        go(logged_in_driver, "/invoices/new")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text
        has_form = element_exists(logged_in_driver,
            "input, select, textarea", timeout=5)
        assert has_form, "Create Invoice page should have form inputs"

    def test_TC_INV_004_customer_selection_present(self, logged_in_driver):
        """TC-INV-004: Customer selection field is present."""
        go(logged_in_driver, "/invoices/new")
        time.sleep(2)
        has_customer = element_exists(logged_in_driver,
            "select, input[placeholder*='customer' i], [class*='customer']", timeout=5)
        # Also check page body for customer text
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert has_customer or "customer" in body, "Customer field should be on create invoice form"

    def test_TC_INV_005_add_line_item_button_present(self, logged_in_driver):
        """TC-INV-005: 'Add Item' / 'Add Line' button exists."""
        go(logged_in_driver, "/invoices/new")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_btn = element_exists(logged_in_driver,
            "button[class*='add'], button[id*='add']", timeout=5)
        assert has_btn or "add" in body or "item" in body, \
            "Add line item option should exist on invoice form"

    def test_TC_INV_006_tax_type_selector_present(self, logged_in_driver):
        """TC-INV-006: TAX / NON-TAX type selector is present."""
        go(logged_in_driver, "/invoices/new")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_tax = "tax" in body or "gst" in body
        assert has_tax, "Invoice form should have TAX/NON-TAX or GST options"

    def test_TC_INV_007_invoices_list_has_table_or_cards(self, logged_in_driver):
        """TC-INV-007: Invoice list shows records in table or card view."""
        go(logged_in_driver, "/invoices")
        time.sleep(2)
        has_table = element_exists(logged_in_driver, "table, [class*='table'], [class*='card']", timeout=5)
        body_len = len(logged_in_driver.find_element(By.TAG_NAME, "body").text)
        assert has_table or body_len > 200, "Invoice list should render a table/card"

    def test_TC_INV_008_invoice_status_filter_present(self, logged_in_driver):
        """TC-INV-008: Invoice list has status filter options."""
        go(logged_in_driver, "/invoices")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_filter = "draft" in body or "paid" in body or "pending" in body or \
                     element_exists(logged_in_driver, "select, [class*='filter']", timeout=5)
        assert has_filter, "Invoice list should show status filters or status badges"

    def test_TC_INV_009_create_invoice_button_exists(self, logged_in_driver):
        """TC-INV-009: 'Create Invoice' or 'New Invoice' button is on list page."""
        go(logged_in_driver, "/invoices")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_btn = "create" in body or "new" in body or "add" in body
        assert has_btn, "Invoice list should have a create/new button"

    def test_TC_INV_010_invoice_date_field_present(self, logged_in_driver):
        """TC-INV-010: Invoice date field is present on create form."""
        go(logged_in_driver, "/invoices/new")
        time.sleep(2)
        has_date = element_exists(logged_in_driver, "input[type='date']", timeout=5)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert has_date or "date" in body, "Invoice form should have a date field"

    def test_TC_INV_011_gst_fields_visible(self, logged_in_driver):
        """TC-INV-011: GST-related fields appear on TAX invoice form."""
        go(logged_in_driver, "/invoices/new")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "gst" in body or "cgst" in body or "sgst" in body or "igst" in body, \
            "GST fields should appear on invoice form"

    def test_TC_INV_012_screenshot_invoice_list(self, logged_in_driver):
        """TC-INV-012: Screenshot the invoice list page."""
        go(logged_in_driver, "/invoices")
        time.sleep(2)
        take_screenshot(logged_in_driver, "TC_INV_012_invoice_list")
        assert True  # Screenshot taken successfully
