-- Email Verification Tokens Table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token_id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE
);

-- Create a unique index to ensure only one active token per email
-- This index allows us to find and invalidate any existing tokens when a new one is requested
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verification_token ON email_verification_tokens(email)
WHERE used = FALSE;

-- Create an index on token for fast lookups
CREATE INDEX IF NOT EXISTS idx_verification_token_lookup ON email_verification_tokens(token);

-- Add a cleanup function to periodically remove expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_verification_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM email_verification_tokens
  WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Example of how to call the cleanup function (can be scheduled with pg_cron):
-- SELECT cleanup_expired_verification_tokens(); 