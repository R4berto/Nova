-- Create grade_change_log table to track changes to exam grades
CREATE TABLE IF NOT EXISTS grade_change_log (
    log_id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES exam_submission(submission_id) ON DELETE CASCADE,
    professor_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    previous_score NUMERIC,
    new_score NUMERIC NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_grade_change_log_submission ON grade_change_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_grade_change_log_professor ON grade_change_log(professor_id);
CREATE INDEX IF NOT EXISTS idx_grade_change_log_timestamp ON grade_change_log(changed_at);

-- Add a status column to exam_submission for tracking recheck requests
ALTER TABLE exam_submission ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'graded' CHECK (status IN ('graded', 'recheck_requested', 'rechecking', 'recheck_completed')); 