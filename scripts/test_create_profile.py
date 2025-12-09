# scripts/test_create_profile.py
import requests, json

BASE = "http://127.0.0.1:8000"

payload = {
    "name": "Test User From Script",
    "relationship": "Friend",
    "description": "Inserted by test script",
    "consent_given": True
}

r = requests.post(f"{BASE}/api/profiles/", json=payload)
print("Status:", r.status_code)
try:
    print(r.json())
except Exception:
    print(r.text)
