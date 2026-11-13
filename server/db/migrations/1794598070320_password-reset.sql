-- Up Migration
-- Password reset by email (KAN-69). Only a SHA-256 hash of each token is stored; the token
-- itself exists only in the email. Additive, so the previous image keeps working on rollback.
CREATE TABLE password_reset_tokens (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  bytea       NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

CREATE INDEX ON password_reset_tokens (user_id);

-- Logins issued before this moment stop working: a reset signs out every device
ALTER TABLE users ADD COLUMN password_changed_at timestamptz;

-- Down Migration
ALTER TABLE users DROP COLUMN password_changed_at;
DROP TABLE password_reset_tokens;
