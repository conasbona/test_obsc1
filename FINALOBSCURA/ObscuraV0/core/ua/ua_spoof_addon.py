# ua_spoof_addon.py
# mitmproxy addon that reads UA from ua_state.json for every request
import json
import os
from mitmproxy import http

UA_FILE = 'ua_state.json'

def get_ua():
    if not os.path.exists(UA_FILE):
        # Default UA if not set
        return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    with open(UA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
        return data.get('user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36')

def request(flow: http.HTTPFlow) -> None:
    ua = get_ua()
    flow.request.headers['User-Agent'] = ua
