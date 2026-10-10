#!/usr/bin/env bash
#
# Hardening for the Admit API host (nginx + SSH). Run ON the box as root, after provision-vps.sh. Idempotent: running it twice changes nothing.
#
#   bash harden-vps.sh admit.162-35-28-116.sslip.io
#
# What it does
#   1. nginx: security headers on every API answer, a per-address request limit on the sign-in route (10 a minute, brief burst of 5) and a
#      generous one on the public booking routes, so a script cannot hammer password guesses or flood checkout. 429 when exceeded.
#      (The application also rate-limits by client address; this stops abuse before it reaches Node on a small machine.)
#   2. fail2ban: bans an address that keeps failing SSH logins (the stock sshd jail).
#
# It edits only Admit's own nginx site and adds two files of its own; Raqib's configuration is untouched.
set -euo pipefail
API_HOST="${1:?api host, e.g. admit.162-35-28-116.sslip.io}"
SITE="/etc/nginx/sites-available/admit"
[[ -f "$SITE" ]] || { echo "$SITE not found: run provision-vps.sh first" >&2; exit 1; }

# 1a. the limit zones live at http level
cat > /etc/nginx/conf.d/admit-limits.conf <<'NGINX'
# Admit: one bucket per client address (10 MB holds ~160k addresses).
limit_req_zone $binary_remote_addr zone=admit_login:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=admit_public:10m rate=120r/m;
limit_req_status 429;
NGINX

# 1b. the proxy settings shared by every API location
cat > /etc/nginx/snippets/admit-proxy.conf <<'NGINX'
proxy_pass http://127.0.0.1:3400;
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_read_timeout 120s;
NGINX

# 1c. patch the site once (marker comments make it idempotent)
python3 - "$SITE" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p).read()
if "# admit-hardening" in s:
    print("site already hardened")
    sys.exit(0)
headers = """  # admit-hardening: security headers and request limits
  add_header Strict-Transport-Security "max-age=31536000" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "no-referrer" always;
  add_header X-Frame-Options "DENY" always;

  location = /api/auth/login {
    limit_req zone=admit_login burst=5 nodelay;
    include snippets/admit-proxy.conf;
  }
  location /api/admit/public/ {
    limit_req zone=admit_public burst=60 nodelay;
    include snippets/admit-proxy.conf;
  }

"""
# insert before the first plain /api/ location of the TLS server block
m = re.search(r"\n  location /api/ \{", s)
if not m:
    sys.exit("could not find the /api/ location in " + p)
s = s[: m.start() + 1] + headers + s[m.start() + 1 :]
open(p, "w").write(s)
print("site hardened")
PY
nginx -t
systemctl reload nginx

# 2. fail2ban (the stock sshd jail is enabled by the package)
if ! command -v fail2ban-client >/dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban >/dev/null
fi
systemctl enable --now fail2ban >/dev/null 2>&1
echo "fail2ban: $(fail2ban-client status 2>/dev/null | tr '\n' ' ')"
echo "hardened: $API_HOST"
