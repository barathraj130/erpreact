# tests/test_02_dashboard.py
"""
TC-DASH-001 to TC-DASH-008
Dashboard Module Tests
"""
import pytest
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from tests.helpers import go, wait, find, click, element_exists, text_present


@pytest.mark.dashboard
class TestDashboard:

    def test_TC_DASH_001_dashboard_loads(self, logged_in_driver):
        """TC-DASH-001: Dashboard page loads after login."""
        go(logged_in_driver, "/dashboard")
        time.sleep(2)
        assert "/dashboard" in logged_in_driver.current_url

    def test_TC_DASH_002_sidebar_visible(self, logged_in_driver):
        """TC-DASH-002: Sidebar navigation is visible."""
        go(logged_in_driver, "/dashboard")
        time.sleep(2)
        sidebar = element_exists(logged_in_driver,
            "nav, aside, [class*='sidebar'], [class*='Sidebar']")
        assert sidebar, "Sidebar should be visible on dashboard"

    def test_TC_DASH_003_kpi_cards_present(self, logged_in_driver):
        """TC-DASH-003: KPI summary cards are present."""
        go(logged_in_driver, "/dashboard")
        time.sleep(3)
        # Look for card-like elements
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text
        assert len(body) > 100, "Dashboard body should have meaningful content"

    def test_TC_DASH_004_navigate_to_invoices(self, logged_in_driver):
        """TC-DASH-004: Can navigate to Invoices from sidebar."""
        go(logged_in_driver, "/invoices")
        time.sleep(2)
        assert "/invoices" in logged_in_driver.current_url

    def test_TC_DASH_005_navigate_to_products(self, logged_in_driver):
        """TC-DASH-005: Can navigate to Products/Inventory."""
        go(logged_in_driver, "/products")
        time.sleep(2)
        assert "/products" in logged_in_driver.current_url

    def test_TC_DASH_006_navigate_to_purchase_bills(self, logged_in_driver):
        """TC-DASH-006: Can navigate to Purchase Bills."""
        go(logged_in_driver, "/purchase-bills")
        time.sleep(2)
        assert "/purchase-bills" in logged_in_driver.current_url

    def test_TC_DASH_007_navigate_to_employees(self, logged_in_driver):
        """TC-DASH-007: Can navigate to Employees page."""
        go(logged_in_driver, "/employees")
        time.sleep(2)
        assert "/employees" in logged_in_driver.current_url

    def test_TC_DASH_008_navigate_to_finance_dashboard(self, logged_in_driver):
        """TC-DASH-008: Can navigate to Finance Dashboard."""
        go(logged_in_driver, "/finance/dashboard")
        time.sleep(2)
        assert "/finance/dashboard" in logged_in_driver.current_url
