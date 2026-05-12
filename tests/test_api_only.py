import requests
API_URL = "http://localhost:3001/api"

def test_api_health():
    res = requests.get(f"{API_URL}/health")
    assert res.status_code == 200
    assert res.json()['status'] == 'ok'
