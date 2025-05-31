-- Create student_activity table to track student engagement
CREATE TABLE IF NOT EXISTS student_activity (
    activity_id SERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES course(course_id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_student_activity_course ON student_activity(course_id);
CREATE INDEX IF NOT EXISTS idx_student_activity_student ON student_activity(student_id);
CREATE INDEX IF NOT EXISTS idx_student_activity_type ON student_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_student_activity_created ON student_activity(created_at);

-- Create some basic activity types
COMMENT ON TABLE student_activity IS 'Tracks student engagement and activity in courses';
COMMENT ON COLUMN student_activity.activity_type IS 'Types include: login, exam_start, exam_submission, assignment_view, assignment_submission, resource_access, discussion_post, message_sent'; 