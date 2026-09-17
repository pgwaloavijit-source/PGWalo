#!/usr/bin/env bash
# Apply every D1 migration in order, for local or remote.
#
# SQLite has no `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and Wrangler aborts
# a file at the first error — so this runner probes the live schema first and
# only applies the migrations whose columns/tables are still missing.
# Re-running it is always safe and cheap.
#
#   bash database/apply-migrations.sh            # local (default)
#   bash database/apply-migrations.sh --remote   # production D1
set -uo pipefail

DB="${D1_DB:-pgwalo-db}"
MODE="--local"
if [ "${1:-}" = "--remote" ]; then MODE="--remote"; fi

read_sql() { npx wrangler d1 execute "$DB" "$MODE" --json --command "$1" 2>/dev/null; }

# One round-trip answers "what is already applied?". Must stay on a single
# line — Wrangler's --command rejects embedded newlines.
PROBE="SELECT (SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='password_hash') AS password_hash, (SELECT COUNT(*) FROM pragma_table_info('properties') WHERE name IN ('owner_user_id','place_label')) AS properties_owner, (SELECT COUNT(*) FROM pragma_table_info('staff_members') WHERE name IN ('owner_user_id','organization_id')) AS staff_owner, (SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='aadhaar_hash') AS aadhaar_hash, (SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='profile_extras') AS profile_extras,  (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='support_tickets') AS support_tickets, (SELECT COUNT(*) FROM pragma_table_info('broadcast_notifications') WHERE name='recipient_id') AS broadcast_recipient, (SELECT COUNT(*) FROM pragma_table_info('maintenance_tickets') WHERE name='requester_id') AS maint_requester, (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='auth_events') AS auth_events;"

RAW="$(read_sql "$PROBE")"
JSON="$(printf '%s' "$RAW" | sed -n '/^\[/,$p')"
if [ -z "$JSON" ]; then
  echo "Could not read schema state from $DB. Raw output:"
  printf '%s\n' "$RAW" | tail -20
  exit 1
fi

FLAGS="$(printf '%s' "$JSON" | node -e "
let s=''; process.stdin.on('data', d => s += d).on('end', () => {
  try {
    const rows = JSON.parse(s);
    const r = rows[0].results[0];
    console.log([r.password_hash, r.properties_owner, r.staff_owner, r.aadhaar_hash, r.profile_extras, r.support_tickets, r.broadcast_recipient, r.maint_requester, r.auth_events].join(' '));
  } catch (e) { console.error('parse-failed'); process.exit(1); }
});")" || { echo "Could not parse schema state."; exit 1; }

read -r HAS_AUTH HAS_PROP_OWNER HAS_STAFF_OWNER HAS_AADHAAR HAS_EXTRAS HAS_TICKETS HAS_RECIPIENT HAS_MAINT_REQ HAS_EVENTS <<< "$FLAGS"

echo "Applying migrations to $DB ($MODE)…"

apply_file() {
  local file="$1"
  local out
  out="$(npx wrangler d1 execute "$DB" "$MODE" --file="./database/$file" 2>&1)"
  if printf '%s' "$out" | grep -qE "\[ERROR\]|✘"; then
    echo "  ✗ $file"
    printf '%s\n' "$out" | tail -6
    return 1
  fi
  echo "  ✓ $file"
}

skipped() { echo "  · $1 (already applied)"; }

# 1. Base schema — CREATE TABLE IF NOT EXISTS, so always safe.
apply_file "schema.sql"

# 2. Additive migrations, gated on the probe.
if [ "$HAS_AUTH" -gt 0 ]; then skipped "auth-migration.sql"; else apply_file "auth-migration.sql"; fi

if [ "$HAS_PROP_OWNER" -ge 2 ]; then
  skipped "listings.sql"
else
  # properties.owner_user_id / place_label — the columns that make listing
  # publish and the admin PG-owner view work.
  apply_file "listings.sql"
fi

if [ "$HAS_STAFF_OWNER" -ge 2 ]; then skipped "tenant-staff.sql"; else apply_file "tenant-staff.sql"; fi
if [ "$HAS_AADHAAR" -gt 0 ]; then skipped "profile-kyc.sql"; else apply_file "profile-kyc.sql"; fi
if [ "$HAS_EXTRAS" -gt 0 ]; then skipped "profile-extras.sql"; else apply_file "profile-extras.sql"; fi
if [ "$HAS_TICKETS" -gt 0 ]; then skipped "admin-console-migration.sql"; else apply_file "admin-console-migration.sql"; fi
if [ "$HAS_RECIPIENT" -gt 0 ]; then skipped "notification-recipients.sql"; else apply_file "notification-recipients.sql"; fi
if [ "$HAS_MAINT_REQ" -gt 0 ]; then skipped "maintenance-tickets.sql"; else apply_file "maintenance-tickets.sql"; fi
if [ "$HAS_EVENTS" -gt 0 ]; then skipped "auth-events.sql"; else apply_file "auth-events.sql"; fi

# 3. maintenance_tickets link columns — each ALTER runs only when the column is
# missing, because a duplicate-column error would abort the remaining batch.
ensure_maint_column() {
  local col="$1"
  local present
  present="$(npx wrangler d1 execute "$DB" "$MODE" --json --command "SELECT COUNT(*) AS n FROM pragma_table_info('maintenance_tickets') WHERE name='$col'" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s)[0].results[0].n)}catch(e){console.log('0')}})")"
  if [ "$present" = "0" ]; then
    if npx wrangler d1 execute "$DB" "$MODE" --command "ALTER TABLE maintenance_tickets ADD COLUMN $col TEXT" >/dev/null 2>&1; then
      echo "  ✓ maintenance_tickets.$col added"
    else
      echo "  ✗ maintenance_tickets.$col could not be added"
    fi
  else
    echo "  · maintenance_tickets.$col exists"
  fi
}

for COL in organization_id resident_id requester_id property_id property_name updated_at escalated_at; do
  ensure_maint_column "$COL"
done

# Indexes are idempotent.
apply_file "maintenance-tickets.sql"

echo "Done."
