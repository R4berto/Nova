-- Create exam_submission table to track student exam submissions
CREATE TABLE IF NOT EXISTS exam_submission (
    submission_id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES exam(exam_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP WITH TIME ZONE,
    score NUMERIC, -- Will be calculated after grading
    total_points NUMERIC, -- Total possible points
    is_graded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(exam_id, student_id)
);

-- Create student_answer table to store individual question answers
CREATE TABLE IF NOT EXISTS student_answer (
    answer_id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES exam_submission(submission_id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES exam_question(question_id) ON DELETE CASCADE,
    student_answer TEXT NOT NULL,
    is_correct BOOLEAN,
    points_earned NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(submission_id, question_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_exam_submission_exam ON exam_submission(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_submission_student ON exam_submission(student_id);
CREATE INDEX IF NOT EXISTS idx_student_answer_submission ON student_answer(submission_id);
CREATE INDEX IF NOT EXISTS idx_student_answer_question ON student_answer(question_id);

-- Triggers for updated_at
CREATE TRIGGER update_exam_submission_timestamp
    BEFORE UPDATE ON exam_submission
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_student_answer_timestamp
    BEFORE UPDATE ON student_answer
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp(); 