#!/bin/sh
set -eu

mkdir -p backups
stamp=$(date +%Y%m%d-%H%M%S)
out="backups/rewardconnection-manual-${stamp}.dump"

echo "Création de $out..."
docker compose exec -T db pg_dump -U reward -d rewardconnection -Fc > "$out"
echo "Sauvegarde terminée : $out"
