#!/usr/bin/env python3
"""Hit every /api endpoint N times against a live domain.

Usage:
  python3 api/hit_endpoints.py DOMAIN COUNT

  DOMAIN  host or full base URL (gcp.ameet.info, https://gcp.ameet.info)
  COUNT   requests per endpoint (default 1)

Reports HTTP status per request; exits non-zero if any response is not 2xx.
"""
import sys
import urllib.error
import urllib.request

ENDPOINTS = [
    ("GET", "/api"),
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


def base_url(domain):
    if domain.startswith(("http://", "https://")):
        return domain
    # ponytail: local hosts / explicit ports have no TLS; default those to http, else https.
    local = domain.startswith(("localhost", "127.0.0.1")) or ":" in domain
    return f"{'http' if local else 'https'}://{domain}"


def hit(method, url):
    req = urllib.request.Request(url, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.status
    except urllib.error.HTTPError as e:
        return e.code
    except urllib.error.URLError as e:
        return f"ERR {e.reason}"


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    base = base_url(sys.argv[1]).rstrip("/")
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 1

    failures = total = 0
    for method, path in ENDPOINTS:
        for _ in range(count):
            total += 1
            status = hit(method, f"{base}{path}")
            ok = isinstance(status, int) and 200 <= status < 300
            print(f"{'PASS' if ok else 'FAIL'} {method} {base}{path} -> {status}")
            if not ok:
                failures += 1

    if failures:
        sys.exit(f"\n{failures}/{total} request(s) failed")
    print(f"\nAll {total} requests passed ({len(ENDPOINTS)} endpoints x {count})")


if __name__ == "__main__":
    main()
