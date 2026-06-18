#!/usr/bin/env sh
# Print an API token for the dev paperless 'admin' user, creating it if needed.
# Run from the repo root (e.g. via `pnpm paperless:token`).
set -e

COMPOSE_FILE="docker/docker-compose.paperless.yml"

if ! docker compose -f "$COMPOSE_FILE" ps --status running paperless >/dev/null 2>&1; then
  echo "paperless container is not running. Start it first:" >&2
  echo "  docker compose -f $COMPOSE_FILE up -d" >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" exec -T paperless python3 manage.py shell <<'PY'
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

user = get_user_model().objects.get(username="admin")
token, _ = Token.objects.get_or_create(user=user)
print(token.key)
PY
