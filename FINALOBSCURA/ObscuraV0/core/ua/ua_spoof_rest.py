# ua_spoof_rest.py
# mitmproxy addon for dynamic User-Agent spoofing via REST API
# Flask REST API listens on 127.0.0.1:9999 for UA updates

from mitmproxy import http
import threading
from flask import Flask, request, jsonify

app = Flask(__name__)
ua_state = {"user_agent": "I PISS ON YOUR LEGACY, COGAN! I PISS ON IT! Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"}
ua_lock = threading.Lock()

@app.route("/set_ua", methods=["POST"])
def set_ua():
    data = request.json
    if not data or "ua" not in data:
        return jsonify({"error": "Missing UA"}), 400
    with ua_lock:
        ua_state["user_agent"] = data["ua"]
    return jsonify({"status": "UA updated"}), 200

def run_flask():
    import logging
    logging.getLogger('werkzeug').setLevel(logging.ERROR)
    app.run(port=9999, host="127.0.0.1")

threading.Thread(target=run_flask, daemon=True).start()

def request(flow: http.HTTPFlow) -> None:
    with ua_lock:
        ua = ua_state["user_agent"]
    flow.request.headers["User-Agent"] = ua
