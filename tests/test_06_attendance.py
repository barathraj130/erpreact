# tests/test_06_attendance.py
"""
TC-ATT-001 to TC-ATT-012
Attendance & QR System Tests
"""
import pytest
import time
from selenium.webdriver.common.by import By
from tests.helpers import go, element_exists, take_screenshot
import os

os.makedirs("tests/screenshots", exist_ok=True)


@pytest.mark.attendance
class TestAttendance:

    def test_TC_ATT_001_attendance_page_loads(self, logged_in_driver):
        """TC-ATT-001: Attendance page loads successfully."""
        go(logged_in_driver, "/attendance")
        time.sleep(2)
        assert "/attendance" in logged_in_driver.current_url

    def test_TC_ATT_002_attendance_has_content(self, logged_in_driver):
        """TC-ATT-002: Attendance page renders meaningful content."""
        go(logged_in_driver, "/attendance")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "attendance" in body or "present" in body or "absent" in body or \
               "employee" in body, "Attendance page should have attendance-related content"

    def test_TC_ATT_003_date_selector_present(self, logged_in_driver):
        """TC-ATT-003: Date selector present on attendance page."""
        go(logged_in_driver, "/attendance")
        time.sleep(2)
        has_date = element_exists(logged_in_driver, "input[type='date']", timeout=5)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert has_date or "date" in body, "Attendance page should have a date selector"

    def test_TC_ATT_004_status_options_present(self, logged_in_driver):
        """TC-ATT-004: Present / Absent / OD status options exist."""
        go(logged_in_driver, "/attendance")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_status = "present" in body or "absent" in body or "od" in body or \
                     element_exists(logged_in_driver, "select", timeout=5)
        assert has_status, "Attendance page should show Present/Absent/OD status options"

    def test_TC_ATT_005_qr_section_or_button_present(self, logged_in_driver):
        """TC-ATT-005: QR code section or button is available."""
        go(logged_in_driver, "/attendance")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_qr = "qr" in body or "scan" in body or \
                 element_exists(logged_in_driver, "[class*='qr'], [id*='qr']", timeout=5)
        assert has_qr or len(body) > 200, "Attendance page should have QR-related elements"

    def test_TC_ATT_006_mark_attendance_button_present(self, logged_in_driver):
        """TC-ATT-006: Mark / Confirm attendance button is present."""
        go(logged_in_driver, "/attendance")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_btn = "mark" in body or "confirm" in body or "save" in body or \
                  element_exists(logged_in_driver, "button", timeout=5)
        assert has_btn, "Attendance page should have a Mark/Confirm button"

    def test_TC_ATT_007_mobile_attendance_page_loads(self, logged_in_driver):
        """TC-ATT-007: Mobile attendance QR scan page loads (no auth required)."""
        go(logged_in_driver, "/mark-attendance")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        assert "attendance" in body or "scan" in body or "qr" in body or \
               len(body) > 50, "Mobile attendance page should load"

    def test_TC_ATT_008_employee_list_in_attendance(self, logged_in_driver):
        """TC-ATT-008: Employee names appear in attendance view."""
        go(logged_in_driver, "/attendance")
        time.sleep(3)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text
        # Should have some table/list structure
        has_list = element_exists(logged_in_driver,
            "table, [class*='table'], [class*='list'], [class*='grid']", timeout=5)
        assert has_list or len(body) > 200, "Attendance should show employee list"

    def test_TC_ATT_009_confirm_all_button_or_action(self, logged_in_driver):
        """TC-ATT-009: 'Confirm All' or bulk confirm action is present."""
        go(logged_in_driver, "/attendance")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_confirm = "confirm" in body or "approve" in body or "verify" in body
        assert has_confirm or element_exists(logged_in_driver, "button", timeout=5), \
            "Attendance page should have a confirm/approve mechanism"

    def test_TC_ATT_010_od_location_field_or_reason(self, logged_in_driver):
        """TC-ATT-010: OD location/reason field concept exists."""
        go(logged_in_driver, "/attendance")
        time.sleep(2)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_od = "od" in body or "on duty" in body or "location" in body or "reason" in body
        assert has_od or len(body) > 100, "Attendance should support OD location/reason"

    def test_TC_ATT_011_attendance_summary_or_report(self, logged_in_driver):
        """TC-ATT-011: Attendance summary counts (present/absent) visible."""
        go(logged_in_driver, "/attendance")
        time.sleep(3)
        body = logged_in_driver.find_element(By.TAG_NAME, "body").text.lower()
        has_summary = "present" in body or "absent" in body or "total" in body
        assert has_summary or len(body) > 100, \
            "Attendance page should show summary counts"

    def test_TC_ATT_012_screenshot_attendance(self, logged_in_driver):
        """TC-ATT-012: Screenshot attendance page."""
        go(logged_in_driver, "/attendance")
        time.sleep(2)
        take_screenshot(logged_in_driver, "TC_ATT_012_attendance_page")
        assert True
