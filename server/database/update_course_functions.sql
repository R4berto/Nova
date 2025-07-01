-- Update course functions to include approval_required and enrollment_code_enabled fields

-- Update get_professor_courses function
CREATE OR REPLACE FUNCTION get_professor_courses(professor_uuid UUID)
RETURNS TABLE (
    course_id INTEGER,
    course_name VARCHAR(255),
    description TEXT,
    professor_id UUID,
    enrollment_code VARCHAR(7),
    semester VARCHAR(20),
    academic_year VARCHAR(9),
    status VARCHAR(10),
    section VARCHAR(10),
    created_at TIMESTAMP,
    enrollment_count BIGINT,
    approval_required BOOLEAN,
    enrollment_code_enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.course_id, c.course_name, c.description, c.professor_id, 
           c.enrollment_code, c.semester, c.academic_year, c.status, c.section, c.created_at,
           COUNT(e.enrollment_id) as enrollment_count,
           COALESCE(c.approval_required, FALSE) as approval_required,
           COALESCE(c.enrollment_code_enabled, TRUE) as enrollment_code_enabled
    FROM course c
    LEFT JOIN enrollment e ON c.course_id = e.course_id
    WHERE c.professor_id = professor_uuid
    GROUP BY c.course_id, c.course_name, c.description, c.professor_id, 
             c.enrollment_code, c.semester, c.academic_year, c.status, c.section, c.created_at,
             c.approval_required, c.enrollment_code_enabled
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Update get_student_courses function
CREATE OR REPLACE FUNCTION get_student_courses(student_uuid UUID)
RETURNS TABLE (
    course_id INTEGER,
    course_name VARCHAR(255),
    description TEXT,
    professor_id UUID,
    enrollment_code VARCHAR(7),
    semester VARCHAR(20),
    academic_year VARCHAR(9),
    status VARCHAR(10),
    section VARCHAR(10),
    created_at TIMESTAMP,
    approval_required BOOLEAN,
    enrollment_code_enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.course_id, c.course_name, c.description, c.professor_id, 
           c.enrollment_code, c.semester, c.academic_year, c.status, c.section, c.created_at,
           COALESCE(c.approval_required, FALSE) as approval_required,
           COALESCE(c.enrollment_code_enabled, TRUE) as enrollment_code_enabled
    FROM course c
    JOIN enrollment e ON c.course_id = e.course_id
    WHERE e.student_id = student_uuid
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql; 