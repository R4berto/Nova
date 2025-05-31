-- Create or replace the update_timestamp function (safe to run multiple times)
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create exam table
CREATE TABLE IF NOT EXISTS exam (
    exam_id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES course(course_id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create exam_question table
CREATE TABLE IF NOT EXISTS exam_question (
    question_id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES exam(exam_id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('mcq', 'identification')),
    question_text TEXT NOT NULL,
    options TEXT[], -- Only used for MCQ, NULL for identification
    correct_answer TEXT NOT NULL,
    points INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exam_course ON exam(course_id);
CREATE INDEX IF NOT EXISTS idx_exam_author ON exam(author_id);
CREATE INDEX IF NOT EXISTS idx_exam_question_exam ON exam_question(exam_id);

-- Triggers for updated_at
CREATE TRIGGER update_exam_timestamp
    BEFORE UPDATE ON exam
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_exam_question_timestamp
    BEFORE UPDATE ON exam_question
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp(); 