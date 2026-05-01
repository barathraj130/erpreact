# tests/test_11_api_smoke.py
"""
TC-API-001 to TC-API-015
Backend REST API Smoke Tests (no browser needed)
"""
import pytest
import requests

API_BASE = "http://localhost:3001/api"

# We'll store a token after login
_token = None

def get_headers():
    return {"Authorization": f"Bearer {_token}", "Content-Type": "application/json"}


@pytest.mark.api
class TestAPISmokeTests:

    def test_TC_API_001_health_check(self):
        """TC-API-001: Backend health endpoint returns 200."""
        try:
            r = requests.get("http://localhost:3001/health", timeout=5)
            assert r.status_code == 200, f"Health check failed: {r.status_code}"
            data = r.json()
            assert data.get("status") == "ok"
        except requests.exceptions.ConnectionError:
            pytest.skip("Backend not running — start with `node server.js`")

    def test_TC_API_002_login_valid(self):
        """TC-API-002: Valid login returns JWT token."""
        global _token
        try:
            r = requests.post(f"{API_BASE}/auth/login", json={
                "company_code": "TITAN-X",
                "email": "test_selenium@titan.com",
                "password": "password123"
            }, timeout=5)
            assert r.status_code in [200, 201], f"Login failed: {r.status_code} {r.text}"
            data = r.json()
            token = data.get("token") or data.get("access_token") or data.get("accessToken")
            assert token, f"No token in response: {data}"
            _token = token
        except requests.exceptions.ConnectionError:
            pytest.skip("Backend not running")

    def test_TC_API_003_login_invalid_password(self):
        """TC-API-003: Wrong password returns 401 or 400."""
        try:
            r = requests.post(f"{API_BASE}/auth/login", json={
                "company_code": "DEFAULT",
                "email": "admin@company.com",
                "password": "WRONGPASSWORD"
            }, timeout=5)
            assert r.status_code in [400, 401, 403], \
                f"Expected 4xx for wrong password, got {r.status_code}"
        except requests.exceptions.ConnectionError:
            pytest.skip("Backend not running")

    def test_TC_API_004_get_dashboard(self):
        """TC-API-004: Dashboard endpoint returns data."""
        if not _token:
            pytest.skip("No token — run TC_API_002 first")
        try:
            r = requests.get(f"{API_BASE}/dashboard", headers=get_headers(), timeout=10)
            assert r.status_code in [200, 201], f"Dashboard failed: {r.status_code}"
        except requests.exceptions.ConnectionError:
            pytest.skip("Backend not running")

    def test_TC_API_005_get_employees(self):
        """TC-API-005: Employees list endpoint returns 200."""
        if not _token:
            pytest.skip("No token")
        try:
            r = requests.get(f"{API_BASE}/employees", headers=get_headers(), timeout=5)
            assert r.status_code == 200, f"Employees fetch failed: {r.status_code}"
        except requests.exceptions.ConnectionError:
            pytest.skip("Backend not running")

    def test_TC_API_006_get_invoices(self):
        """TC-API-006: Invoices list returns 200."""
        if not _token:
            pytest.skip("No token")
        try:
            r = requests.get(f"{API_BASE}/invoice", headers=get_headers(), timeout=5)
            assert r.status_code == 200, f"Invoices fetch failed: {r.status_code}"
        except requests.exceptions.ConnectionError:
            pytest.skip("Backend not running")

    def test_TC_API_007_get_purchase_bills(self):
        """TC-API-007: Purchase bills list returns 200."""
        if not _token:
            pytest.skip("No token")
        try:
            r = requests.get(f"{API_BASE}/purchase-bills", headers=get_headers(), timeout=5)
            assert r.status_code == 200, f"Purchase bills fetch failed: {r.status_code}"
        except requests.exceptions.ConnectionError:
            pytest.skip("Backend not running")

    def test_TC_API_008_get_products(self):
        """TC-API-008: Products list returns 200."""
        if not _token:
            pytest.skip("No token")
        try:
            r = requests.get(f"{API_BASE}/products", headers=get_headers(), timeout=5)
            assert r.status_code == 200, f"Products fetch failed: {r.status_code}"
        except requests.exceptions.ConnectionError:
            pytest.skip("Backend not running")

    def test_TC_API_009_get_suppliers(self):
        """TC-API-009: Suppliers list returns 200."""
        if not _token:
            pytest.skip("No token")
        try:
            r = requests.get(f"{API_BASE}/suppliers", headers=get_headers(), timeout=5)
            assert r.status_code == 200, f"Suppliers fetch failed: {r.status_code}"
        except requests.exceptions.ConnectionError:
            pytest.skip("Backend not running")

    def test_TC_API_010_get_lenders(self):
        """TC-API-010: Lenders list returns 200."""
        if not _token:
            pytest.skip("No token")
        try:
            r = requests.get(f"{API_BASE}/lenders", headers=get_headers(), timeout=5)
            assert r.status_code == 200, f"Lenders fetch failed: {r.status_code}"
        except requests.exceptions.ConnectionError:
            pytest.skip("Backend not running")

    def test_TC_API_011_get_brokers(self):
        """TC-API-011: Brokers list returns 200."""
        if not _token:
            pytest.skip("No token")
        try:
            r = requests.get(f"{API_BASE}/brokers", headers=get_headers(), timeout=5)
            assert r.status_code == 200, f"Brokers fetch failed: {r.status_code}"
        except requests.exceptions.ConnectionError:
            pytest.skip("Backend not running")

    def test_TC_API_012_get_attendance_daily(self):
        """TC-API-012: Attendance daily endpoint returns 200."""
        if not _token:
            pytest.skip("No token")
        try:
            from datetime import date
            today = date.today().isoformat()
            r = requests.get(
                f"{API_BASE}/attendance/daily?date={today}",
                headers=get_headers(), timeout=5)
            assert r.status_code == 200, f"Attendance daily fetch failed: {r.status_code}"
        except requests.exceptions.ConnectionError:
            pytest.skip("Backend not running")

    def test_TC_API_013_get_day_operations_status(self):
        """TC-API-013: Day operations status returns 200."""
        if not _token:
            pytest.skip("No token")
        try:
            from datetime import date
            today = date.today().isoformat()
            r = requests.get(
                f"{API_BASE}/day-operations/status?date={today}",
                headers=get_headers(), timeout=5)
            assert r.status_code == 200, f"Day ops status failed: {r.status_code}"
        except requests.exceptions.ConnectionError:
            pytest.skip("Backend not running")

    def test_TC_API_014_protected_route_without_token(self):
        """TC-API-014: Protected route returns 401 without token."""
        try:
            r = requests.get(f"{API_BASE}/employees",
                headers={"Content-Type": "application/json"}, timeout=5)
            assert r.status_code in [401, 403], \
                f"Expected 401/403 without token, got {r.status_code}"
        except requests.exceptions.ConnectionError:
            pytest.skip("Backend not running")

    def test_TC_API_015_get_ledgers(self):
        """TC-API-015: Ledger entries endpoint returns 200."""
        if not _token:
            pytest.skip("No token")
        try:
            r = requests.get(f"{API_BASE}/ledger", headers=get_headers(), timeout=5)
            assert r.status_code == 200, f"Ledger fetch failed: {r.status_code}"
        except requests.exceptions.ConnectionError:
            pytest.skip("Backend not running")
