-- Create conversations table
CREATE TABLE IF NOT EXISTS conversation (
    conversation_id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    conversation_type VARCHAR(20) CHECK (conversation_type IN ('private', 'group')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    course_id INTEGER REFERENCES course(course_id) ON DELETE CASCADE,
    profile_picture_url VARCHAR(255)
);

-- Create conversation_participants table to track who is in each conversation
CREATE TABLE IF NOT EXISTS conversation_participant (
    participant_id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversation(conversation_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(conversation_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS message (
    message_id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversation(conversation_id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Create message_read_status to track which messages have been read by which participants
CREATE TABLE IF NOT EXISTS message_read_status (
    status_id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES message(message_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    UNIQUE(message_id, user_id)
);

-- Create message_attachment table
CREATE TABLE IF NOT EXISTS message_attachment (
    attachment_id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES message(message_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversation_course ON conversation(course_id);
CREATE INDEX IF NOT EXISTS idx_conversation_type ON conversation(conversation_type);
CREATE INDEX IF NOT EXISTS idx_conversation_profile_pic ON conversation(profile_picture_url);
CREATE INDEX IF NOT EXISTS idx_conversation_participant_conversation ON conversation_participant(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participant_user ON conversation_participant(user_id);
CREATE INDEX IF NOT EXISTS idx_message_conversation ON message(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_sender ON message(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_read_status_message ON message_read_status(message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_status_user ON message_read_status(user_id);
CREATE INDEX IF NOT EXISTS idx_message_attachment_message ON message_attachment(message_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_message_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to update conversation timestamps when new messages arrive
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversation
    SET updated_at = CURRENT_TIMESTAMP
    WHERE conversation_id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_message_timestamp
    BEFORE UPDATE ON message
    FOR EACH ROW
    EXECUTE FUNCTION update_message_timestamp();

CREATE TRIGGER update_conversation_timestamp
    AFTER INSERT ON message
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- Create function to automatically create read status entries for new messages
CREATE OR REPLACE FUNCTION create_message_read_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert read status for all participants except the sender
    INSERT INTO message_read_status (message_id, user_id)
    SELECT NEW.message_id, cp.user_id
    FROM conversation_participant cp
    WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id != NEW.sender_id;
    
    -- Automatically mark as read for the sender
    INSERT INTO message_read_status (message_id, user_id, read_at)
    VALUES (NEW.message_id, NEW.sender_id, CURRENT_TIMESTAMP);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to generate read status records when messages are created
CREATE TRIGGER create_message_read_status
    AFTER INSERT ON message
    FOR EACH ROW
    EXECUTE FUNCTION create_message_read_status();

-- Migration to clean up duplicate course chats
-- This procedure keeps only one chat per course_id (the oldest one)
CREATE OR REPLACE PROCEDURE cleanup_duplicate_course_chats()
LANGUAGE plpgsql
AS $$
DECLARE
  course_id_var INTEGER;
  first_chat_id INTEGER;
  dup_chat_id INTEGER;
BEGIN
  -- For each course_id that has more than one group chat
  FOR course_id_var IN 
    SELECT DISTINCT c.course_id 
    FROM conversation c
    WHERE c.conversation_type = 'group' AND c.course_id IS NOT NULL
    GROUP BY c.course_id
    HAVING COUNT(*) > 1
  LOOP
    -- Find the oldest chat for this course (to keep)
    SELECT conversation_id INTO first_chat_id
    FROM conversation
    WHERE conversation_type = 'group' AND course_id = course_id_var
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Find and process each duplicate chat
    FOR dup_chat_id IN
      SELECT conversation_id
      FROM conversation
      WHERE conversation_type = 'group' 
        AND course_id = course_id_var
        AND conversation_id != first_chat_id
    LOOP
      -- Check if there are any participants in the duplicate that aren't in the original
      INSERT INTO conversation_participant (conversation_id, user_id, joined_at)
      SELECT first_chat_id, cp.user_id, cp.joined_at
      FROM conversation_participant cp
      WHERE cp.conversation_id = dup_chat_id
        AND cp.user_id NOT IN (
          SELECT user_id 
          FROM conversation_participant 
          WHERE conversation_id = first_chat_id
        );
        
      -- Optionally, you could move messages from the duplicate to the original
      -- For simplicity, we're not doing that here
      
      -- Delete the duplicate chat (cascade will remove participants, messages, etc.)
      DELETE FROM conversation WHERE conversation_id = dup_chat_id;
    END LOOP;
  END LOOP;
END;
$$; 