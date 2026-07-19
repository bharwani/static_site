# Server setup

Runbook to install and serve this project on a Linux server (Debian/Ubuntu),
behind nginx with HTTPS. Mirrors the live deploy on `<server>`.

Result: the Flask app (`app.py`) runs under **gunicorn** as a **systemd** service on
`127.0.0.1:8935`, fronted by **nginx** which terminates TLS with a **Let's Encrypt**
cert. The app serves both the static site and the `/api` mock routes.

Prereqs: SSH access with sudo, a domain whose DNS `A` record points at the server's
public IP (required for Let's Encrypt), and Python 3.11+.

---

## 1. Copy the code

From your workstation (needs `rsync` on both ends; else use `scp`/`tar`):

```
rsync -az --exclude '.git' --exclude '.venv' --exclude '__pycache__' \
  --exclude '*.pyc' --exclude '.DS_Store' \
  ./ SERVER:~/website/
```

## 2. Python venv + dependencies

On the server:

```
cd ~/website
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt gunicorn
```

If `python3 -m venv` fails (no pip/ensurepip): `sudo apt-get install -y python3-venv python3-pip`, then recreate the venv.

## 3. gunicorn as a systemd service

```
sudo tee /etc/systemd/system/fastly-site.service >/dev/null <<'UNIT'
[Unit]
Description=Fastly-style site (Flask via gunicorn)
After=network.target

[Service]
User=YOURUSER
WorkingDirectory=/home/YOURUSER/website
ExecStart=/home/YOURUSER/website/.venv/bin/gunicorn --bind 127.0.0.1:8935 --workers 2 app:app
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now fastly-site
systemctl is-active fastly-site
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8935/    # expect 200
```

Bind to `127.0.0.1` (not `0.0.0.0`) — only nginx needs to reach it, and cloud
firewalls typically block 8935 externally anyway.

## 4. nginx reverse proxy

Install nginx if absent (`sudo apt-get install -y nginx`). Add a vhost. Two common
layouts:

**nginx serves the static assets directly from disk; gunicorn serves only `/api`.**
First stage the static files (everything except `api/` and the server-side code) to a
web root nginx can read:

```
sudo mkdir -p /var/www/fastly-site
sudo cp ~/website/index.html /var/www/fastly-site/
sudo cp -r ~/website/css ~/website/js ~/website/images /var/www/fastly-site/
```

**A. App under a path prefix** (site at `/site/`, API at `/api/`, another static root at `/`) —
the `<server>` layout:

```
sudo tee /etc/nginx/conf.d/fastly-site.conf >/dev/null <<'CONF'
server {
    listen 80;
    server_name YOURDOMAIN;

    root /var/www/html;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }

    location = /site { return 301 /site/; }

    location /site/ {
        alias /var/www/fastly-site/;             # static, served by nginx
        index index.html;
    }

    location = /api {                            # bare /api (location /api/ won't match it)
        proxy_pass http://127.0.0.1:8935;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8935;        # only /api goes to gunicorn
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
CONF
```

**B. App at the domain root** (page at `/`, API at `/api`) — the
`site.pigsheepcow.xyz` layout:

```
sudo tee /etc/nginx/conf.d/DOMAIN.conf >/dev/null <<'CONF'
server {
    listen 80;
    server_name YOURDOMAIN;

    root /var/www/fastly-site;                    # static, served by nginx
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8935;         # only /api goes to gunicorn
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
CONF
```

Then:

```
sudo nginx -t && sudo systemctl reload nginx
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: YOURDOMAIN" http://localhost/
```

Page assets are relative so they resolve under whatever path serves the page; the "Run
API tests" button fetches absolute `/api/...`, so `/api` must be reachable on the same host.
(`app.py` is API-only — it serves no static; nginx serves the assets. Bare `/api` needs a
`location = /api` proxy block since `location /api/` only matches the trailing-slash form.)

## 5. HTTPS with Let's Encrypt

```
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOURDOMAIN --non-interactive --agree-tos \
  --register-unsafely-without-email --redirect
```

certbot edits the vhost to add `listen 443 ssl`, the cert paths, and an 80→443
redirect. Renewal is automatic via `certbot.timer` (verify: `sudo certbot renew --dry-run`).

> Let's Encrypt no longer stores an account contact email — the field showing `none`
> is expected. Use `--register-unsafely-without-email`.

## 6. Adding another domain

Repeat step 4 (layout B) in a new `conf.d/DOMAIN.conf`, then step 5 for that domain.
Each domain gets its own vhost + cert; DNS for each must point at the server.

## 7. Redeploy after code changes

```
rsync -az --exclude '.git' --exclude '.venv' ./ SERVER:~/website/
ssh SERVER 'sudo rsync -a --delete ~/website/index.html ~/website/css ~/website/js ~/website/images /var/www/fastly-site/ \
  && cd ~/website && .venv/bin/pip install -q -r requirements.txt && sudo systemctl restart fastly-site'
```

(The `sudo rsync ...` step refreshes the nginx-served static assets; `restart fastly-site` reloads the `/api` app.)

## 8. (Optional) Signal Sciences / Next-Gen WAF nginx module

Only if the box runs the NGWAF agent. The native `nxo` module is **exact-version-locked**
to nginx, so nginx must match an available module build.

```
# Point the sigsci apt repo at the correct distro (Debian bookworm shown):
echo "deb [signed-by=/usr/share/keyrings/sigsci.gpg] https://apt.security.fastly.com/release/debian/ bookworm main" \
  | sudo tee /etc/apt/sources.list.d/sigsci-release.list
sudo apt-get update

# Find the newest module version and align nginx to it (downgrade + hold if needed):
apt-cache madison nginx-module-sigsci-nxo
sudo apt-get install -y --allow-downgrades nginx=<MATCHING>-1~bookworm
sudo apt-get install -y nginx-module-sigsci-nxo=<MATCHING>-1400
sudo apt-mark hold nginx nginx-module-sigsci-nxo

# Load the module (main context, top of nginx.conf):
sudo sed -i '/^pid /a load_module modules/ngx_http_sigsci_module.so;' /etc/nginx/nginx.conf
sudo nginx -t && sudo systemctl restart nginx
```

The module connects to the running `sigsci-agent` over `/var/run/sigsci.sock` by
default. The agent needs valid site keys in `/etc/sigsci/agent.conf` (secrets — set on
the box, never in the repo) to report to the console or block.

## Troubleshooting

- **`curl` to the public port hangs / `000`.** Cloud firewall blocks it. Only expose
  80/443; keep gunicorn on `127.0.0.1:8935`.
- **certbot/gunicorn output buried in DEBUG lines.** A Datadog `ddtrace` wrapper floods
  stdout — filter with `grep -viE "ddtrace|telemetry|DEBUG|dd\."`.
- **`nginx` not on `$PATH` over SSH.** Use `/usr/sbin/nginx` or `sudo nginx`.
- **Verify a route end to end:** `python3 api/test_endpoints.py --base-url=https://YOURDOMAIN`,
  or hit every endpoint N times against the live domain: `python3 api/hit_endpoints.py YOURDOMAIN 5`
  (https by default; `localhost`/`host:port` default to http).
