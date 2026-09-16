-- Auth hardening: D1 users with PBKDF2 password hashes (Cloudflare-only)

INSERT OR IGNORE INTO organizations (id, name, owner_user_id, account_state, subscription_plan)
VALUES ('org-demo-pgwalo', 'PGWalo Demo', 'user-demo-owner', 'Active', 'Trial');

-- password_hash column (safe if already applied)
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Demo credentials: owner@pgwalo.com / admin@pgwalo.com — password: PGWalo@2026
INSERT OR REPLACE INTO users (id, organization_id, name, email, phone, role, is_profile_completed, status, password_hash)
VALUES (
  'user-demo-owner',
  'org-demo-pgwalo',
  'Demo Owner',
  'owner@pgwalo.com',
  '9999999999',
  'owner',
  1,
  'Active',
  'aa08a160f5abe05ba9b7b49a5f626114:79db3d1ed45330317c98a8ded0b336f36bc3f50d698ceb9bcc5b962ce713f080'
);

INSERT OR REPLACE INTO users (id, organization_id, name, email, phone, role, is_profile_completed, status, password_hash)
VALUES (
  'user-demo-admin',
  'org-demo-pgwalo',
  'Demo Admin',
  'admin@pgwalo.com',
  '9999999998',
  'admin',
  1,
  'Active',
  'aa08a160f5abe05ba9b7b49a5f626114:79db3d1ed45330317c98a8ded0b336f36bc3f50d698ceb9bcc5b962ce713f080'
);
