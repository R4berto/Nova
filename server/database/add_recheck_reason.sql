-- Create a new table to store exam submission recheck reasons
CREATE TABLE IF NOT EXISTS exam_recheck_request (
    request_id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES exam_submission(submission_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add a status column to exam_submission if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exam_submission' AND column_name = 'status'
    ) THEN
        ALTER TABLE exam_submission ADD COLUMN status VARCHAR(30) DEFAULT 'in_progress' 
        CHECK (status IN ('in_progress', 'completed', 'graded', 'recheck_requested', 'rechecking', 'recheck_completed'));
    END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_exam_recheck_submission ON exam_recheck_request(submission_id);
CREATE INDEX IF NOT EXISTS idx_exam_recheck_student ON exam_recheck_request(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_recheck_status ON exam_recheck_request(status);

-- Create trigger for updated_at
CREATE TRIGGER update_exam_recheck_timestamp
    BEFORE UPDATE ON exam_recheck_request
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Add a comment to the table for documentation
COMMENT ON TABLE exam_recheck_request IS 'Stores student recheck requests for exam submissions with the reason and status.'; 