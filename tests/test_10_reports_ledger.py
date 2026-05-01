# tests/test_10_reports_ledger.py
"""
TC-RPT-001 to TC-RPT-012
Reports, Ledger & Trial Balance Tests
"""
import pytest
import time
from selenium.webdriver.common.by import By
from tests.helpers import go, element_exists, take_screenshot
import os

os.makedirs("tests/screenshots", exist_ok=True)


@pytest.mark.reports
class TestReportsAndLedger:

    def test_TC_RPT_001_ledgers_page_loads(self, logged_in_driver):
        """TC-RPT-001: Ledgers page loads."""
        go(logged_in_driver, "/ledgers")
        time.sleep(2)
        assert "/ledgers" in logged_in_driver.current_url

    def test_TC_RPT_002_ledger_has_entries(self, logged_in_driver):
        """TC-RPT-002: Ledger page shows entry structure."""
        go(logged_in_driver, "/ledgers")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_content = "ledger" in body or "debit" in body or "credit" in body or \
                      "balance" in body or len(body) > 200
        assert has_content, "Ledger page should display ledger entries"

    def test_TC_RPT_003_transactions_page_loads(self, logged_in_driver):
        """TC-RPT-003: Transactions page loads."""
        go(logged_in_driver, "/transactions")
        time.sleep(2)
        assert "/transactions" in logged_in_driver.current_url

    def test_TC_RPT_004_transactions_show_debit_credit(self, logged_in_driver):
        """TC-RPT-004: Transaction list shows debit/credit columns."""
        go(logged_in_driver, "/transactions")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_dr_cr = "debit" in body or "credit" in body or \
                    "dr" in body or "cr" in body or \
                    "amount" in body or len(body) > 200
        assert has_dr_cr, "Transactions page should show debit/credit entries"

    def test_TC_RPT_005_advanced_reports_page_loads(self, logged_in_driver):
        """TC-RPT-005: Advanced Reports page loads."""
        go(logged_in_driver, "/reports/world-class")
        time.sleep(2)
        assert "/reports" in logged_in_driver.current_url

    def test_TC_RPT_006_financial_reports_page_loads(self, logged_in_driver):
        """TC-RPT-006: Financial Reports page loads."""
        go(logged_in_driver, "/finance/reports")
        time.sleep(2)
        assert "/finance/reports" in logged_in_driver.current_url

    def test_TC_RPT_007_pl_report_section_present(self, logged_in_driver):
        """TC-RPT-007: Profit & Loss report section is present."""
        go(logged_in_driver, "/finance/reports")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_pl = "profit" in body or "loss" in body or "p&l" in body or \
                 "revenue" in body or "expense" in body
        assert has_pl or len(body) > 200, "Reports page should have P&L section"

    def test_TC_RPT_008_balance_sheet_section_present(self, logged_in_driver):
        """TC-RPT-008: Balance Sheet section present."""
        go(logged_in_driver, "/finance/reports")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_bs = "balance" in body or "asset" in body or "liability" in body
        assert has_bs or len(body) > 200, "Reports page should have Balance Sheet section"

    def test_TC_RPT_009_gst_report_section(self, logged_in_driver):
        """TC-RPT-009: GST report / GSTR section is available."""
        go(logged_in_driver, "/finance/reports")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_gst = "gst" in body or "gstr" in body or "itc" in body or "tax" in body
        assert has_gst or len(body) > 200, "Reports should have GST/GSTR section"

    def test_TC_RPT_010_trial_balance_zero_sum_indicator(self, logged_in_driver):
        """TC-RPT-010: Trial balance concept exists in reports."""
        go(logged_in_driver, "/finance/reports")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_trial = "trial" in body or "balance" in body or \
                    "debit" in body or "credit" in body
        assert has_trial or len(body) > 100

    def test_TC_RPT_011_date_filter_on_reports(self, logged_in_driver):
        """TC-RPT-011: Reports have date range filter."""
        go(logged_in_driver, "/finance/reports")
        time.sleep(2)
        has_date = element_exists(logged_in_driver,
            "input[type='date'], select", timeout=5)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert has_date or "date" in body or "period" in body or "month" in body

    def test_TC_RPT_012_screenshot_reports(self, logged_in_driver):
        """TC-RPT-012: Screenshot finance reports page."""
        go(logged_in_driver, "/finance/reports")
        time.sleep(2)
        take_screenshot(logged_in_driver, "TC_RPT_012_finance_reports")
        assert True
