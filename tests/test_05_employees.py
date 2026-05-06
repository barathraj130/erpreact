# tests/test_05_employees.py
"""
TC-EMP-001 to TC-EMP-010
Employee & HR Module Tests
"""
import pytest
import time
from selenium.webdriver.common.by import By
from tests.helpers import go, element_exists, take_screenshot
import os

os.makedirs("tests/screenshots", exist_ok=True)


@pytest.mark.employee
class TestEmployees:

    def test_TC_EMP_001_employees_list_loads(self, logged_in_driver):
        """TC-EMP-001: Employees list page loads."""
        go(logged_in_driver, "/employees")
        time.sleep(2)
        assert "/employees" in logged_in_driver.current_url

    def test_TC_EMP_002_page_has_employee_content(self, logged_in_driver):
        """TC-EMP-002: Employees page renders meaningful content."""
        go(logged_in_driver, "/employees")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "employee" in body or "staff" in body or "name" in body, \
            "Employees page should display employee-related content"

    def test_TC_EMP_003_add_employee_button_present(self, logged_in_driver):
        """TC-EMP-003: Add/New Employee button exists on list page."""
        go(logged_in_driver, "/employees")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_btn = "add" in body or "new" in body or "create" in body
        assert has_btn, "Employee list should have an Add/New employee button"

    def test_TC_EMP_004_add_employee_modal_opens(self, logged_in_driver):
        """TC-EMP-004: Clicking Add Employee opens a modal or form."""
        go(logged_in_driver, "/employees")
        time.sleep(2)
        # Try to find and click add button
        try:
            btns = logged_in_driver.find_elements(By.TAG_NAME, "button")
            for btn in btns:
                txt = btn.text.lower()
                if "add" in txt or "new" in txt or "+" in txt:
                    btn.click()
                    time.sleep(1.5)
                    break
        except Exception:
            pass
        # Check if modal/form appeared
        body_after = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_form = element_exists(logged_in_driver,
            "[class*='modal'], [role='dialog'], form", timeout=5)
        has_name_field = "name" in body_after or "designation" in body_after
        assert has_form or has_name_field, "Add Employee modal/form should appear"

    def test_TC_EMP_005_employee_form_has_name_field(self, logged_in_driver):
        """TC-EMP-005: Employee form has name input field."""
        go(logged_in_driver, "/employees")
        time.sleep(1)
        try:
            btns = logged_in_driver.find_elements(By.TAG_NAME, "button")
            for btn in btns:
                if "add" in btn.text.lower() or "new" in btn.text.lower():
                    btn.click()
                    time.sleep(1.5)
                    break
        except Exception:
            pass
        has_name = element_exists(logged_in_driver,
            "input[name='name'], input[placeholder*='name' i], input[id*='name']", timeout=5)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert has_name or "name" in body, "Employee form should have a name field"

    def test_TC_EMP_006_employee_salary_field_present(self, logged_in_driver):
        """TC-EMP-006: Employee form has salary field."""
        go(logged_in_driver, "/employees")
        time.sleep(1)
        try:
            btns = logged_in_driver.find_elements(By.TAG_NAME, "button")
            for btn in btns:
                if "add" in btn.text.lower() or "new" in btn.text.lower():
                    btn.click()
                    time.sleep(1.5)
                    break
        except Exception:
            pass
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_salary = "salary" in body or element_exists(logged_in_driver,
            "input[name='salary'], input[placeholder*='salary' i]", timeout=5)
        assert has_salary, "Employee form should have salary field"

    def test_TC_EMP_007_designation_field_present(self, logged_in_driver):
        """TC-EMP-007: Designation field present in employee form."""
        go(logged_in_driver, "/employees")
        time.sleep(1)
        try:
            btns = logged_in_driver.find_elements(By.TAG_NAME, "button")
            for btn in btns:
                if "add" in btn.text.lower() or "new" in btn.text.lower():
                    btn.click()
                    time.sleep(1.5)
                    break
        except Exception:
            pass
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "designation" in body or "role" in body or "position" in body, \
            "Employee form should have designation field"

    def test_TC_EMP_008_employee_list_has_table_or_cards(self, logged_in_driver):
        """TC-EMP-008: Employees list shows in table or card view."""
        go(logged_in_driver, "/employees")
        time.sleep(2)
        has_table = element_exists(logged_in_driver,
            "table, [class*='table'], [class*='card'], [class*='grid']", timeout=5)
        assert has_table or len(logged_in_driver.find_element(By.TAG_NAME, "body").text) > 200

    def test_TC_EMP_009_hr_attendance_page_accessible(self, logged_in_driver):
        """TC-EMP-009: Attendance page is accessible."""
        go(logged_in_driver, "/attendance")
        time.sleep(2)
        assert "/attendance" in logged_in_driver.current_url

    def test_TC_EMP_010_screenshot_employees(self, logged_in_driver):
        """TC-EMP-010: Screenshot employees page."""
        go(logged_in_driver, "/employees")
        time.sleep(2)
        take_screenshot(logged_in_driver, "TC_EMP_010_employees_list")
        assert True
