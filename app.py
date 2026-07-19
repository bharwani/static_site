#!/usr/bin/env python3
"""Flask host for the mocked /api routes (API only — static assets are served separately).

    pip install -r requirements.txt
    python3 app.py                 # http://localhost:8935/api/  (PORT=... to change)

Maps /api paths to the static JSON files under api/ (same routing as api/server.mjs).
Serves no static site — nginx (prod) or api/server.mjs (local dev) handles that.
"""
import os
import re
from pathlib import Path

from flask import Flask, jsonify, send_from_directory

API_DIR = Path(__file__).resolve().parent / "api"

app = Flask(__name__, static_folder=None)


# Mirror of resolveKey() in api/server.mjs: request path -> data-file key under api/.
def resolve_key(path):
    m = re.match(r"^/api/v1/(1|2|3|login|register)(/.*)?$", path)
    if m:
        return f"v1/{m.group(1)}"
    m = re.match(r"^/api/v2/(login|register)(/.*)?$", path)
    if m:
        return f"v2/{m.group(1)}"
    m = re.match(r"^/api/v2/users/[^/]+/(create|update|read|delete)/?$", path)
    if m:
        return f"v2/users/{m.group(1)}"
    return None


@app.route("/api", methods=["GET", "POST", "PUT", "DELETE"])
@app.route("/api/", methods=["GET", "POST", "PUT", "DELETE"])
def api_root():
    return jsonify(message="API endpoints")


@app.route("/api/<path:subpath>", methods=["GET", "POST", "PUT", "DELETE"])
def api(subpath):
    key = resolve_key(f"/api/{subpath}")
    if key and (API_DIR / key).is_file():
        return send_from_directory(API_DIR, key, mimetype="application/json")
    return jsonify(status="not found", path=f"/api/{subpath}"), 404


if __name__ == "__main__":
    app.run(port=int(os.environ.get("PORT", 8935)))
