const express = require("express");
const router = express.Router();
const pool = require("../db");
const authorize = require("../middleware/authorize");

// Enroll in a course using enrollment code
router.post("/enroll", authorize, async (req, res) => {
  try {
    const { enrollment_code } = req.body;
    const student_id = req.user.id;

    // Check if user is a student
    const studentCheck = await pool.query(
      "SELECT * FROM users WHERE user_id = $1 AND role = 'student'",
      [student_id]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only students can enroll in courses." });
    }

    // Get course by enrollment code
    const courseResult = await pool.query(
      "SELECT * FROM course WHERE enrollment_code = $1 AND status = 'active'",
      [enrollment_code]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Invalid enrollment code or course is not active." });
    }

    const course = courseResult.rows[0];
    
    // Check if enrollment codes are enabled for this course
    if (course.enrollment_code_enabled === false) {
      return res.status(403).json({ error: "Enrollment via code is currently disabled for this course." });
    }

    // Check if the student is banned from this course
    // First check if banned_users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'banned_users'
      )
    `);

    if (tableCheck.rows[0].exists) {
      // Check if the student is banned
      const banCheck = await pool.query(
        "SELECT * FROM banned_users WHERE course_id = $1 AND user_id = $2",
        [course.course_id, student_id]
      );

      if (banCheck.rows.length > 0) {
        return res.status(403).json({ error: "You are on the blocklist for this course and cannot enroll." });
      }
    }

    // Check if already enrolled
    const enrollmentCheck = await pool.query(
      "SELECT * FROM enrollment WHERE student_id = $1 AND course_id = $2",
      [student_id, course.course_id]
    );

    if (enrollmentCheck.rows.length > 0) {
      return res.status(400).json({ error: "You are already enrolled in this course." });
    }

    // Create enrollment
    const newEnrollment = await pool.query(
      "INSERT INTO enrollment (student_id, course_id) VALUES ($1, $2) RETURNING *",
      [student_id, course.course_id]
    );

    res.status(201).json({
      message: "Successfully enrolled in course",
      enrollment: newEnrollment.rows[0],
      course: course
    });
  } catch (err) {
    console.error("Error enrolling in course:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get enrolled courses for a student
router.get("/student-courses", authorize, async (req, res) => {
  try {
    const student_id = req.user.id;

    // Check if user is a student
    const studentCheck = await pool.query(
      "SELECT * FROM users WHERE user_id = $1 AND role = 'student'",
      [student_id]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only students can view enrolled courses." });
    }

    const enrolledCourses = await pool.query(
      "SELECT * FROM get_student_courses($1)",
      [student_id]
    );

    res.json(enrolledCourses.rows);
  } catch (err) {
    console.error("Error fetching enrolled courses:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get professor's courses with enrollment counts
router.get("/professor-courses", authorize, async (req, res) => {
  try {
    const professor_id = req.user.id;

    // Check if user is a professor
    const professorCheck = await pool.query(
      "SELECT * FROM users WHERE user_id = $1 AND role = 'professor'",
      [professor_id]
    );

    if (professorCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only professors can view their courses." });
    }

    const courses = await pool.query(
      "SELECT * FROM get_professor_courses($1)",
      [professor_id]
    );

    res.json(courses.rows);
  } catch (err) {
    console.error("Error fetching professor courses:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all members of a course (teachers and students)
router.get("/course-members/:courseId", authorize, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Check if user has access to this course (either as professor or enrolled student)
    const accessCheck = await pool.query(
      `SELECT * FROM course WHERE course_id = $1 AND professor_id = $2
       UNION
       SELECT c.* FROM course c
       JOIN enrollment e ON c.course_id = e.course_id
       WHERE c.course_id = $1 AND e.student_id = $2`,
      [courseId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: "You don't have access to this course." });
    }

    // Get professor (teacher) for the course
    const teacherQuery = await pool.query(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, u.role, 
              p.profile_picture_url
       FROM users u
       LEFT JOIN user_profile p ON u.user_id = p.user_id
       JOIN course c ON u.user_id = c.professor_id
       WHERE c.course_id = $1`,
      [courseId]
    );

    // Get students enrolled in the course
    const studentsQuery = await pool.query(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, u.role,
              p.profile_picture_url
       FROM users u
       LEFT JOIN user_profile p ON u.user_id = p.user_id
       JOIN enrollment e ON u.user_id = e.student_id
       WHERE e.course_id = $1
       ORDER BY u.last_name, u.first_name`,
      [courseId]
    );

    // Get banned/blocklisted students for this course
    let bannedStudents = [];
    
    // First check if banned_users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'banned_users'
      )
    `);

    if (tableCheck.rows[0].exists) {
      // Only professors can see the blocklist
      const isTeacher = await pool.query(
        "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
        [courseId, userId]
      );

      if (isTeacher.rows.length > 0) {
        const bannedQuery = await pool.query(
          `SELECT u.user_id, u.first_name, u.last_name, u.email, u.role,
                  p.profile_picture_url, b.banned_at
           FROM users u
           LEFT JOIN user_profile p ON u.user_id = p.user_id
           JOIN banned_users b ON u.user_id = b.user_id
           WHERE b.course_id = $1
           ORDER BY u.last_name, u.first_name`,
          [courseId]
        );
        bannedStudents = bannedQuery.rows;
      }
    }

    res.json({
      teachers: teacherQuery.rows,
      students: studentsQuery.rows,
      banned: bannedStudents,
      studentCount: studentsQuery.rows.length
    });
  } catch (err) {
    console.error("Error fetching course members:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Remove (kick/unenroll) a student from a course
router.delete("/kick/:courseId/:studentId", authorize, async (req, res) => {
  try {
    const { courseId, studentId } = req.params;
    const professorId = req.user.id;

    // Verify the requester is the professor of this course
    const professorCheck = await pool.query(
      "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
      [courseId, professorId]
    );

    if (professorCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only the course professor can remove students." });
    }

    // Verify the student is enrolled
    const enrollmentCheck = await pool.query(
      "SELECT * FROM enrollment WHERE course_id = $1 AND student_id = $2",
      [courseId, studentId]
    );

    if (enrollmentCheck.rows.length === 0) {
      return res.status(404).json({ error: "Student is not enrolled in this course." });
    }

    // Remove the enrollment
    await pool.query(
      "DELETE FROM enrollment WHERE course_id = $1 AND student_id = $2",
      [courseId, studentId]
    );

    // Return success with no content
    res.status(204).send();
  } catch (err) {
    console.error("Error removing student from course:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Ban a student from a course
router.post("/ban/:courseId/:studentId", authorize, async (req, res) => {
  try {
    const { courseId, studentId } = req.params;
    const professorId = req.user.id;

    // Verify the requester is the professor of this course
    const professorCheck = await pool.query(
      "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
      [courseId, professorId]
    );

    if (professorCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only the course professor can add students to the blocklist." });
    }

    // First remove the student from the course (if enrolled)
    await pool.query(
      "DELETE FROM enrollment WHERE course_id = $1 AND student_id = $2",
      [courseId, studentId]
    );

    // Check if banned_users table exists, create if not
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'banned_users'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      // Create banned_users table if it doesn't exist
      await pool.query(`
        CREATE TABLE banned_users (
          ban_id SERIAL PRIMARY KEY,
          course_id INTEGER NOT NULL,
          user_id UUID NOT NULL,
          banned_by UUID NOT NULL,
          banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (course_id) REFERENCES course(course_id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
          FOREIGN KEY (banned_by) REFERENCES users(user_id) ON DELETE CASCADE,
          UNIQUE(course_id, user_id)
        )
      `);
    }

    // Add user to banned_users table
    await pool.query(
      "INSERT INTO banned_users (course_id, user_id, banned_by) VALUES ($1, $2, $3) ON CONFLICT (course_id, user_id) DO NOTHING",
      [courseId, studentId, professorId]
    );

    // Return success with no content
    res.status(204).send();
  } catch (err) {
    console.error("Error adding student to course blocklist:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Remove a student from the blocklist (unban)
router.post("/unban/:courseId/:studentId", authorize, async (req, res) => {
  try {
    const { courseId, studentId } = req.params;
    const professorId = req.user.id;

    // Verify the requester is the professor of this course
    const professorCheck = await pool.query(
      "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
      [courseId, professorId]
    );

    if (professorCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only the course professor can remove students from the blocklist." });
    }

    // Check if banned_users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'banned_users'
      )
    `);

    if (tableCheck.rows[0].exists) {
      // Remove user from banned_users table
      await pool.query(
        "DELETE FROM banned_users WHERE course_id = $1 AND user_id = $2",
        [courseId, studentId]
      );
    }

    // Return success with no content
    res.status(204).send();
  } catch (err) {
    console.error("Error removing student from blocklist:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Allow a student to unenroll themselves from a course
router.delete("/unenroll/:courseId", authorize, async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user.id;

    // Check if user is a student
    const studentCheck = await pool.query(
      "SELECT * FROM users WHERE user_id = $1 AND role = 'student'",
      [studentId]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only students can unenroll from courses." });
    }

    // Check if student is enrolled in this course
    const enrollmentCheck = await pool.query(
      "SELECT * FROM enrollment WHERE course_id = $1 AND student_id = $2",
      [courseId, studentId]
    );

    if (enrollmentCheck.rows.length === 0) {
      return res.status(404).json({ error: "You are not enrolled in this course." });
    }

    // Get course details for confirmation
    const courseDetails = await pool.query(
      "SELECT course_name FROM course WHERE course_id = $1",
      [courseId]
    );

    // Remove the enrollment
    await pool.query(
      "DELETE FROM enrollment WHERE course_id = $1 AND student_id = $2",
      [courseId, studentId]
    );

    const courseName = courseDetails.rows[0]?.course_name || "the course";
    
    // Return success message
    res.status(200).json({ 
      message: `Successfully unenrolled from ${courseName}` 
    });
  } catch (err) {
    console.error("Error unenrolling from course:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router; 