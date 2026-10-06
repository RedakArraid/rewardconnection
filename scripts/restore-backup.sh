#!/bin/sh
set -eu

file=${1:-}

if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "Usage: ./scripts/restore-backup.sh backups/rewardconnection-YYYYMMDD-HHMMSS.dump" >&2
  exit 1
fi

echo "ATTENTION : cette opération remplace entièrement la base RewardConnection."
printf "Tape RESTAURER pour continuer : "
read answer

if [ "$answer" != "RESTAURER" ]; then
  echo "Restauration annulée."
  exit 1
fi

docker compose stop app worker backup

docker compose exec -T db psql -U reward -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='rewardconnection' AND pid <> pg_backend_pid();"

docker compose exec -T db dropdb -U reward --if-exists rewardconnection
docker compose exec -T db createdb -U reward rewardconnection
cat "$file" | docker compose exec -T db pg_restore -U reward -d rewardconnection --no-owner --no-privileges

docker compose start app worker backup

echo "Restauration terminée."
