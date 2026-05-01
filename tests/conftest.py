# tests/conftest.py
import pytest
import time
import sys
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

# Default Credentials
COMPANY_CODE = "TITAN-X"
USERNAME     = "test_selenium@titan.com"
PASSWORD     = "password123"

def pytest_addoption(parser):
    parser.addoption("--port", action="store", default=None, help="Frontend port (e.g. 5173)")
    parser.addoption("--base-url", action="store", default=None, help="Full base URL (e.g. http://localhost:5173)")

def pytest_configure(config):
    config.addinivalue_line("markers", "duplicate: tests for duplicate entry warnings")
    config.addinivalue_line("markers", "crud: full create/read/update/delete tests")
    config.addinivalue_line("markers", "e2e: end-to-end workflow tests")
    config.addinivalue_line("markers", "negative: negative and edge case tests")

@pytest.fixture(scope="session")
def base_url(request):
    url = request.config.getoption("--base-url")
    port = request.config.getoption("--port")
    
    if url:
        return url.rstrip('/')
    
    if port:
        return f"http://localhost:{port}"
    
    # Interactive prompt if not provided
    print("\n" + "="*50)
    print(" 🚀 ERP TESTING SUITE (PHASE 2)")
    print("="*50)
    user_input = input("Please enter the ERP port (default 5173): ").strip()
    if not user_input:
        user_input = "5173"
    
    if user_input.startswith("http"):
        return user_input.rstrip('/')
    return f"http://localhost:{user_input}"

@pytest.fixture(scope="session")
def driver():
    opts = Options()
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1920,1080")
    opts.add_argument("--headless=new")
    opts.add_experimental_option("excludeSwitches", ["enable-logging"])

    # Use the known compatible driver path to avoid network issues
    driver_path = "/Users/barathraj/.wdm/drivers/chromedriver/mac64/147.0.7727.117/chromedriver-mac-arm64/chromedriver"
    
    try:
        service = Service(executable_path=driver_path)
        d = webdriver.Chrome(service=service, options=opts)
    except Exception as e:
        print(f"WARNING: Specific driver path failed: {e}")
        print("Falling back to PATH...")
        service = Service()
        d = webdriver.Chrome(service=service, options=opts)

    d.implicitly_wait(10)
    yield d
    d.quit()

@pytest.fixture(scope="session")
def logged_in_driver(driver, base_url):
    """Returns driver that is already logged into the ERP, with session check."""
    from tests.helpers import login
    
    # Check if already logged in
    driver.get(f"{base_url}/dashboard")
    time.sleep(2)
    
    if "/dashboard" not in driver.current_url:
        print("DEBUG: Not logged in. Performing login...")
        driver.get(f"{base_url}/company-login")
        time.sleep(2)
        login(driver, COMPANY_CODE, USERNAME, PASSWORD)
        
        # Verify login
        time.sleep(3)
        if "/dashboard" not in driver.current_url:
            print(f"ERROR: Login failed. Current URL: {driver.current_url}")
    else:
        print("DEBUG: Already logged in.")
        
    yield driver
