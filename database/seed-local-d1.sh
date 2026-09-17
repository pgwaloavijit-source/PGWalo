#!/usr/bin/env bash
# Seed the LOCAL D1 database with schema + demo data.
# PRAGMA foreign_keys is disabled inside a single .execute call because
# wrangler's CLI runs each file in one session and seed rows may reference
# organizations created lazily at runtime.
set -e

DB=pgwalo-db

echo "1/3 Schema..."
npx wrangler d1 execute $DB --local --file=./database/schema.sql

echo "2/3 Migrations (auth, kyc, extras, admin)..."
for f in auth-migration profile-kyc profile-extras admin-console-migration; do
  npx wrangler d1 execute $DB --local --file=./database/$f.sql 2>&1 | grep -E "X \[ERROR\]" || true
done

echo "3/3 Demo data..."
npx tsx database/gen-data-migration.ts
{ echo "PRAGMA defer_foreign_keys = true;"; cat database/data-migration.sql; } > database/.seed-session.sql
npx wrangler d1 execute $DB --local --file=./database/.seed-session.sql
rm database/.seed-session.sql

echo "Seeded local $DB."
