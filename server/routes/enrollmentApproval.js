const express = require("express");
const router = express.Router();
const pool = require("../db");
const authorize = require("../middleware/authorize");
const notificationService = require("../services/notificationService");

// Request enrollment (creates pending enrollment)
router.post("/request-enrollment", authorize, async (req, res) => {
  try {
    const { enrollment_code } = req.body;
    const student_id = req.user.id;

    // Check if user is a student
    const studentCheck = await pool.query(
      "SELECT * FROM users WHERE user_id = $1 AND role = 'student'",
      [student_id]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only students can request enrollment." });
    }

    // Get student's name for notification message
    const studentInfo = await pool.query(
      "SELECT first_name, last_name FROM users WHERE user_id = $1",
      [student_id]
    );
    const studentName = studentInfo.rows[0]
      ? `${studentInfo.rows[0].first_name} ${studentInfo.rows[0].last_name}`.trim()
      : 'A student';

    // Get course by enrollment code
    const courseResult = await pool.query(
      "SELECT * FROM course WHERE enrollment_code = $1 AND status = 'active'",
      [enrollment_code]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Invalid enrollment code or course is not active." });
    }

    const course = courseResult.rows[0];
    const professorId = course.professor_id;
    const courseId = course.course_id;
    const courseName = course.course_name;
    
    // Check if enrollment codes are enabled for this course
    if (course.enrollment_code_enabled === false) {
      return res.status(403).json({ error: "Enrollment via code is currently disabled for this course." });
    }

    // Check if the student is banned from this course
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'banned_users'
      )
    `);

    if (tableCheck.rows[0].exists) {
      const banCheck = await pool.query(
        "SELECT * FROM banned_users WHERE course_id = $1 AND user_id = $2",
        [course.course_id, student_id]
      );

      if (banCheck.rows.length > 0) {
        return res.status(403).json({ error: "You are on the blocklist for this course and cannot request enrollment." });
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

    // Check if already has pending request (only block if status is 'pending')
    const pendingCheck = await pool.query(
      "SELECT * FROM pending_enrollments WHERE student_id = $1 AND course_id = $2 AND status = 'pending'",
      [student_id, course.course_id]
    );

    if (pendingCheck.rows.length > 0) {
      return res.status(400).json({ error: "You already have a pending enrollment request for this course." });
    }

    // Clean up any old processed requests that weren't deleted
    await pool.query(
      "DELETE FROM pending_enrollments WHERE student_id = $1 AND course_id = $2 AND status IN ('approved', 'rejected')",
      [student_id, course.course_id]
    );

    // Check if course requires approval
    if (course.approval_required) {
      // Create pending enrollment
      const newPendingEnrollment = await pool.query(
        "INSERT INTO pending_enrollments (student_id, course_id) VALUES ($1, $2) RETURNING *",
        [student_id, course.course_id]
      );

      // Create a notification for the professor
      try {
        console.log(`Creating notification for professor ${professorId} about enrollment request from ${studentName}`);
        const message = `${studentName} has requested to join your course "${courseName}".`;
        const type = 'message';
        const metadata = {
          course_id: courseId,
          student_id: student_id,
          redirect_url: `/courses/${courseId}/people?tab=pending`,
          type: 'enrollment_request'
        };
        const notification = await notificationService.createNotification(professorId, type, message, metadata);
        console.log("Notification created successfully:", notification);
      } catch (notifErr) {
        console.error("Failed to create enrollment request notification:", notifErr);
        // Do not block enrollment if notification fails
      }

      res.status(201).json({
        message: "Enrollment request submitted successfully. Waiting for professor approval.",
        pending_enrollment: newPendingEnrollment.rows[0],
        course: course,
        requires_approval: true
      });
    } else {
      // Direct enrollment (existing behavior)
      const newEnrollment = await pool.query(
        "INSERT INTO enrollment (student_id, course_id) VALUES ($1, $2) RETURNING *",
        [student_id, course.course_id]
      );

      // Create a notification for the professor
      try {
        console.log(`Creating notification for professor ${professorId} about direct enrollment from ${studentName}`);
        const message = `${studentName} has enrolled in your course "${courseName}".`;
        const type = 'message';
        const metadata = {
          course_id: courseId,
          student_id: student_id,
          redirect_url: `/courses/${courseId}/people`,
          type: 'new_enrollment'
        };
        const notification = await notificationService.createNotification(professorId, type, message, metadata);
        console.log("Notification created successfully:", notification);
      } catch (notifErr) {
        console.error("Failed to create direct enrollment notification:", notifErr);
        // Do not block enrollment if notification fails
      }

      res.status(201).json({
        message: "Successfully enrolled in course",
        enrollment: newEnrollment.rows[0],
        course: course,
        requires_approval: false
      });
    }
  } catch (err) {
    console.error("Error requesting enrollment:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get pending enrollments for a course (professor only)
router.get("/pending/:courseId", authorize, async (req, res) => {
  try {
    const { courseId } = req.params;
    const professorId = req.user.id;

    // Verify the requester is the professor of this course
    const professorCheck = await pool.query(
      "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
      [courseId, professorId]
    );

    if (professorCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only the course professor can view pending enrollments." });
    }

    const pendingEnrollments = await pool.query(
      "SELECT * FROM get_pending_enrollments($1)",
      [courseId]
    );

    res.json(pendingEnrollments.rows);
  } catch (err) {
    console.error("Error fetching pending enrollments:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get student's pending enrollments
router.get("/student-pending", authorize, async (req, res) => {
  try {
    const studentId = req.user.id;

    // Check if user is a student
    const studentCheck = await pool.query(
      "SELECT * FROM users WHERE user_id = $1 AND role = 'student'",
      [studentId]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only students can view their pending enrollments." });
    }

    const pendingEnrollments = await pool.query(
      "SELECT * FROM get_student_pending_enrollments($1)",
      [studentId]
    );

    res.json(pendingEnrollments.rows);
  } catch (err) {
    console.error("Error fetching student pending enrollments:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Approve enrollment request (professor only)
router.post("/approve/:pendingId", authorize, async (req, res) => {
  try {
    const { pendingId } = req.params;
    const { review_notes } = req.body;
    const professorId = req.user.id;

    // Get pending enrollment details
    const pendingResult = await pool.query(
      `SELECT pe.*, c.professor_id, c.course_name 
       FROM pending_enrollments pe 
       JOIN course c ON pe.course_id = c.course_id 
       WHERE pe.pending_id = $1`,
      [pendingId]
    );

    if (pendingResult.rows.length === 0) {
      return res.status(404).json({ error: "Pending enrollment request not found." });
    }

    const pendingEnrollment = pendingResult.rows[0];

    // Verify the requester is the professor of this course
    if (pendingEnrollment.professor_id !== professorId) {
      return res.status(403).json({ error: "Only the course professor can approve enrollment requests." });
    }

    // Check if already processed
    if (pendingEnrollment.status !== 'pending') {
      return res.status(400).json({ error: "This enrollment request has already been processed." });
    }

    // Delete the pending enrollment record after approval
    await pool.query(
      "DELETE FROM pending_enrollments WHERE pending_id = $1",
      [pendingId]
    );

    // Add student to the enrollment table
    await pool.query(
      "INSERT INTO enrollment (student_id, course_id) VALUES ($1, $2)",
      [pendingEnrollment.student_id, pendingEnrollment.course_id]
    );

    // Get student information for course chat creation
    const studentInfo = await pool.query(
      `SELECT u.user_id, u.first_name, u.last_name, u.role, up.profile_picture_url 
       FROM users u 
       LEFT JOIN user_profile up ON u.user_id = up.user_id 
       WHERE u.user_id = $1`,
      [pendingEnrollment.student_id]
    );
    
    const studentProfile = studentInfo.rows[0];
    
    // Add the student to the course chat
    try {
      // First, check if a course chat already exists
      const chatQuery = await pool.query(
        "SELECT conversation_id FROM conversation WHERE conversation_type = 'group' AND course_id = $1 LIMIT 1",
        [pendingEnrollment.course_id]
      );
      
      if (chatQuery.rows.length > 0) {
        // Course chat exists, add student to it
        const conversationId = chatQuery.rows[0].conversation_id;
        
        // Check if student is already a participant
        const participantCheck = await pool.query(
          "SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
          [conversationId, pendingEnrollment.student_id]
        );
        
        if (participantCheck.rows.length === 0) {
          // Add student to existing chat
          await pool.query(
            "INSERT INTO conversation_participant (conversation_id, user_id) VALUES ($1, $2)",
            [conversationId, pendingEnrollment.student_id]
          );
          console.log(`Added student ${pendingEnrollment.student_id} to existing course chat ${conversationId}`);
        }
      } else {
        // No course chat exists yet, it will be created when the student accesses the messages tab
        console.log(`No existing course chat found for course ${pendingEnrollment.course_id}`);
      }
    } catch (chatErr) {
      // Log error but don't fail the enrollment process
      console.error("Error adding student to course chat:", chatErr);
    }

    // Create a notification for the student
    try {
      const studentId = pendingEnrollment.student_id;
      const courseName = pendingEnrollment.course_name;
      const courseId = pendingEnrollment.course_id;
      
      const message = `Your enrollment request for "${courseName}" has been approved.`;
      const type = 'message';
      const metadata = {
        course_id: courseId,
        redirect_url: `/courses/${courseId}/stream`,
        type: 'enrollment_approved'
      };
      await notificationService.createNotification(studentId, type, message, metadata);
    } catch (notifErr) {
      console.error("Failed to create enrollment approval notification:", notifErr);
    }

    res.status(200).json({ message: "Enrollment approved successfully." });
  } catch (err) {
    console.error("Error approving enrollment:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Reject enrollment request (professor only)
router.post("/reject/:pendingId", authorize, async (req, res) => {
  try {
    const { pendingId } = req.params;
    const { review_notes } = req.body;
    const professorId = req.user.id;

    // Get pending enrollment details
    const pendingResult = await pool.query(
      `SELECT pe.*, c.professor_id, c.course_name 
       FROM pending_enrollments pe 
       JOIN course c ON pe.course_id = c.course_id 
       WHERE pe.pending_id = $1`,
      [pendingId]
    );

    if (pendingResult.rows.length === 0) {
      return res.status(404).json({ error: "Pending enrollment request not found." });
    }

    const pendingEnrollment = pendingResult.rows[0];

    // Verify the requester is the professor of this course
    if (pendingEnrollment.professor_id !== professorId) {
      return res.status(403).json({ error: "Only the course professor can reject enrollment requests." });
    }

    // Check if already processed
    if (pendingEnrollment.status !== 'pending') {
      return res.status(400).json({ error: "This enrollment request has already been processed." });
    }

    // Delete the pending enrollment record after rejection
    await pool.query(
      "DELETE FROM pending_enrollments WHERE pending_id = $1",
      [pendingId]
    );

    // Create a notification for the student
    try {
      const studentId = pendingEnrollment.student_id;
      const courseName = pendingEnrollment.course_name;
      const courseId = pendingEnrollment.course_id;

      const message = `Your enrollment request for "${courseName}" has been rejected.`;
      const type = 'message';
      const metadata = {
        course_id: courseId,
        redirect_url: `/courses`, // Redirect to general courses page
        type: 'enrollment_rejected'
      };
      await notificationService.createNotification(studentId, type, message, metadata);
    } catch (notifErr) {
      console.error("Failed to create enrollment rejection notification:", notifErr);
    }

    res.status(200).json({ message: "Enrollment request rejected." });
  } catch (err) {
    console.error("Error rejecting enrollment:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Cancel pending enrollment request (student only)
router.delete("/cancel/:pendingId", authorize, async (req, res) => {
  try {
    const { pendingId } = req.params;
    const studentId = req.user.id;

    // Check if user is a student
    const studentCheck = await pool.query(
      "SELECT * FROM users WHERE user_id = $1 AND role = 'student'",
      [studentId]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only students can cancel their enrollment requests." });
    }

    // Get pending enrollment details
    const pendingResult = await pool.query(
      `SELECT pe.*, c.course_name 
       FROM pending_enrollments pe 
       JOIN course c ON pe.course_id = c.course_id 
       WHERE pe.pending_id = $1 AND pe.student_id = $2`,
      [pendingId, studentId]
    );

    if (pendingResult.rows.length === 0) {
      return res.status(404).json({ error: "Pending enrollment request not found." });
    }

    const pendingEnrollment = pendingResult.rows[0];

    // Check if already processed
    if (pendingEnrollment.status !== 'pending') {
      return res.status(400).json({ error: "Cannot cancel a processed enrollment request." });
    }

    // Delete pending enrollment
    await pool.query(
      "DELETE FROM pending_enrollments WHERE pending_id = $1",
      [pendingId]
    );

    res.status(200).json({
      message: "Enrollment request cancelled successfully",
      course_name: pendingEnrollment.course_name
    });
  } catch (err) {
    console.error("Error cancelling enrollment request:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Toggle approval requirement for a course (professor only)
router.put("/toggle-approval/:courseId", authorize, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { approval_required } = req.body;
    const professorId = req.user.id;

    // Verify the requester is the professor of this course
    const professorCheck = await pool.query(
      "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
      [courseId, professorId]
    );

    if (professorCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only the course professor can modify approval settings." });
    }

    // Update approval requirement
    await pool.query(
      "UPDATE course SET approval_required = $1 WHERE course_id = $2",
      [approval_required, courseId]
    );

    res.status(200).json({
      message: `Approval requirement ${approval_required ? 'enabled' : 'disabled'} successfully`,
      approval_required: approval_required
    });
  } catch (err) {
    console.error("Error toggling approval requirement:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router; 