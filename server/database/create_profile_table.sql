-- Create user_profile table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profile (
    profile_id SERIAL PRIMARY KEY,
    user_id UUID UNIQUE NOT NULL,
    profile_picture_url VARCHAR(255),
    last_login TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create index for faster profile lookups if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_user_profile ON user_profile(user_id);

-- Create a function to update the timestamp when profile is modified
CREATE OR REPLACE FUNCTION update_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists, then recreate it
DROP TRIGGER IF EXISTS update_profile_timestamp ON user_profile;
CREATE TRIGGER update_profile_timestamp
BEFORE UPDATE ON user_profile
FOR EACH ROW
EXECUTE FUNCTION update_profile_timestamp();