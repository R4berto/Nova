-- Add unread_status to conversation_participant to track unread status per user
-- This is more efficient than counting unread messages each time

-- Check if the column exists before adding it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'conversation_participant' 
        AND column_name = 'has_unread'
    ) THEN
        ALTER TABLE conversation_participant 
        ADD COLUMN has_unread BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_conversation_participant_unread 
ON conversation_participant(user_id, has_unread);

-- Create function to update unread status for conversation participants
CREATE OR REPLACE FUNCTION update_conversation_unread_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark conversation as unread for all participants except sender
    UPDATE conversation_participant
    SET has_unread = TRUE
    WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update unread status when a new message is inserted
DROP TRIGGER IF EXISTS update_conversation_unread_status ON message;
CREATE TRIGGER update_conversation_unread_status
    AFTER INSERT ON message
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_unread_status();

-- Add stored procedure to mark conversation as read
CREATE OR REPLACE PROCEDURE mark_conversation_as_read(
    p_conversation_id INTEGER,
    p_user_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update the conversation_participant record to mark as read
    UPDATE conversation_participant
    SET has_unread = FALSE
    WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id;
    
    -- Also mark all messages as read
    UPDATE message_read_status
    SET read_at = NOW()
    WHERE message_id IN (
        SELECT m.message_id
        FROM message m
        JOIN message_read_status mrs ON m.message_id = mrs.message_id
        WHERE m.conversation_id = p_conversation_id 
        AND mrs.user_id = p_user_id 
        AND mrs.read_at IS NULL
    );
END;
$$; 