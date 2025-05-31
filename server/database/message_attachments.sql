-- Create table for message file attachments
CREATE TABLE IF NOT EXISTS message_file (
    file_id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES message(message_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_image BOOLEAN DEFAULT FALSE,
    file_url TEXT
);

-- Add file_url column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'message_file' AND column_name = 'file_url'
    ) THEN
        ALTER TABLE message_file ADD COLUMN file_url TEXT;
    END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_message_file_message ON message_file(message_id);
CREATE INDEX IF NOT EXISTS idx_message_file_is_image ON message_file(is_image); 