# tests/helpers.py
import time
import os
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

def go(driver, path, base_url="http://localhost:5173"):
    """Navigate to a relative path."""
    if path.startswith("http"):
        driver.get(path)
    else:
        driver.get(f"{base_url}{path}")
    time.sleep(1)

def find(driver, selector, timeout=10):
    """Find an element using CSS selector with wait."""
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, selector))
    )

def element_exists(driver, selector, timeout=2):
    """Check if element exists without crashing."""
    try:
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, selector))
        )
        return True
    except:
        return False

def login(driver, company_code, email, password):
    """Perform login using flexible selectors and wait for completion."""
    w = WebDriverWait(driver, 15)
    
    # Company code field
    try:
        cc = w.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, 'input[placeholder*="TITAN-X" i]')
        ))
        cc.clear()
        cc.send_keys(company_code)
    except:
        pass  # Some login forms skip company code

    email_input = w.until(EC.presence_of_element_located(
        (By.CSS_SELECTOR, 'input[placeholder*="organization.com" i]')
    ))
    email_input.clear()
    email_input.send_keys(email)

    pwd = driver.find_element(By.CSS_SELECTOR, 'input[placeholder*="••••" i]')
    pwd.clear()
    pwd.send_keys(password)

    # Click login button
    try:
        btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], button.primary-action-btn, button.btn-primary")
        btn.click()
    except:
        click_text(driver, "Authenticate") or click_text(driver, "Login")

    # CRITICAL: Wait for successful login indicator (e.g., Dashboard or Logout button)
    try:
        w.until(lambda d: "/dashboard" in d.current_url or "logout" in d.page_source.lower())
        time.sleep(2)
    except TimeoutException:
        print(f"WARNING: Login wait timed out. URL: {driver.current_url}")

def take_screenshot(driver, name):
    """Save a screenshot to the screenshots folder."""
    os.makedirs("tests/screenshots", exist_ok=True)
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    path = f"tests/screenshots/{name}_{timestamp}.png"
    try:
        driver.save_screenshot(path)
        print(f"Screenshot saved: {path}")
    except:
        print("Failed to save screenshot")

# --- Phase 2 Specific Helpers ---

def body(driver):
    """Get lowercased page body text for assertions."""
    try:
        # Handle cases where page might be loading or alert is present
        return driver.find_element(By.TAG_NAME, "body").text.lower()
    except Exception as e:
        print(f"DEBUG: Could not get body text: {e}")
        return ""

def fill(driver, selector, value):
    """Safely find, clear and fill an input field."""
    try:
        # Support flexible selectors provided by user logic
        el = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, selector))
        )
        el.clear()
        el.send_keys(value)
        return True
    except Exception as e:
        print(f"DEBUG: Could not fill {selector}: {e}")
        return False

def wait(seconds):
    """Alias for time.sleep to match test imports."""
    time.sleep(seconds)

def click(driver, selector):
    """Click an element using CSS selector."""
    try:
        el = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
        )
        el.click()
        return True
    except Exception as e:
        print(f"DEBUG: Could not click {selector}: {e}")
        return False

def text_present(driver, text):
    """Check if specific text is present in the page body."""
    return text.lower() in body(driver)

def click_text(driver, text):
    """Click a button or element that contains specific text."""
    try:
        # Using XPath for text content matching
        xpath = f"//*[contains(text(), '{text}') or contains(@value, '{text}')]"
        el = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, xpath))
        )
        el.click()
        return True
    except Exception as e:
        print(f"DEBUG: Could not click text '{text}': {e}")
        return False
