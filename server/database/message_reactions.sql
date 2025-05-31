-- Create message_reaction table
CREATE TABLE IF NOT EXISTS message_reaction (
    reaction_id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES message(message_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reaction VARCHAR(8) NOT NULL, -- UTF-8 emoji characters
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id, reaction) -- Each user can use a specific emoji once per message
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_message_reaction_message ON message_reaction(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reaction_user ON message_reaction(user_id); 