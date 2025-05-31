CREATE DATABASE nova;


CREATE TABLE course (
    course_id SERIAL PRIMARY KEY,
    course_name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    professor_id UUID NOT NULL,
    enrollment_code VARCHAR(7) UNIQUE NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (professor_id) REFERENCES users(user_id) ON DELETE CASCADE
);
--atlter 
ALTER TABLE course ADD COLUMN IF NOT EXISTS enrollment_code_enabled BOOLEAN DEFAULT TRUE;

CREATE TABLE auth_credentials (
    auth_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) CHECK (role IN ('student', 'professor')) NOT NULL,
    user_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE OR REPLACE FUNCTION set_enrollment_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Set the enrollment_code only if it's empty
    IF NEW.enrollment_code = '' THEN
        NEW.enrollment_code := generate_enrollment_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--------------------------------------------------------
CREATE TRIGGER trigger_generate_enrollment_code
BEFORE INSERT ON course
FOR EACH ROW 
EXECUTE FUNCTION set_enrollment_code(); 
---- updated ----
CREATE OR REPLACE FUNCTION generate_enrollment_code()
RETURNS TEXT AS $$
DECLARE
    short_code TEXT;
BEGIN
    LOOP
        -- Generate a random 7-character alphanumeric code
        short_code := LEFT(md5(random()::text), 7);

        -- Ensure uniqueness by checking the 'course' table
        EXIT WHEN NOT EXISTS (SELECT 1 FROM course WHERE enrollment_code = short_code);
    END LOOP;

    RETURN short_code;
END;
$$ LANGUAGE plpgsql;
--Update table courses--
ALTER TABLE course
ADD COLUMN semester VARCHAR(20) CHECK (semester IN ('1st semester', '2nd semester', 'summer')) NOT NULL;

ALTER TABLE course
ADD COLUMN academic_year VARCHAR(9) NOT NULL;
ALTER TABLE course
ADD COLUMN status VARCHAR(10) CHECK (status IN ('active', 'inactive', 'archived')) DEFAULT 'active' NOT NULL;

ALTER TABLE course
ALTER COLUMN description SET NOT NULL;

-- Add section column to course table
ALTER TABLE course
ADD COLUMN section VARCHAR(10) DEFAULT '001' NULL;

-- Create user_profile table to store additional profile information
CREATE TABLE IF NOT EXISTS user_profile (
    profile_id SERIAL PRIMARY KEY,
    user_id UUID UNIQUE NOT NULL,
    profile_picture_url VARCHAR(255),
    last_login TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create index for faster profile lookups
CREATE INDEX IF NOT EXISTS idx_user_profile ON user_profile(user_id);

-- Create a function to update the timestamp when profile is modified
CREATE OR REPLACE FUNCTION update_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the timestamp
DROP TRIGGER IF EXISTS update_profile_timestamp ON user_profile;
CREATE TRIGGER update_profile_timestamp
BEFORE UPDATE ON user_profile
FOR EACH ROW
EXECUTE FUNCTION update_profile_timestamp();

-- Create enrollment table
CREATE TABLE enrollment (
    enrollment_id SERIAL PRIMARY KEY,
    student_id UUID NOT NULL,
    course_id INTEGER NOT NULL,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES course(course_id) ON DELETE CASCADE,
    UNIQUE(student_id, course_id)
);

-- Add index for faster enrollment lookups
CREATE INDEX idx_enrollment_student ON enrollment(student_id);
CREATE INDEX idx_enrollment_course ON enrollment(course_id);

-- Modify the student courses query to use enrollment table
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
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.course_id, c.course_name, c.description, c.professor_id, 
           c.enrollment_code, c.semester, c.academic_year, c.status, c.section, c.created_at
    FROM course c
    JOIN enrollment e ON c.course_id = e.course_id
    WHERE e.student_id = student_uuid
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Modify the professor courses query to include enrollment count
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
    enrollment_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.course_id, c.course_name, c.description, c.professor_id, 
           c.enrollment_code, c.semester, c.academic_year, c.status, c.section, c.created_at,
           COUNT(e.enrollment_id) as enrollment_count
    FROM course c
    LEFT JOIN enrollment e ON c.course_id = e.course_id
    WHERE c.professor_id = professor_uuid
    GROUP BY c.course_id, c.course_name, c.description, c.professor_id, 
             c.enrollment_code, c.semester, c.academic_year, c.status, c.section, c.created_at
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create announcement table for course streams
CREATE TABLE announcement (
    announcement_id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL,
    author_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES course(course_id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Add title column to announcement table
ALTER TABLE announcement
ADD COLUMN title VARCHAR(255);

-- Create announcement attachments table
CREATE TABLE announcement_attachment (
    attachment_id SERIAL PRIMARY KEY,
    announcement_id INTEGER NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    file_type VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcement(announcement_id) ON DELETE CASCADE
);

-- Create index for faster attachment lookups
CREATE INDEX idx_announcement_attachment ON announcement_attachment(announcement_id);

-- Create course materials/classwork table
CREATE TABLE course_material (
    material_id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL,
    author_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('assignment', 'material', 'question')),
    due_date TIMESTAMP,
    points INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES course(course_id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX idx_announcement_course ON announcement(course_id);
CREATE INDEX idx_material_course ON course_material(course_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_announcement_timestamp
    BEFORE UPDATE ON announcement
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_material_timestamp
    BEFORE UPDATE ON course_material
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();