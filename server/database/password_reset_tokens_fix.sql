-- Drop existing indexes first
DROP INDEX IF EXISTS idx_user_reset_token;
DROP INDEX IF EXISTS idx_token_lookup;

-- Drop the existing table (if any issues with constraints)
DROP TABLE IF EXISTS password_reset_tokens;

-- Recreate the Password Reset Tokens Table with correct constraints
CREATE TABLE password_reset_tokens (
  token_id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE
);

-- Create an index on token for fast lookups
CREATE INDEX idx_token_lookup ON password_reset_tokens(token);

-- Create a function to invalidate existing tokens
CREATE OR REPLACE FUNCTION invalidate_existing_tokens(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE password_reset_tokens
  SET used = TRUE
  WHERE user_id = p_user_id AND used = FALSE;
END;
$$ LANGUAGE plpgsql;

-- Add a cleanup function to periodically remove expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens
  WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql; 