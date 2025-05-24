# ua_rest_server.py
# Standalone Flask REST API to update UA string in ua_state.json

from flask import Flask, request, jsonify
import threading
import json
import os

UA_FILE = 'ua_state.json'
LOCK = threading.Lock()

def write_ua(ua):
    with LOCK:
        with open(UA_FILE, 'w', encoding='utf-8') as f:
            json.dump({'user_agent': ua}, f)

def read_ua():
    if not os.path.exists(UA_FILE):
        return None
    with LOCK:
        with open(UA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('user_agent')

app = Flask(__name__)

@app.route('/set_ua', methods=['POST'])
def set_ua():
    data = request.json
    if not data or 'ua' not in data:
        return jsonify({'error': 'Missing UA'}), 400
    write_ua(data['ua'])
    return jsonify({'status': 'UA updated'}), 200

@app.route('/get_ua', methods=['GET'])
def get_ua():
    ua = read_ua()
    if ua is None:
        ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        write_ua(ua)
    return jsonify({'user_agent': ua}), 200

if __name__ == '__main__':
    app.run(port=9999, host='127.0.0.1')
