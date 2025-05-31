-- Add accepting_submission column to the assignment table
ALTER TABLE assignment 
ADD COLUMN IF NOT EXISTS accepting_submission BOOLEAN DEFAULT TRUE;