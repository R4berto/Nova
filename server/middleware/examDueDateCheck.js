const pool = require("../db");
const { isExamPastDue } = require("../utils/examUtils");

/**
 * Middleware to check if an exam is past its due date
 * This middleware should be used on student exam routes to prevent access to overdue exams
 */
const checkExamDueDate = async (req, res, next) => {
  try {
    // Only apply this check for student users
    if (req.user.role === 'professor') {
      return next();
    }

    // Extract exam ID from different possible parameter names
    const examId = req.params.examId || req.params.exam_id;
    
    if (!examId) {
      // If no exam ID is found, let the route handle it
      return next();
    }

    // Get exam details including due date
    const examResult = await pool.query(
      "SELECT exam_id, due_date, is_published FROM exam WHERE exam_id = $1",
      [examId]
    );

    if (examResult.rows.length === 0) {
      // Exam not found, let the route handle it
      return next();
    }

    const exam = examResult.rows[0];

    // Check if exam is published (students can only access published exams)
    if (!exam.is_published) {
      return res.status(403).json({ 
        error: "This exam is not available yet." 
      });
    }

    // Check if exam is past due date
    if (isExamPastDue(exam)) {
      return res.status(403).json({ 
        error: "This exam is past its due date and can no longer be accessed.",
        due_date: exam.due_date,
        exam_id: exam.exam_id
      });
    }

    // Add exam info to request for use in the route handler
    req.examInfo = exam;
    next();
  } catch (error) {
    console.error("Due date check middleware error:", error);
    // Don't block the request if there's an error in the middleware
    // Let the route handler deal with it
    next();
  }
};

/**
 * Middleware specifically for submission-based routes
 * Checks due date based on submission ID
 */
const checkSubmissionDueDate = async (req, res, next) => {
  try {
    // Only apply this check for student users
    if (req.user.role === 'professor') {
      return next();
    }

    const submissionId = req.params.submissionId;
    
    if (!submissionId) {
      return next();
    }

    // Get exam details through the submission
    const result = await pool.query(
      `SELECT e.exam_id, e.due_date, e.is_published, s.submitted_at
       FROM exam_submission s
       JOIN exam e ON s.exam_id = e.exam_id
       WHERE s.submission_id = $1 AND s.student_id = $2`,
      [submissionId, req.user.id]
    );

    if (result.rows.length === 0) {
      // Let the route handle missing submission
      return next();
    }

    const exam = result.rows[0];

    // Allow access if already submitted (for viewing results)
    if (exam.submitted_at) {
      return next();
    }

    // Check if exam is past due date for active submissions
    if (isExamPastDue(exam)) {
      return res.status(403).json({ 
        error: "This exam is past its due date and can no longer be accessed.",
        due_date: exam.due_date,
        exam_id: exam.exam_id
      });
    }

    req.examInfo = exam;
    next();
  } catch (error) {
    console.error("Submission due date check middleware error:", error);
    next();
  }
};

module.exports = {
  checkExamDueDate,
  checkSubmissionDueDate
}; 