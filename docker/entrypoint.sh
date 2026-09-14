#!/bin/sh
#
# Renders the environment-dependent configuration, then hands over to nginx.
# The VITE_* values are therefore no longer frozen into the image: editing .env
# and restarting the service is enough, as it is for every other service.
# -f turns off globbing: without it the shell would expand a "*" entry in
# FRONTEND_ALLOWED_HOSTS into the current directory's file list, and
# "allow everything" would silently become "refuse everything".
set -euf

config_dir=/tmp/nginx

mkdir -p "$config_dir" "$config_dir/client_body"

# --- listen port -----------------------------------------------------------

port="${PORT:-5173}"
case "$port" in
    '' | *[!0-9]*)
        echo "frontend: PORT must be an integer, got \"$port\"" >&2
        exit 1
        ;;
esac
printf 'listen %s;\n' "$port" >"$config_dir/listen.conf"

# --- allowed host list -----------------------------------------------------
#
# Same semantics as BACKEND_ALLOWED_HOSTS and WEBSOCKET_ALLOWED_HOSTS: empty or
# "*" allows everything, a plain entry matches exactly, and an entry prefixed
# with a dot covers the domain and its subdomains.

entries=$(
    printf '%s' "${FRONTEND_ALLOWED_HOSTS:-}" |
        tr ',' '\n' |
        tr 'A-Z' 'a-z' |
        sed 's/^[[:space:]]*//; s/[[:space:]]*$//' |
        grep -v '^$' || true
)

allow_all=1
if [ -n "$entries" ]; then
    allow_all=0
    for entry in $entries; do
        if [ "$entry" = '*' ] || [ "$entry" = 'true' ]; then
            allow_all=1
        fi
    done
fi

{
    echo 'map $host $frontend_host_allowed {'
    if [ "$allow_all" -eq 1 ]; then
        echo '    default 1;'
    else
        echo '    default 0;'
        for entry in $entries; do
            case "$entry" in
                .*)
                    suffix=$(printf '%s' "${entry#.}" | sed 's/\./\\./g')
                    printf '    ~^(.+\\.)?%s$ 1;\n' "$suffix"
                    ;;
                *)
                    printf '    "%s" 1;\n' "$entry"
                    ;;
            esac
        done
    fi
    echo '}'
} >"$config_dir/allowed-hosts.conf"

if [ "$allow_all" -eq 1 ]; then
    echo "frontend: every host is accepted (FRONTEND_ALLOWED_HOSTS unrestricted)"
else
    echo "frontend: accepted hosts - $(printf '%s' "$entries" | tr '\n' ' ')"
fi

# --- configuration exposed to the browser ----------------------------------

# Escapes a value so it can sit inside a JSON string.
json_string() {
    printf '%s' "${1:-}" |
        tr -d '\n\r' |
        sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

cat >"$config_dir/config.js" <<EOF
// Generated at container start-up. Do not edit.
window.__APP_CONFIG__ = {
  "backendUrl": "$(json_string "${VITE_BACKEND_URL:-}")",
  "websocketUrl": "$(json_string "${VITE_WEBSOCKET_URL:-}")",
  "firebase": {
    "apiKey": "$(json_string "${VITE_FIREBASE_API_KEY:-}")",
    "authDomain": "$(json_string "${VITE_FIREBASE_AUTH_DOMAIN:-}")",
    "projectId": "$(json_string "${VITE_FIREBASE_PROJECT_ID:-}")",
    "appId": "$(json_string "${VITE_FIREBASE_APP_ID:-}")",
    "messagingSenderId": "$(json_string "${VITE_FIREBASE_MESSAGING_SENDER_ID:-}")",
    "storageBucket": "$(json_string "${VITE_FIREBASE_STORAGE_BUCKET:-}")"
  }
};
EOF

if [ -z "${VITE_FIREBASE_API_KEY:-}" ]; then
    echo "frontend: VITE_FIREBASE_* is not set, sign-in will be disabled" >&2
fi

nginx -t -c /etc/nginx/nginx.conf

exec nginx -c /etc/nginx/nginx.conf -g 'daemon off;'
