-- Create enrollment approval system
-- This adds approval functionality without affecting existing enrollment system

-- Create pending_enrollments table for approval workflow
CREATE TABLE IF NOT EXISTS pending_enrollments (
    pending_id SERIAL PRIMARY KEY,
    student_id UUID NOT NULL,
    course_id INTEGER NOT NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES course(course_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    UNIQUE(student_id, course_id)
);

-- Add approval_required column to course table
ALTER TABLE course ADD COLUMN IF NOT EXISTS approval_required BOOLEAN DEFAULT FALSE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pending_enrollments_student ON pending_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_pending_enrollments_course ON pending_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_pending_enrollments_status ON pending_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_pending_enrollments_professor ON pending_enrollments(course_id, reviewed_by);

-- Create function to get pending enrollments for a course
CREATE OR REPLACE FUNCTION get_pending_enrollments(course_uuid INTEGER)
RETURNS TABLE (
    pending_id INTEGER,
    student_id UUID,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    requested_at TIMESTAMP,
    status VARCHAR(20),
    reviewed_by UUID,
    reviewed_at TIMESTAMP,
    review_notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pe.pending_id,
        pe.student_id,
        u.first_name,
        u.last_name,
        u.email,
        pe.requested_at,
        pe.status,
        pe.reviewed_by,
        pe.reviewed_at,
        pe.review_notes
    FROM pending_enrollments pe
    JOIN users u ON pe.student_id = u.user_id
    WHERE pe.course_id = course_uuid
      AND pe.status = 'pending'
    ORDER BY pe.requested_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get student's pending enrollments
CREATE OR REPLACE FUNCTION get_student_pending_enrollments(student_uuid UUID)
RETURNS TABLE (
    pending_id INTEGER,
    course_id INTEGER,
    course_name VARCHAR(255),
    professor_id UUID,
    professor_name VARCHAR(255),
    requested_at TIMESTAMP,
    status VARCHAR(20),
    reviewed_at TIMESTAMP,
    review_notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pe.pending_id,
        pe.course_id,
        c.course_name,
        c.professor_id,
        CONCAT(u.first_name, ' ', u.last_name)::VARCHAR(255) as professor_name,
        pe.requested_at,
        pe.status,
        pe.reviewed_at,
        pe.review_notes
    FROM pending_enrollments pe
    JOIN course c ON pe.course_id = c.course_id
    JOIN users u ON c.professor_id = u.user_id
    WHERE pe.student_id = student_uuid AND pe.status = 'pending'
    ORDER BY pe.requested_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update reviewed_at timestamp
CREATE OR REPLACE FUNCTION update_pending_enrollment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status != OLD.status AND NEW.status IN ('approved', 'rejected') THEN
        NEW.reviewed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pending_enrollment_reviewed_at
    BEFORE UPDATE ON pending_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION update_pending_enrollment_timestamp(); 