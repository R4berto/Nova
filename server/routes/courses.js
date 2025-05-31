const express = require("express");
const router = express.Router();
const pool = require("../db");
const checkAuth = require("../middleware/authorize"); 



// Create a Course (Only for Professors)
router.post("/", checkAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { course_name, description, semester, academic_year, status, section } = req.body;
    const professor_id = req.user.id; 

    // Check if user is a professor
    const professorCheck = await client.query(
      "SELECT * FROM users WHERE user_id = $1 AND role = 'professor'",
      [professor_id]
    );

    if (professorCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied: Only professors can create courses." });
    }

    // Start transaction
    await client.query('BEGIN');

    // Insert new course
    const newCourse = await client.query(
      `INSERT INTO course (course_name, description, professor_id, semester, academic_year, status, section)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [course_name, description, professor_id, semester, academic_year, status, section]
    );

    const courseId = newCourse.rows[0].course_id;

    // Create course chat automatically
    const chatName = `${course_name} Chat`;
    
    // Create the conversation
    const conversationResult = await client.query(
      `INSERT INTO conversation (name, conversation_type, course_id, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [chatName, 'group', courseId]
    );
    
    const conversationId = conversationResult.rows[0].conversation_id;
    
    // Add the professor as a participant
    await client.query(
      `INSERT INTO conversation_participant (conversation_id, user_id, joined_at)
       VALUES ($1, $2, NOW())`,
      [conversationId, professor_id]
    );

    // Add welcome message
    const welcomeMessage = `Welcome to the ${course_name} chat! This space is for course-related discussions.`;
    await client.query(
      `INSERT INTO message (conversation_id, sender_id, content, sent_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [conversationId, professor_id, welcomeMessage]
    );

    // Commit transaction
    await client.query('COMMIT');

    // Return both course and chat info
    res.status(201).json({
      course: newCourse.rows[0],
      chat: {
        conversation_id: conversationId,
        name: chatName
      }
    });
  } catch (err) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error("Error creating course:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// Get Courses Created by a Professor
router.get("/professor", checkAuth, async (req, res) => {
  try {
    const professor_id = req.user.id;

    // Using the stored function for professor courses
    const courses = await pool.query(
      "SELECT * FROM get_professor_courses($1)",
      [professor_id]
    );

    res.json(courses.rows);
  } catch (err) {
    console.error("Error fetching courses:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get Courses Enrolled by a Student
router.get("/student", checkAuth, async (req, res) => {
  try {
    const student_id = req.user.id;

    // Using the stored function for student courses
    const courses = await pool.query(
      "SELECT * FROM get_student_courses($1)",
      [student_id]
    );

    res.json(courses.rows);
  } catch (err) {
    console.error("Error fetching courses:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update a Course (Professors Only)
router.put("/:id", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { course_name, description, semester, academic_year, section } = req.body;
    const professor_id = req.user.id;

    // Ensure the course belongs to this professor
    const courseCheck = await pool.query(
      "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
      [id, professor_id]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(403).json({ error: "Unauthorized: You can only edit your own courses." });
    }

    // Get current course status
    const currentStatus = courseCheck.rows[0].status;

    // Update course
    const updatedCourse = await pool.query(
      `UPDATE course 
       SET course_name = $1, 
           description = $2, 
           semester = $3, 
           academic_year = $4, 
           section = $5,
           status = $6
       WHERE course_id = $7 AND professor_id = $8
       RETURNING *`,
      [course_name, description, semester, academic_year, section, currentStatus, id, professor_id]
    );

    res.json(updatedCourse.rows[0]);
  } catch (err) {
    console.error("Error updating course:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Inactivate a course
router.put("/:id/inactivate", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;

    if (role !== "professor") {
      return res.status(403).json({ error: "Only professors can inactivate courses" });
    }

    const course = await pool.query(
      "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
      [id, req.user.id]
    );

    if (course.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    if (course.rows[0].status !== "active") {
      return res.status(400).json({ error: "Only active courses can be inactivated" });
    }

    const updatedCourse = await pool.query(
      "UPDATE course SET status = 'inactive' WHERE course_id = $1 RETURNING *", 
      [id]
    );

    res.json({ updatedCourse: updatedCourse.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Reactivate a course
router.put("/:id/reactivate", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;

    if (role !== "professor") {
      return res.status(403).json({ error: "Only professors can reactivate courses" });
    }

    const course = await pool.query(
      "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
      [id, req.user.id]
    );

    if (course.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    if (course.rows[0].status !== "inactive") {
      return res.status(400).json({ error: "Only inactive courses can be reactivated" });
    }

    const updatedCourse = await pool.query(
      "UPDATE course SET status = 'active' WHERE course_id = $1 RETURNING *",
      [id]
    );

    res.json({ updatedCourse: updatedCourse.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Archive a course
router.put("/:id/archive", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;

    if (role !== "professor") {
      return res.status(403).json({ error: "Only professors can archive courses" });
    }

    const course = await pool.query(
      "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
      [id, req.user.id]
    );

    if (course.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    if (course.rows[0].status !== "inactive") {
      return res.status(400).json({ error: "Course must be inactive before it can be archived" });
    }

    const updatedCourse = await pool.query(
      "UPDATE course SET status = 'archived' WHERE course_id = $1 RETURNING *", 
      [id]
    );

    res.json({ updatedCourse: updatedCourse.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a Course (Professors Only)
router.delete("/:id", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const professor_id = req.user.id;

    // Ensure the professor owns this course
    const courseCheck = await pool.query(
      "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
      [id, professor_id]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(403).json({ error: "Unauthorized: You can only delete your own courses." });
    }

    // Delete course
    await pool.query("DELETE FROM course WHERE course_id = $1", [id]);

    res.json({ message: "Course deleted successfully" });
  } catch (err) {
    console.error("Error deleting course:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Toggle enrollment code status (enable/disable)
router.put("/:id/enrollment-code/status", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const professorId = req.user.id;

    // Check if user is a professor
    const professorCheck = await pool.query(
      "SELECT * FROM users WHERE user_id = $1 AND role = 'professor'",
      [professorId]
    );

    if (professorCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only professors can manage enrollment codes" });
    }

    // Check if course belongs to this professor
    const courseCheck = await pool.query(
      "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
      [id, professorId]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(403).json({ error: "You can only manage enrollment codes for your own courses" });
    }

    // Update enrollment code status
    const updatedCourse = await pool.query(
      "UPDATE course SET enrollment_code_enabled = $1 WHERE course_id = $2 RETURNING *",
      [enabled, id]
    );

    res.json(updatedCourse.rows[0]);
  } catch (err) {
    console.error("Error toggling enrollment code status:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Regenerate enrollment code
router.post("/:id/enrollment-code/regenerate", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const professorId = req.user.id;

    // Check if user is a professor
    const professorCheck = await pool.query(
      "SELECT * FROM users WHERE user_id = $1 AND role = 'professor'",
      [professorId]
    );

    if (professorCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only professors can regenerate enrollment codes" });
    }

    // Check if course belongs to this professor
    const courseCheck = await pool.query(
      "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
      [id, professorId]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(403).json({ error: "You can only regenerate enrollment codes for your own courses" });
    }

    // Generate a random 6-character enrollment code
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Update the course with the new enrollment code
    const updatedCourse = await pool.query(
      "UPDATE course SET enrollment_code = $1 WHERE course_id = $2 RETURNING *",
      [newCode, id]
    );

    res.json({ 
      enrollment_code: updatedCourse.rows[0].enrollment_code,
      message: "Enrollment code regenerated successfully" 
    });
  } catch (err) {
    console.error("Error regenerating enrollment code:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get a course by ID
router.get("/:id", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // First try to get the course details if user is the professor
    let courseQuery = await pool.query(
      "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
      [id, userId]
    );

    // If user is not the professor, check if they're enrolled
    if (courseQuery.rows.length === 0) {
      const enrollmentCheck = await pool.query(
        `SELECT c.* FROM course c
         JOIN enrollment e ON c.course_id = e.course_id
         WHERE c.course_id = $1 AND e.student_id = $2`,
        [id, userId]
      );

      if (enrollmentCheck.rows.length > 0) {
        courseQuery = enrollmentCheck;
      }
    }

    // Return the course if found
    if (courseQuery.rows.length > 0) {
      res.json(courseQuery.rows[0]);
    } else {
      res.status(404).json({ error: "Course not found or you don't have access to it" });
    }
  } catch (err) {
    console.error("Error fetching course details:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
