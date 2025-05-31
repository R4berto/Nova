-- Add correct_answer_indices field to exam_question table
-- This field stores the indices of correct answers for multiple choice questions
-- This helps with proper rendering of checkboxes/radio buttons in the UI

ALTER TABLE exam_question 
ADD COLUMN IF NOT EXISTS correct_answer_indices INTEGER[] DEFAULT NULL;

-- Update existing records based on options and correct_answer
-- For multiple choice questions with multiple correct answers, populate the indices
UPDATE exam_question 
SET correct_answer_indices = (
    SELECT array_agg(
        array_position(options, ca) - 1 -- Convert to 0-based index
    )
    FROM unnest(
        CASE 
            WHEN correct_answer LIKE '[%]' THEN 
                -- Parse JSON array to array of text
                (SELECT array_agg(TRIM(BOTH '"' FROM ca))
                 FROM json_array_elements_text(correct_answer::json) AS ca)
            WHEN correct_answer LIKE '{%}' THEN 
                -- Convert PostgreSQL array to array
                (SELECT string_to_array(REPLACE(REPLACE(correct_answer, '{', ''), '}', ''), ','))
            WHEN correct_answer LIKE '%,%' THEN
                -- Split comma-separated string
                (SELECT string_to_array(correct_answer, ','))
            ELSE 
                -- Single value in an array
                ARRAY[correct_answer]
        END
    ) AS ca
    WHERE array_position(options, ca) IS NOT NULL
)
WHERE type = 'mcq' AND allow_multiple_answers = TRUE;

-- For multiple choice questions with a single correct answer, store the index
UPDATE exam_question 
SET correct_answer_indices = ARRAY[array_position(options, correct_answer) - 1] -- Convert to 0-based index
WHERE type = 'mcq' AND allow_multiple_answers = FALSE
AND array_position(options, correct_answer) IS NOT NULL;

-- Add a comment to the column for documentation
COMMENT ON COLUMN exam_question.correct_answer_indices IS 'Stores the 0-based indices of correct answers for multiple choice questions. For single-answer questions, contains a single value. For multiple-answer questions, contains multiple indices.'; 