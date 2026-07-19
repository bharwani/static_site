# Fastly-style landing page

A single-page, static clone of fastly.com's homepage. Plain HTML/CSS/JS — no build step, no framework. The page itself has zero dependencies; the optional `/api` mock host runs on either stdlib Node (`api/server.mjs`) or Flask (`app.py`).

## Run it

Static only:

```
python3 -m http.server 8934
```

Then open http://localhost:8934/index.html. (The "Run API tests" button won't work here — see below.)

With the API test button working (page + `/api` on one origin) use the Node host:

```
node api/server.mjs      # serves the static site AND /api on http://localhost:8935/
```

Then open http://localhost:8935/.

`app.py` (Flask) serves **only** `/api` — run it when you just need the API:

```
pip install -r requirements.txt && python3 app.py   # /api on http://localhost:8935/api/
```

## Structure

```
index.html          all page content (hero, platform, network stats, solutions, spotlights, CTA, API test panel, footer)
css/style.css        styles, responsive breakpoints at 1080px / 780px / 640px
js/main.js            mobile nav toggle + stat count-up animation
js/api-tests.js       "Run API tests" button — fires real fetch() at the /api endpoints
images/               logo, hero graphic, section icons (.svg originals + rasterized .jpg copies; index.html uses the .jpg)
api/v1/, api/v2/      static JSON response files, one per route (v1/1, v2/users/create, ...; no extension)
api/server.mjs        stdlib HTTP server: serves the static site + the /api routes
app.py                Flask host: serves ONLY the /api routes (static served separately by nginx/server.mjs)
requirements.txt      Python deps for app.py (flask)
Dockerfile            containerized Flask host (gunicorn on 8935)
api/server.test.mjs   unit test for path-to-file routing (node api/server.test.mjs)
api/test-endpoints.mjs CLI smoke/volume test that hits every endpoint over real HTTP (see below)
api/test_endpoints.py  Python twin of test-endpoints.mjs (same flags)
api/hit_endpoints.py   hit every /api endpoint N times against a live domain (DOMAIN COUNT)
```

## Mock API

Responses are static JSON files under `api/` (`api/v1/`, `api/v2/`), stored without a file extension. `api/server.mjs` maps a request path to a file and returns it verbatim (404 if no file matches). No JS builds response bodies — edit the files to change responses.

Routes (path → file):
- `/api` and `/api/` → `{"message": "API endpoints"}` (base, no file)
- `/api/v1/{1,2,3,login,register}/*` → `api/v1/{1,2,3,login,register}`
- `/api/v2/{login,register}/*` → `api/v2/{login,register}`
- `/api/v2/users/:userId/{create,update,read,delete}` → `api/v2/users/{create,update,read,delete}` (userId ignored)

Trailing path segments and the `:userId` are ignored when picking the file.

Run the server (also serves the static site — open http://localhost:8935/ and click **Run API tests**):

```
node api/server.mjs                 # listens on http://localhost:8935 (PORT=... to change)
```

Test from the terminal:

```
node api/server.test.mjs                        # path-to-file routing unit test
node api/test-endpoints.mjs                      # spins up its own server, hits every endpoint once
node api/test-endpoints.mjs --requests=50        # volume test, 50 requests/endpoint
REQUESTS_PER_ENDPOINT=50 node api/test-endpoints.mjs   # same, via env var
node api/test-endpoints.mjs --base-url=http://localhost:8935   # hit an already-running server
python3 api/test_endpoints.py                    # Python twin, same flags (--requests / --base-url)
python3 api/test_endpoints.py --port=8935        # target an already-running server (no spawn)
python3 api/hit_endpoints.py <server> 5    # hit each endpoint 5x on a live domain (https by default; localhost/host:port -> http)
```

## Docker

The `Dockerfile` runs the Flask host (`app.py`) under gunicorn — **API only**:

```
docker build -t fastly-site .
docker run -p 8935:8935 fastly-site      # http://localhost:8935/api/
```

## Deployment

Live at **https://<server>/site/** — the API is at **https://<server>/api/**. (`/site` redirects to `/site/`; bare `/` serves static files from `/var/www/html`.)

Stack on the server: **nginx** serves the static assets (html/css/js/images) directly from `/var/www/fastly-site` and terminates TLS on `:443` with a **Let's Encrypt** cert (`certbot --nginx`, auto-renewed by `certbot.timer`). Only `/api` is reverse-proxied to **gunicorn** (systemd unit `fastly-site`, venv, `127.0.0.1:8935`). Port 80 redirects to 443. nginx serves the page under `/site/` and the mock under `/api/`.

Full server install/setup runbook: **[SETUP.md](SETUP.md)**.

Redeploy after code changes:

```
rsync -az --exclude '.git' --exclude '.venv' ./ <server>:~/website/
ssh <server> 'cd ~/website && .venv/bin/pip install -q -r requirements.txt && sudo systemctl restart fastly-site'
```

## Notes

- The "Run API tests" button fires real `fetch()` at relative `/api/...` paths — watch them in DevTools' Network tab. They only resolve when the page is served by a host that routes `/api` (`node api/server.mjs`, `app.py`, or the deployed site); under `python3 -m http.server` they 404.
- Images: `.svg` originals are hand-drawn/vector; matching `.jpg` files are rasterized copies. `index.html` currently references the `.jpg` versions.
