-- Create assignments table
CREATE TABLE IF NOT EXISTS assignment (
    assignment_id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES course(course_id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    points INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create assignment_attachment table
CREATE TABLE IF NOT EXISTS assignment_attachment (
    attachment_id SERIAL PRIMARY KEY,
    assignment_id INTEGER NOT NULL REFERENCES assignment(assignment_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create assignment_submission table
CREATE TABLE IF NOT EXISTS assignment_submission (
    submission_id SERIAL PRIMARY KEY,
    assignment_id INTEGER NOT NULL REFERENCES assignment(assignment_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    grade VARCHAR(50),
    feedback TEXT,
    returned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assignment_id, student_id)
);

-- Create submission_attachment table
CREATE TABLE IF NOT EXISTS submission_attachment (
    attachment_id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES assignment_submission(submission_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_assignment_course ON assignment(course_id);
CREATE INDEX IF NOT EXISTS idx_assignment_author ON assignment(author_id);
CREATE INDEX IF NOT EXISTS idx_assignment_due_date ON assignment(due_date);
CREATE INDEX IF NOT EXISTS idx_assignment_attachment_assignment ON assignment_attachment(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submission_assignment ON assignment_submission(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submission_student ON assignment_submission(student_id);
CREATE INDEX IF NOT EXISTS idx_submission_attachment_submission ON submission_attachment(submission_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_assignment_timestamp
    BEFORE UPDATE ON assignment
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_submission_timestamp
    BEFORE UPDATE ON assignment_submission
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Add returned column to assignment_submission
ALTER TABLE assignment_submission ADD COLUMN IF NOT EXISTS returned BOOLEAN DEFAULT FALSE; 