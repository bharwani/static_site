#!/usr/bin/env python3
"""Hits every mocked endpoint over real HTTP. Python twin of test-endpoints.mjs.

By default spins up api/server.mjs (Node) on a free port and tears it down after.
Target an already-running server (no spawn) with either:
  --port=8935                        (localhost)
  --base-url=http://host:8935        (full URL)
Volume test: --requests=50  (or REQUESTS_PER_ENDPOINT=50 env var)
"""
import argparse
import json
import os
import random
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API_DIR = Path(__file__).resolve().parent
DATA_DIR = API_DIR

ENDPOINTS = [
    ("GET", "/api/v1/1"),
    ("GET", "/api/v1/2"),
    ("GET", "/api/v1/3"),
    ("POST", "/api/v1/login"),
    ("POST", "/api/v1/register"),
    ("POST", "/api/v2/login"),
    ("POST", "/api/v2/register"),
    ("POST", "/api/v2/users/user-42/create"),
    ("PUT", "/api/v2/users/user-42/update"),
    ("GET", "/api/v2/users/user-42/read"),
    ("DELETE", "/api/v2/users/user-42/delete"),
]


# Mirror of resolveKey() in server.mjs: request path -> data-file key.
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


def read_data(key):
    return json.loads((DATA_DIR / key).read_text())


def free_port():
    with socket.socket() as s:
        s.bind(("localhost", 0))
        return s.getsockname()[1]


def start_server():
    # ponytail: server.mjs treats PORT=0 as falsy, so pick a free port ourselves and pass it.
    port = free_port()
    proc = subprocess.Popen(
        ["node", str(API_DIR / "server.mjs")],
        env={**os.environ, "PORT": str(port)},
        stdout=subprocess.DEVNULL,
    )
    base = f"http://localhost:{port}"
    for _ in range(50):
        try:
            urllib.request.urlopen(f"{base}/api/v1/1", timeout=0.2)
            return proc, base
        except (urllib.error.URLError, ConnectionError):
            time.sleep(0.1)
    proc.terminate()
    sys.exit("mock server failed to start")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--requests", "-n", type=int)
    ap.add_argument("--base-url")
    ap.add_argument("--port", "-p", type=int, help="target an already-running server on this port (no server is spawned)")
    args = ap.parse_args()

    per_endpoint = args.requests or int(os.environ.get("REQUESTS_PER_ENDPOINT", 0)) or 1

    proc = None
    base = args.base_url or (f"http://localhost:{args.port}" if args.port else None)
    if not base:
        proc, base = start_server()
        print(f"Started mock server at {base}")

    failures = total = 0
    try:
        for method, path in ENDPOINTS:
            for _ in range(per_endpoint):
                total += 1
                url = f"{base}{path}?r={random.randint(0, 999999)}"
                req = urllib.request.Request(url, method=method)
                try:
                    with urllib.request.urlopen(req) as res:
                        status, raw = res.status, res.read()
                except urllib.error.HTTPError as e:
                    status, raw = e.code, e.read()
                except urllib.error.URLError as e:
                    status, raw = 0, str(e.reason).encode()

                try:
                    body = json.loads(raw)
                except (ValueError, json.JSONDecodeError):
                    body = None  # non-JSON response (e.g. an http.server 404 HTML page)

                expected = read_data(resolve_key(path))
                ok = status == 200 and body == expected
                shown = json.dumps(body) if body is not None else repr(raw[:60])
                print(f"{'PASS' if ok else 'FAIL'} {method} {url} -> {status} {shown}")
                if not ok:
                    failures += 1
    finally:
        if proc:
            proc.terminate()

    if failures:
        sys.exit(f"\n{failures}/{total} request(s) failed")
    print(f"\nAll {total} requests passed ({len(ENDPOINTS)} endpoints x {per_endpoint})")


if __name__ == "__main__":
    main()
