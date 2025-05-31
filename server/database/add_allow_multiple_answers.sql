-- Add allow_multiple_answers field to exam_question table
-- This field explicitly tracks whether a question allows multiple correct answers
-- instead of trying to infer it from the correct_answer format

ALTER TABLE exam_question 
ADD COLUMN IF NOT EXISTS allow_multiple_answers BOOLEAN DEFAULT FALSE;

-- Update existing records based on correct_answer format
-- If correct_answer looks like JSON array or comma-separated values, set to true
UPDATE exam_question 
SET allow_multiple_answers = TRUE
WHERE 
    -- Check if correct_answer starts with '[' (JSON array)
    correct_answer LIKE '[%'
    OR 
    -- Check if correct_answer contains quoted comma-separated values
    (correct_answer LIKE '%"%' AND correct_answer LIKE '%,%')
    OR
    -- Check if it's a PostgreSQL array format
    correct_answer LIKE '{%}';

-- Add a comment to the column for documentation
COMMENT ON COLUMN exam_question.allow_multiple_answers IS 'Indicates whether this question allows multiple correct answers. When true, correct_answer should be stored as JSON array or comma-separated values.'; 