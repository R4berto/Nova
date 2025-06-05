const express = require("express");
const router = express.Router();
const pool = require("../db");
const authorize = require("../middleware/authorize");
const { gradeAnswer, parsePostgresArray } = require("../utils/examGrading");
const { isExamPastDue } = require("../utils/examUtils");
const notificationService = require("../services/notificationService");
const activityService = require("../services/activityService");

// Get available exams for a student
router.get("/available/:courseId", authorize, async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user.id;

    // Check if student is enrolled in this course
    const enrollment = await pool.query(
      "SELECT * FROM enrollment WHERE course_id = $1 AND student_id = $2",
      [courseId, studentId]
    );

    if (enrollment.rows.length === 0) {
      return res.status(403).json({ error: "You are not enrolled in this course." });
    }

    // Get all published exams for this course
    const exams = await pool.query(
      `SELECT e.*, 
              CASE WHEN es.submission_id IS NOT NULL THEN true ELSE false END as is_submitted
       FROM exam e
       LEFT JOIN exam_submission es ON e.exam_id = es.exam_id AND es.student_id = $1
       WHERE e.course_id = $2 AND e.is_published = true
       ORDER BY e.created_at DESC`,
      [studentId, courseId]
    );

    res.json(exams.rows);
  } catch (err) {
    console.error("Error fetching available exams:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Start an exam (creates an exam_submission record)
router.post("/start/:examId", authorize, async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.user.id;

    // Check if the exam exists and is published
    const examCheck = await pool.query(
      "SELECT e.*, c.course_id FROM exam e JOIN course c ON e.course_id = c.course_id WHERE e.exam_id = $1 AND e.is_published = true",
      [examId]
    );

    if (examCheck.rows.length === 0) {
      return res.status(404).json({ error: "Exam not found or not published." });
    }

    const exam = examCheck.rows[0];
    
    // Check if exam is past due date
    if (isExamPastDue(exam)) {
      return res.status(400).json({
        error: "This exam is past its due date and can no longer be accessed.",
        due_date: exam.due_date
      });
    }

    // Check if student is enrolled in the course
    const enrollmentCheck = await pool.query(
      "SELECT * FROM enrollment WHERE course_id = $1 AND student_id = $2",
      [exam.course_id, studentId]
    );

    if (enrollmentCheck.rows.length === 0) {
      return res.status(403).json({ error: "You are not enrolled in this course." });
    }

    // Check if the student has already started this exam
    const submissionCheck = await pool.query(
      "SELECT * FROM exam_submission WHERE exam_id = $1 AND student_id = $2",
      [examId, studentId]
    );

    if (submissionCheck.rows.length > 0) {
      // If submission has a submitted_at date, it's already been submitted
      if (submissionCheck.rows[0].submitted_at) {
        return res.status(400).json({
          error: "You have already submitted this exam and cannot take it again."
        });
      }
      
      // If already started but not submitted
      return res.status(200).json({
        message: "Exam already started",
        submission_id: submissionCheck.rows[0].submission_id
      });
    }

    // Create a new exam submission record
    const newSubmission = await pool.query(
      `INSERT INTO exam_submission (exam_id, student_id, started_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       RETURNING *`,
      [examId, studentId]
    );
    
    // Track activity for DSS
    try {
      await activityService.logExamActivity(studentId, examId, 'exam_start', {
        submission_id: newSubmission.rows[0].submission_id,
        timestamp: new Date()
      });
    } catch (activityError) {
      console.error('Failed to log exam start activity:', activityError);
      // Continue processing even if activity logging fails
    }

    res.json({
      message: "Exam started successfully",
      submission_id: newSubmission.rows[0].submission_id
    });
  } catch (err) {
    console.error("Start exam error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Submit an exam answer (creates or updates a student_answer record)
router.post("/answer/:submissionId", authorize, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { questionId, answer } = req.body;
    const studentId = req.user.id;

    if (!questionId || answer === undefined) {
      return res.status(400).json({ error: "Question ID and answer are required." });
    }

    // Check if this submission belongs to the student
    const submission = await pool.query(
      "SELECT s.*, e.due_date FROM exam_submission s JOIN exam e ON s.exam_id = e.exam_id WHERE s.submission_id = $1 AND s.student_id = $2",
      [submissionId, studentId]
    );

    if (submission.rows.length === 0) {
      return res.status(403).json({ error: "You don't have access to this submission." });
    }

    // Check if the exam has been submitted already
    if (submission.rows[0].submitted_at) {
      return res.status(400).json({ error: "This exam has already been submitted." });
    }

    // Check if exam is past due date
    if (isExamPastDue(submission.rows[0])) {
      return res.status(403).json({ 
        error: "This exam is past its due date and answers can no longer be saved.",
        due_date: submission.rows[0].due_date
      });
    }

    // Check if the question belongs to the exam
    const question = await pool.query(
      `SELECT q.* FROM exam_question q
       JOIN exam_submission s ON q.exam_id = s.exam_id
       WHERE s.submission_id = $1 AND q.question_id = $2`,
      [submissionId, questionId]
    );

    if (question.rows.length === 0) {
      return res.status(400).json({ error: "Question not found for this exam." });
    }

    // Check if an answer already exists for this question
    const existingAnswer = await pool.query(
      "SELECT * FROM student_answer WHERE submission_id = $1 AND question_id = $2",
      [submissionId, questionId]
    );

    let result;
    if (existingAnswer.rows.length > 0) {
      // Update existing answer
      result = await pool.query(
        `UPDATE student_answer
         SET student_answer = $1, updated_at = CURRENT_TIMESTAMP
         WHERE submission_id = $2 AND question_id = $3
         RETURNING *`,
        [answer, submissionId, questionId]
      );
    } else {
      // Create new answer
      result = await pool.query(
        `INSERT INTO student_answer (submission_id, question_id, student_answer)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [submissionId, questionId, answer]
      );
    }

    res.status(201).json({
      message: "Answer saved",
      answer: result.rows[0]
    });
  } catch (err) {
    console.error("Save answer error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Submit an entire exam (finalizes the submission)
router.post("/submit/:submissionId", authorize, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const studentId = req.user.id;

    // Verify the submission belongs to this student and get exam info
    const submissionQuery = await pool.query(
      `SELECT s.*, e.exam_id, e.due_date, e.title, e.course_id, c.course_name, c.professor_id
       FROM exam_submission s
       JOIN exam e ON s.exam_id = e.exam_id
       JOIN course c ON e.course_id = c.course_id
       WHERE s.submission_id = $1 AND s.student_id = $2`,
      [submissionId, studentId]
    );

    if (submissionQuery.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found." });
    }

    const submission = submissionQuery;

    // Check if the exam has been submitted already
    if (submission.rows[0].submitted_at) {
      return res.status(400).json({ error: "This exam has already been submitted." });
    }

    // Check if exam is past due date
    if (isExamPastDue(submission.rows[0])) {
      return res.status(400).json({
        error: "This exam is past its due date and can no longer be submitted.",
        due_date: submission.rows[0].due_date
      });
    }
    
    const examId = submission.rows[0].exam_id;
    const courseId = submission.rows[0].course_id;

    // Get all questions for this exam
    const questions = await pool.query(
      "SELECT * FROM exam_question WHERE exam_id = $1",
      [examId]
    );

    // Get all answers already provided by the student
    const answers = await pool.query(
      `SELECT a.* FROM student_answer a
       JOIN exam_submission s ON a.submission_id = s.submission_id
       WHERE s.submission_id = $1`,
      [submissionId]
    );

    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Calculate score and grade each answer
      const totalPossiblePoints = questions.rows.reduce((sum, q) => sum + q.points, 0);
      let totalEarnedPoints = 0;

      // Grade each answer
      for (const answer of answers.rows) {
        const question = questions.rows.find(q => q.question_id === answer.question_id);
        if (!question) continue;

        // Grade the answer
        const gradingResult = gradeAnswer(question, answer.student_answer);
        console.log(`Grading question ${question.question_id}:`, {
          type: question.type,
          correct_answer: question.correct_answer,
          student_answer: answer.student_answer,
          result: gradingResult
        });

        // Update the answer with grading results
        await client.query(
          `UPDATE student_answer 
           SET is_correct = $1, points_earned = $2, updated_at = CURRENT_TIMESTAMP
           WHERE answer_id = $3`,
          [gradingResult.is_correct, gradingResult.points_earned, answer.answer_id]
        );

        if (gradingResult.is_correct) {
          totalEarnedPoints += parseFloat(gradingResult.points_earned);
        }
      }

      // Update the submission record as submitted
      const updatedSubmission = await client.query(
        `UPDATE exam_submission
         SET submitted_at = CURRENT_TIMESTAMP, 
             score = $1,
             total_points = $2,
             is_graded = true
         WHERE submission_id = $3
         RETURNING *`,
        [totalEarnedPoints, totalPossiblePoints, submissionId]
      );

      await client.query('COMMIT');
      
      // Track activity for DSS
      try {
        await activityService.logExamActivity(studentId, examId, 'exam_submission', {
          submission_id: submissionId,
          score: totalEarnedPoints,
          total_points: totalPossiblePoints,
          timestamp: new Date()
        });
      } catch (activityError) {
        console.error('Failed to log exam submission activity:', activityError);
        // Continue processing even if activity logging fails
      }

      res.json({
        message: "Exam submitted successfully",
        submission: updatedSubmission.rows[0]
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Submit exam error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Get a student's exam results with both examId and submissionId in the URL
router.get("/results/:examId/:submissionId", authorize, async (req, res) => {
  try {
    const { examId, submissionId } = req.params;
    const studentId = req.user.id;

    // Get the submission for this exam
    const submission = await pool.query(
      `SELECT s.*, e.title, e.description
       FROM exam_submission s
       JOIN exam e ON s.exam_id = e.exam_id
       WHERE s.exam_id = $1 AND s.student_id = $2 AND s.submission_id = $3`,
      [examId, studentId, submissionId]
    );

    if (submission.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found or you don't have access to it." });
    }

    // If the exam hasn't been submitted yet, return only basic info
    if (!submission.rows[0].submitted_at) {
      return res.json({
        exam: {
          title: submission.rows[0].title,
          description: submission.rows[0].description
        },
        submission: {
          submission_id: submission.rows[0].submission_id,
          started_at: submission.rows[0].started_at,
          submitted_at: null,
          status: "in_progress"
        }
      });
    }

    // Get all questions and the student's answers
    const result = await pool.query(
      `SELECT q.question_id, q.question_text, q.type, q.options, q.correct_answer, q.points,
              a.student_answer, a.is_correct, a.points_earned
       FROM exam_question q
       LEFT JOIN student_answer a ON q.question_id = a.question_id AND a.submission_id = $1
       WHERE q.exam_id = $2
       ORDER BY q.question_id ASC`,
      [submission.rows[0].submission_id, examId]
    );

    // Enhance the response with properly formatted data
    const enhancedQuestions = result.rows.map(q => {
      // Include the original data
      const enhancedQuestion = { ...q };
      
      // For multiple-choice questions with multiple answers, properly format the correct_answer
      if (((q.type === 'multiple choice' || q.type === 'mcq' || q.type === 'identification') && 
          typeof q.correct_answer === 'string' && 
          q.correct_answer.startsWith('{'))) {
        enhancedQuestion.correct_answer = parsePostgresArray(q.correct_answer);
      }
      
      return enhancedQuestion;
    });

    res.json({
      exam: {
        title: submission.rows[0].title,
        description: submission.rows[0].description
      },
      submission: {
        submission_id: submission.rows[0].submission_id,
        started_at: submission.rows[0].started_at,
        submitted_at: submission.rows[0].submitted_at,
        score: submission.rows[0].score,
        total_points: submission.rows[0].total_points,
        percentage: submission.rows[0].total_points > 0 
          ? Math.round((submission.rows[0].score / submission.rows[0].total_points) * 100) 
          : 0,
        status: submission.rows[0].status || "completed",
        has_requested_recheck: submission.rows[0].status === 'recheck_requested' || 
                               submission.rows[0].status === 'rechecking' || 
                               submission.rows[0].status === 'recheck_completed'
      },
      questions: enhancedQuestions
    });
  } catch (err) {
    console.error("Get exam results with submission ID error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Get a student's exam results (original route)
router.get("/results/:examId", authorize, async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.user.id;

    // Get the submission for this exam
    const submission = await pool.query(
      `SELECT s.*, e.title, e.description
       FROM exam_submission s
       JOIN exam e ON s.exam_id = e.exam_id
       WHERE s.exam_id = $1 AND s.student_id = $2`,
      [examId, studentId]
    );

    if (submission.rows.length === 0) {
      return res.status(404).json({ error: "You haven't taken this exam yet." });
    }

    // If the exam hasn't been submitted yet, return only basic info
    if (!submission.rows[0].submitted_at) {
      return res.json({
        exam: {
          title: submission.rows[0].title,
          description: submission.rows[0].description
        },
        submission: {
          submission_id: submission.rows[0].submission_id,
          started_at: submission.rows[0].started_at,
          submitted_at: null,
          status: "in_progress"
        }
      });
    }

    // Get all questions and the student's answers
    const result = await pool.query(
      `SELECT q.question_id, q.question_text, q.type, q.options, q.correct_answer, q.points,
              a.student_answer, a.is_correct, a.points_earned
       FROM exam_question q
       LEFT JOIN student_answer a ON q.question_id = a.question_id AND a.submission_id = $1
       WHERE q.exam_id = $2
       ORDER BY q.question_id ASC`,
      [submission.rows[0].submission_id, examId]
    );

    // Enhance the response with properly formatted data
    const enhancedQuestions = result.rows.map(q => {
      // Include the original data
      const enhancedQuestion = { ...q };
      
      // For multiple-choice questions with multiple answers, properly format the correct_answer
      if (((q.type === 'multiple choice' || q.type === 'mcq' || q.type === 'identification') && 
          typeof q.correct_answer === 'string' && 
          q.correct_answer.startsWith('{'))) {
        enhancedQuestion.correct_answer = parsePostgresArray(q.correct_answer);
      }
      
      return enhancedQuestion;
    });

    res.json({
      exam: {
        title: submission.rows[0].title,
        description: submission.rows[0].description
      },
      submission: {
        submission_id: submission.rows[0].submission_id,
        started_at: submission.rows[0].started_at,
        submitted_at: submission.rows[0].submitted_at,
        score: submission.rows[0].score,
        total_points: submission.rows[0].total_points,
        percentage: submission.rows[0].total_points > 0 
          ? Math.round((submission.rows[0].score / submission.rows[0].total_points) * 100) 
          : 0,
        status: submission.rows[0].status || "completed",
        has_requested_recheck: submission.rows[0].status === 'recheck_requested' || 
                               submission.rows[0].status === 'rechecking' || 
                               submission.rows[0].status === 'recheck_completed'
      },
      questions: enhancedQuestions
    });
  } catch (err) {
    console.error("Get exam results error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Request a grade recheck for an exam
router.post("/results/:examId/recheck-request", authorize, async (req, res) => {
  try {
    const { examId } = req.params;
    const { reason, submission_id } = req.body;
    const studentId = req.user.id;

    // Get the submission for this exam if submission_id is not provided
    let submissionId = submission_id;
    if (!submissionId) {
      const submission = await pool.query(
        `SELECT s.*
         FROM exam_submission s
         WHERE s.exam_id = $1 AND s.student_id = $2`,
        [examId, studentId]
      );

      if (submission.rows.length === 0) {
        return res.status(404).json({ error: "You haven't taken this exam yet." });
      }

      // Check if the exam has been submitted
      if (!submission.rows[0].submitted_at) {
        return res.status(400).json({ error: "You need to submit the exam before requesting a recheck." });
      }
      
      submissionId = submission.rows[0].submission_id;
    }

    // Start a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update the submission status to recheck_requested
      await client.query(
        `UPDATE exam_submission 
         SET status = 'recheck_requested', updated_at = CURRENT_TIMESTAMP
         WHERE submission_id = $1`,
        [submissionId]
      );

      // Store the recheck request with reason in the new table
      await client.query(
        `INSERT INTO exam_recheck_request 
         (submission_id, student_id, reason, status)
         VALUES ($1, $2, $3, 'pending')`,
        [submissionId, studentId, reason || "No reason provided"]
      );
      
      // Create a notification for the professor
      const examInfo = await client.query(
        `SELECT e.title, e.course_id, c.professor_id, c.course_name
         FROM exam e
         JOIN course c ON e.course_id = c.course_id
         WHERE e.exam_id = $1`,
        [examId]
      );

      if (examInfo.rows.length > 0) {
        const professorId = examInfo.rows[0].professor_id;
        const examTitle = examInfo.rows[0].title;
        const courseId = examInfo.rows[0].course_id;
        const courseName = examInfo.rows[0].course_name;

        // Get student name
        const student = await client.query(
          "SELECT first_name, last_name FROM users WHERE user_id = $1",
          [studentId]
        );

        const studentName = `${student.rows[0].first_name} ${student.rows[0].last_name}`;
        
        // Create notification with proper redirect URL
        await notificationService.createNotification(
          professorId,
          'grade',
          `${studentName} has requested a grade recheck for "${examTitle}" in ${courseName}`,
          {
            exam_id: examId,
            course_id: courseId,
            submission_id: submissionId,
            type: 'exam_recheck',
            redirect_url: `/courses/${courseId}/exams`,
            state: { 
              activeTab: 'grading', 
              examId: examId,
              submissionId: submissionId
            }
          }
        );
      }
      
      await client.query('COMMIT');
      
      res.json({ 
        message: "Recheck request submitted successfully",
        status: "recheck_requested" 
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Recheck request error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Get the recheck reason for an exam submission
router.get("/results/:examId/recheck-reason", authorize, async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.user.id;

    // Get the submission for this exam
    const submission = await pool.query(
      `SELECT s.*
       FROM exam_submission s
       WHERE s.exam_id = $1 AND s.student_id = $2`,
      [examId, studentId]
    );

    if (submission.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found." });
    }

    // Get the recheck reason from the new table
    const recheckRequest = await pool.query(
      `SELECT reason
       FROM exam_recheck_request
       WHERE submission_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [submission.rows[0].submission_id]
    );

    if (recheckRequest.rows.length > 0) {
      return res.json({ reason: recheckRequest.rows[0].reason });
    }

    return res.json({ reason: "No reason found" });
  } catch (err) {
    console.error("Get recheck reason error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router; 