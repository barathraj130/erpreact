from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
import time

opts = Options()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")

driver_path = "/usr/local/bin/chromedriver"
service = Service(executable_path=driver_path)

print("Starting driver...")
try:
    driver = webdriver.Chrome(service=service, options=opts)
    print("Driver started successfully!")
    driver.get("http://localhost:5173")
    print(f"Title: {driver.title}")
    driver.quit()
except Exception as e:
    print(f"Error: {e}")
