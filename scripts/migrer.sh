#!/usr/bin/env bash
# Applique les migrations SQL (supabase/migrations/*.sql) sur la base Supabase.
# Chaque fichier n'est exécuté qu'une fois : l'historique est tenu dans
# la table public._migrations.
#
#   npm run db:migrer
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; source .env; set +a

: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL manquant dans .env}"
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD manquant dans .env}"

REF=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's#https://([^.]+)\..*#\1#')
export PGPASSWORD="$SUPABASE_DB_PASSWORD"
export PGCONNECT_TIMEOUT=15
CONN="host=${SUPABASE_DB_HOST:-db.$REF.supabase.co} port=${SUPABASE_DB_PORT:-5432} dbname=postgres user=${SUPABASE_DB_USER:-postgres} sslmode=require"

psql "$CONN" -q -v ON_ERROR_STOP=1 -c \
  "create table if not exists public._migrations (nom text primary key, appliquee_le timestamptz not null default now());
   alter table public._migrations enable row level security;
   revoke all on public._migrations from anon, authenticated;" >/dev/null

for fichier in supabase/migrations/*.sql; do
  nom=$(basename "$fichier")
  deja=$(psql "$CONN" -Atc "select 1 from public._migrations where nom = '$nom'")
  if [ "$deja" = "1" ]; then
    echo "  ✓ $nom (déjà appliquée)"
    continue
  fi
  echo "  → $nom"
  psql "$CONN" -q -v ON_ERROR_STOP=1 --single-transaction -f "$fichier" \
    -c "insert into public._migrations (nom) values ('$nom')"
done

echo "Base à jour."
