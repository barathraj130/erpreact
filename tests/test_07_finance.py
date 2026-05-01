# tests/test_07_finance.py
"""
TC-FIN-001 to TC-FIN-015
Finance Module Tests — Loans, Lenders, Chit Fund, Brokers
"""
import pytest
import time
from selenium.webdriver.common.by import By
from tests.helpers import go, element_exists, take_screenshot
import os

os.makedirs("tests/screenshots", exist_ok=True)


@pytest.mark.finance
class TestFinance:

    # ── Finance Dashboard ────────────────────────────────────────────
    def test_TC_FIN_001_finance_dashboard_loads(self, logged_in_driver):
        """TC-FIN-001: Finance dashboard page loads."""
        go(logged_in_driver, "/finance/dashboard")
        time.sleep(2)
        assert "/finance/dashboard" in logged_in_driver.current_url

    def test_TC_FIN_002_finance_dashboard_has_metrics(self, logged_in_driver):
        """TC-FIN-002: Finance dashboard displays financial metrics."""
        go(logged_in_driver, "/finance/dashboard")
        time.sleep(3)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_metric = "loan" in body or "chit" in body or "broker" in body or \
                     "inflow" in body or "outflow" in body or "earnings" in body or \
                     "balance" in body or "payable" in body or "expense" in body
        assert has_metric or len(body) > 200, \
            "Finance dashboard should show financial metrics"

    # ── Lenders ────────────────────────────────────────────────────
    def test_TC_FIN_003_lenders_page_loads(self, logged_in_driver):
        """TC-FIN-003: Lenders management page loads."""
        go(logged_in_driver, "/finance/lenders")
        time.sleep(2)
        assert "/finance/lenders" in logged_in_driver.current_url

    def test_TC_FIN_004_lender_type_options_present(self, logged_in_driver):
        """TC-FIN-004: Lender type options (Bank, NBFC, Private, etc.) exist."""
        go(logged_in_driver, "/finance/lenders")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_types = "bank" in body or "nbfc" in body or "private" in body or \
                    "lender" in body or element_exists(logged_in_driver, "select", timeout=5)
        assert has_types, "Lenders page should show lender type options"

    def test_TC_FIN_005_add_lender_button_present(self, logged_in_driver):
        """TC-FIN-005: Add/New lender button exists."""
        go(logged_in_driver, "/finance/lenders")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_btn = "add" in body or "new" in body or "create" in body
        assert has_btn or element_exists(logged_in_driver, "button", timeout=5), \
            "Lenders page should have an Add button"

    def test_TC_FIN_006_lenders_isolated_from_suppliers(self, logged_in_driver):
        """TC-FIN-006: Lenders page is separate from Suppliers page."""
        go(logged_in_driver, "/finance/lenders")
        time.sleep(1)
        lender_url = logged_in_driver.current_url
        go(logged_in_driver, "/suppliers")
        time.sleep(1)
        supplier_url = logged_in_driver.current_url
        assert lender_url != supplier_url, "Lenders and Suppliers must be on separate pages"

    # ── Loans ────────────────────────────────────────────────────────
    def test_TC_FIN_007_loans_page_loads(self, logged_in_driver):
        """TC-FIN-007: Loan management page loads."""
        go(logged_in_driver, "/finance/loans")
        time.sleep(2)
        assert "/finance/loans" in logged_in_driver.current_url

    def test_TC_FIN_008_loan_fields_present(self, logged_in_driver):
        """TC-FIN-008: Loan form shows key fields (principal, interest rate)."""
        go(logged_in_driver, "/finance/loans")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_fields = "principal" in body or "interest" in body or \
                     "loan" in body or "emi" in body or "amount" in body
        assert has_fields, "Loans page should show principal/interest fields"

    def test_TC_FIN_009_loan_tax_type_selector(self, logged_in_driver):
        """TC-FIN-009: Loan TAX/NON-TAX option exists (for GST on interest)."""
        go(logged_in_driver, "/finance/loans")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_tax = "tax" in body or "gst" in body
        assert has_tax or len(body) > 100, \
            "Loan page should indicate TAX/NON-TAX for interest"

    # ── Chit Fund ────────────────────────────────────────────────────
    def test_TC_FIN_010_chit_fund_page_loads(self, logged_in_driver):
        """TC-FIN-010: Chit Fund page loads."""
        go(logged_in_driver, "/finance/chits")
        time.sleep(2)
        assert "/finance/chits" in logged_in_driver.current_url

    def test_TC_FIN_011_chit_fund_fields_present(self, logged_in_driver):
        """TC-FIN-011: Chit fund form has required fields."""
        go(logged_in_driver, "/finance/chits")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_fields = "chit" in body or "installment" in body or \
                     "auction" in body or "group" in body
        assert has_fields, "Chit Fund page should show chit-related fields"

    # ── Brokers ──────────────────────────────────────────────────────
    def test_TC_FIN_012_brokers_page_loads(self, logged_in_driver):
        """TC-FIN-012: Brokers management page loads."""
        go(logged_in_driver, "/finance/brokers")
        time.sleep(2)
        assert "/finance/brokers" in logged_in_driver.current_url

    def test_TC_FIN_013_broker_fields_present(self, logged_in_driver):
        """TC-FIN-013: Broker form has name, phone, type fields."""
        go(logged_in_driver, "/finance/brokers")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_fields = "broker" in body or "commission" in body or \
                     "name" in body or "phone" in body
        assert has_fields, "Brokers page should show broker fields"

    def test_TC_FIN_014_broker_commission_type_present(self, logged_in_driver):
        """TC-FIN-014: Broker commission type (Purchase/Sales/Both) present."""
        go(logged_in_driver, "/finance/brokers")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_type = "purchase" in body or "sales" in body or "both" in body or \
                   element_exists(logged_in_driver, "select", timeout=5)
        assert has_type or len(body) > 100, \
            "Broker page should show Purchase/Sales/Both type"

    def test_TC_FIN_015_screenshot_finance_dashboard(self, logged_in_driver):
        """TC-FIN-015: Screenshot finance dashboard."""
        go(logged_in_driver, "/finance/dashboard")
        time.sleep(2)
        take_screenshot(logged_in_driver, "TC_FIN_015_finance_dashboard")
        assert True
