#!/usr/bin/env bash
# Creates a self-signed TLS certificate for nginx in nginx/certs (development only).
#
# The certificate is valid for localhost, 127.0.0.1, this machine's host name and its
# current network address, plus any extra host names or IP addresses given as arguments:
#   scripts/generate-cert.sh bandvcard.example.internal 10.0.0.5
# An existing certificate is kept; pass --force as the first argument to replace it.
set -euo pipefail

cd "$(dirname "$0")/.."

force=false
if [[ "${1:-}" == "--force" ]]; then
    force=true
    shift
fi

dir=nginx/certs
if [[ -f $dir/server.crt && -f $dir/server.key ]] && ! $force; then
    echo "Certificate already exists in $dir, kept (use --force to replace)"
    exit 0
fi

names=(localhost 127.0.0.1 "$(hostname)")
lan_ip=$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' || true)
[[ -n "$lan_ip" ]] && names+=("$lan_ip")
names+=("$@")

san=""
for name in "${names[@]}"; do
    if [[ $name =~ ^[0-9.]+$ || $name == *:* ]]; then
        san+="IP:$name,"
    else
        san+="DNS:$name,"
    fi
done

mkdir -p "$dir"
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes \
    -keyout "$dir/server.key" -out "$dir/server.crt" \
    -days 825 -subj "/CN=bandvcard development" \
    -addext "subjectAltName=${san%,}" \
    -addext "basicConstraints=critical,CA:FALSE" \
    -addext "keyUsage=critical,digitalSignature" \
    -addext "extendedKeyUsage=serverAuth" 2>/dev/null
chmod 600 "$dir/server.key"

echo "Created $dir/server.crt, valid for: ${names[*]}"
echo "Run 'docker compose up -d --force-recreate nginx' to use it."
