-- Add due_date column to exam table
-- This migration adds due date functionality to exams

-- Add due_date column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exam' AND column_name = 'due_date'
    ) THEN
        ALTER TABLE exam ADD COLUMN due_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create index for due_date queries
CREATE INDEX IF NOT EXISTS idx_exam_due_date ON exam(due_date);

-- Add comment to the column
COMMENT ON COLUMN exam.due_date IS 'Due date for the exam. After this date, students cannot access or submit the exam.'; 