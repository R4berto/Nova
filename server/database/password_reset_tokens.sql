-- Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE
);

-- Create a unique index to ensure only one active token per user
-- This index allows us to find and invalidate any existing tokens when a new one is requested
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_reset_token ON password_reset_tokens(user_id)
WHERE used = FALSE;

-- Create an index on token for fast lookups
CREATE INDEX IF NOT EXISTS idx_token_lookup ON password_reset_tokens(token);

-- Add a cleanup function to periodically remove expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens
  WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Example of how to call the cleanup function (can be scheduled with pg_cron):
-- SELECT cleanup_expired_tokens(); 