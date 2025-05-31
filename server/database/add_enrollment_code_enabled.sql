-- Add enrollment_code_enabled column to the course table if it doesn't exist
ALTER TABLE course ADD COLUMN IF NOT EXISTS enrollment_code_enabled BOOLEAN DEFAULT TRUE; 