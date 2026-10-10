#!/usr/bin/env bash
# Generates random values for POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD and ABACUS_API_KEY and writes them to .env.
#
# Values that are already set to something other than a placeholder are kept;
# pass --force to replace them as well.
# If the postgres container is running, its user gets the new password too,
# because an existing database volume keeps the password it was created with.
set -euo pipefail

cd "$(dirname "$0")/.."

force=false
[[ "${1:-}" == "--force" ]] && force=true

if [[ ! -f .env ]]; then
    cp .env.example .env
    echo "Created .env from .env.example"
fi
chmod 600 .env

generate() {
    # Letters and digits only, so the value is safe in connection strings and SQL.
    LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32 || true
}

current() {
    grep -E "^$1=" .env | tail -n 1 | cut -d= -f2-
}

is_placeholder() {
    [[ -z "$1" || "$1" == change-me* ]]
}

set_value() {
    local key=$1 value=$2
    if grep -qE "^$key=" .env; then
        sed -i "s|^$key=.*|$key=$value|" .env
    else
        printf '%s=%s\n' "$key" "$value" >>.env
    fi
}

postgres_changed=false
for key in POSTGRES_PASSWORD MINIO_ROOT_PASSWORD ABACUS_API_KEY; do
    if $force || is_placeholder "$(current "$key")"; then
        set_value "$key" "$(generate)"
        echo "$key: new value written to .env"
        [[ $key == POSTGRES_PASSWORD ]] && postgres_changed=true
    else
        echo "$key: already set, kept (use --force to replace)"
    fi
done

if $postgres_changed && [[ -n "$(docker compose ps -q --status running postgres 2>/dev/null)" ]]; then
    user=$(current POSTGRES_USER)
    docker compose exec -T postgres psql -q -U "$user" -d "$(current POSTGRES_DB)" \
        -c "ALTER USER \"$user\" PASSWORD '$(current POSTGRES_PASSWORD)'"
    echo "POSTGRES_PASSWORD: also changed in the running database"
fi

echo "Run 'docker compose up -d' to restart the services with the new passwords."
