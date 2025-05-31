-- Create student_activity table to track student engagement for the DSS
CREATE TABLE IF NOT EXISTS student_activity (
    activity_id SERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES course(course_id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_student_activity_course ON student_activity(course_id);
CREATE INDEX IF NOT EXISTS idx_student_activity_student ON student_activity(student_id);
CREATE INDEX IF NOT EXISTS idx_student_activity_type ON student_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_student_activity_created ON student_activity(created_at);

-- Add comments for documentation
COMMENT ON TABLE student_activity IS 'Tracks student engagement and activity in courses';
COMMENT ON COLUMN student_activity.activity_type IS 'Types include: login, exam_start, exam_submission, assignment_view, assignment_submission, resource_access, discussion_post, message_sent';

-- Insert sample activity data (optional)
-- Uncomment this section if you want to add sample data

/*
-- Sample data from exam submissions
INSERT INTO student_activity (student_id, course_id, activity_type, details, created_at)
SELECT 
    student_id,
    e.course_id,
    'exam_start',
    jsonb_build_object('exam_id', e.exam_id),
    es.started_at
FROM exam_submission es
JOIN exam e ON es.exam_id = e.exam_id
WHERE es.started_at IS NOT NULL
LIMIT 10;

-- Sample data for exam submissions
INSERT INTO student_activity (student_id, course_id, activity_type, details, created_at)
SELECT 
    student_id,
    e.course_id,
    'exam_submission',
    jsonb_build_object(
        'exam_id', e.exam_id,
        'submission_id', es.submission_id,
        'score', es.score,
        'total_points', es.total_points
    ),
    es.submitted_at
FROM exam_submission es
JOIN exam e ON es.exam_id = e.exam_id
WHERE es.submitted_at IS NOT NULL
LIMIT 10;
*/

-- To run this file:
-- psql -U your_username -d your_database_name -f create_student_activity_table.sql 