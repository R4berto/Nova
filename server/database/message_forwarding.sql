-- Add forwarded_from fields to message table
ALTER TABLE message ADD COLUMN IF NOT EXISTS forwarded_from_message_id INTEGER REFERENCES message(message_id) ON DELETE SET NULL;
ALTER TABLE message ADD COLUMN IF NOT EXISTS forwarded_from_sender_name VARCHAR(255);

-- Create index for faster lookups of forwarded messages
CREATE INDEX IF NOT EXISTS idx_message_forwarded_from ON message(forwarded_from_message_id);

-- Add column for last_edit_at to track message edits separately from other updates
ALTER TABLE message ADD COLUMN IF NOT EXISTS last_edit_at TIMESTAMP WITH TIME ZONE; 