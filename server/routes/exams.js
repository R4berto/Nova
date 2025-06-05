const express = require("express");
const router = express.Router();
const pool = require("../db");
const authorize = require("../middleware/authorize");
const { gradeAnswer, parsePostgresArray } = require("../utils/examGrading");
const { isExamPastDue, isValidDueDate } = require("../utils/examUtils");
const notificationService = require("../services/notificationService");

// Create a new exam (professor only)
router.post("/:courseId", authorize, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description, due_date } = req.body;
    const author_id = req.user.id;

    // Validate due_date if provided
    if (due_date && !isValidDueDate(due_date)) {
      return res.status(400).json({ error: "Due date must be in the future." });
    }

    // Check if user is a professor for this course
    const course = await pool.query(
      "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
      [courseId, author_id]
    );
    if (course.rows.length === 0) {
      return res.status(403).json({ error: "Only the course professor can create exams." });
    }

    const result = await pool.query(
      `INSERT INTO exam (course_id, author_id, title, description, due_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [courseId, author_id, title, description, due_date || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create exam error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all exams for a course
router.get("/:courseId", authorize, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user has access to this course
    let hasAccess = false;
    if (userRole === 'professor') {
      const professorCheck = await pool.query(
        "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
        [courseId, userId]
      );
      hasAccess = professorCheck.rows.length > 0;
    } else {
      const studentCheck = await pool.query(
        "SELECT * FROM enrollment WHERE course_id = $1 AND student_id = $2",
        [courseId, userId]
      );
      hasAccess = studentCheck.rows.length > 0;
    }

    if (!hasAccess) {
      return res.status(403).json({ error: "You don't have access to this course." });
    }

    let query;
    let params;

    if (userRole === 'professor') {
      // Professors can see all exams with question count and total points
      query = `
        SELECT e.exam_id, e.course_id, e.author_id, e.title, e.description, 
               e.is_published, e.published_at, e.created_at, e.updated_at, e.due_date,
               COALESCE(COUNT(eq.question_id), 0) as question_count,
               COALESCE(SUM(eq.points), 0) as total_points
        FROM exam e
        LEFT JOIN exam_question eq ON e.exam_id = eq.exam_id
        WHERE e.course_id = $1 
        GROUP BY e.exam_id, e.course_id, e.author_id, e.title, e.description, 
                 e.is_published, e.published_at, e.created_at, e.updated_at, e.due_date
        ORDER BY e.created_at DESC
      `;
      params = [courseId];
    } else {
      // Students can only see published exams with question count and total points
      query = `
        SELECT e.exam_id, e.course_id, e.author_id, e.title, e.description, 
               e.is_published, e.published_at, e.created_at, e.updated_at, e.due_date,
               COALESCE(COUNT(eq.question_id), 0) as question_count,
               COALESCE(SUM(eq.points), 0) as total_points
        FROM exam e
        LEFT JOIN exam_question eq ON e.exam_id = eq.exam_id
        WHERE e.course_id = $1 AND e.is_published = true 
        GROUP BY e.exam_id, e.course_id, e.author_id, e.title, e.description, 
                 e.is_published, e.published_at, e.created_at, e.updated_at, e.due_date
        ORDER BY e.created_at DESC
      `;
      params = [courseId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Get exams error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Get a single exam (with questions)
router.get("/single/:examId", authorize, async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get exam details
    const examResult = await pool.query("SELECT * FROM exam WHERE exam_id = $1", [examId]);
    if (examResult.rows.length === 0) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const exam = examResult.rows[0];

    // Check if user has access to this exam
    if (userRole === 'student' && !exam.is_published) {
      // Students can only access published exams
      return res.status(403).json({ error: "This exam is not available yet." });
    }

    if (userRole === 'professor' && exam.author_id !== userId) {
      // Only the author professor can access unpublished exams
      const courseCheck = await pool.query(
        "SELECT * FROM course WHERE course_id = $1 AND professor_id = $2",
        [exam.course_id, userId]
      );
      if (courseCheck.rows.length === 0) {
        return res.status(403).json({ error: "You don't have access to this exam." });
      }
    }

    // Get questions - include allow_multiple_answers field
    const questions = await pool.query(
      "SELECT *, COALESCE(allow_multiple_answers, false) as allow_multiple_answers FROM exam_question WHERE exam_id = $1 ORDER BY question_id ASC",
      [examId]
    );
    res.json({ ...exam, questions: questions.rows });
  } catch (err) {
    console.error("Get exam error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Update an exam (professor only)
router.put("/:examId", authorize, async (req, res) => {
  try {
    const { examId } = req.params;
    const { title, description, due_date } = req.body;
    const userId = req.user.id;

    // Validate due_date if provided
    if (due_date && !isValidDueDate(due_date)) {
      return res.status(400).json({ error: "Due date must be in the future." });
    }

    // Only the author/professor can update
    const exam = await pool.query(
      "SELECT e.*, c.course_name FROM exam e JOIN course c ON e.course_id = c.course_id WHERE e.exam_id = $1 AND e.author_id = $2",
      [examId, userId]
    );
    if (exam.rows.length === 0) {
      return res.status(403).json({ error: "Only the exam author can update this exam." });
    }

    const result = await pool.query(
      `UPDATE exam SET title = $1, description = $2, due_date = $3, updated_at = CURRENT_TIMESTAMP
       WHERE exam_id = $4 RETURNING *`,
      [title, description, due_date || null, examId]
    );

    // If the exam is published, notify students about the update
    if (exam.rows[0].is_published) {
      // Get all students enrolled in the course
      const enrolledStudents = await pool.query(
        "SELECT student_id FROM enrollment WHERE course_id = $1",
        [exam.rows[0].course_id]
      );

      // Send notifications to all enrolled students
      for (const student of enrolledStudents.rows) {
        try {
          await notificationService.createNotification(
            student.student_id,
            'new_content',
            `Exam "${title}" has been updated in ${exam.rows[0].course_name}`,
            {
              exam_id: examId,
              course_id: exam.rows[0].course_id,
              type: 'exam_update',
              redirect_url: `/courses/${exam.rows[0].course_id}/exams`,
              state: { activeTab: 'published', examId: examId }
            }
          );
        } catch (notifError) {
          console.error(`Failed to create notification for student ${student.student_id}:`, notifError);
          // Continue with other students even if notification fails
        }
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update exam error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete an exam (professor only)
router.delete("/:examId", authorize, async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user.id;

    // Only the author/professor can delete
    const exam = await pool.query(
      "SELECT * FROM exam WHERE exam_id = $1 AND author_id = $2",
      [examId, userId]
    );
    if (exam.rows.length === 0) {
      return res.status(403).json({ error: "Only the exam author can delete this exam." });
    }

    await pool.query("DELETE FROM exam WHERE exam_id = $1", [examId]);
    res.json({ message: "Exam deleted" });
  } catch (err) {
    console.error("Delete exam error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Publish an exam (professor only)
router.put("/:examId/publish", authorize, async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only professors can publish exams
    if (userRole !== 'professor') {
      return res.status(403).json({ error: "Only professors can publish exams." });
    }

    // Only the author can publish
    const examCheck = await pool.query(
      "SELECT e.*, c.course_name FROM exam e JOIN course c ON e.course_id = c.course_id WHERE e.exam_id = $1 AND e.author_id = $2",
      [examId, userId]
    );
    if (examCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only the exam author can publish this exam." });
    }

    // Check if the exam has questions
    const questionCount = await pool.query(
      "SELECT COUNT(*) FROM exam_question WHERE exam_id = $1",
      [examId]
    );
    if (parseInt(questionCount.rows[0].count) === 0) {
      return res.status(400).json({ error: "Cannot publish an exam with no questions." });
    }

    // Publish the exam
    const result = await pool.query(
      `UPDATE exam 
       SET is_published = true, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE exam_id = $1 
       RETURNING *`,
      [examId]
    );

    // Get all students enrolled in the course
    const enrolledStudents = await pool.query(
      "SELECT student_id FROM enrollment WHERE course_id = $1",
      [examCheck.rows[0].course_id]
    );

    // Send notifications to all enrolled students
    for (const student of enrolledStudents.rows) {
      try {
        await notificationService.createNotification(
          student.student_id,
          'new_content',
          `New exam "${examCheck.rows[0].title}" has been published in ${examCheck.rows[0].course_name}`,
          {
            exam_id: examId,
            course_id: examCheck.rows[0].course_id,
            type: 'exam',
            redirect_url: `/courses/${examCheck.rows[0].course_id}/exams`,
            state: { activeTab: 'interface', examId: examId }
          }
        );
      } catch (notifError) {
        console.error(`Failed to create notification for student ${student.student_id}:`, notifError);
        // Continue with other students even if notification fails
      }
    }

    res.json({
      message: "Exam published successfully",
      exam: result.rows[0]
    });
  } catch (err) {
    console.error("Publish exam error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Unpublish an exam (professor only)
router.put("/:examId/unpublish", authorize, async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only professors can unpublish exams
    if (userRole !== 'professor') {
      return res.status(403).json({ error: "Only professors can unpublish exams." });
    }

    // Only the author can unpublish
    const examCheck = await pool.query(
      "SELECT * FROM exam WHERE exam_id = $1 AND author_id = $2",
      [examId, userId]
    );
    if (examCheck.rows.length === 0) {
      return res.status(403).json({ error: "Only the exam author can unpublish this exam." });
    }

    // Unpublish the exam
    const result = await pool.query(
      `UPDATE exam 
       SET is_published = false, updated_at = CURRENT_TIMESTAMP
       WHERE exam_id = $1 
       RETURNING *`,
      [examId]
    );

    res.json({
      message: "Exam unpublished successfully",
      exam: result.rows[0]
    });
  } catch (err) {
    console.error("Unpublish exam error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Add a question to an exam (professor only)
router.post("/:examId/questions", authorize, async (req, res) => {
  try {
    const { examId } = req.params;
    const { type, question_text, options, correct_answer, points, allow_multiple_answers } = req.body;
    const userId = req.user.id;

    // Only the author/professor can add questions
    const exam = await pool.query(
      "SELECT * FROM exam WHERE exam_id = $1 AND author_id = $2",
      [examId, userId]
    );
    if (exam.rows.length === 0) {
      return res.status(403).json({ error: "Only the exam author can add questions." });
    }

    // Check if exam is published - can't add questions to published exams
    if (exam.rows[0].is_published) {
      return res.status(400).json({ 
        error: "Cannot add questions to a published exam. Unpublish the exam first." 
      });
    }

    // Calculate correct_answer_indices for MCQ
    let correct_answer_indices = null;
    if (type === 'mcq' && options && options.length > 0) {
      if (allow_multiple_answers && Array.isArray(correct_answer)) {
        // For multiple correct answers, find the indices
        correct_answer_indices = [];
        options.forEach((option, index) => {
          if (correct_answer.includes(option)) {
            correct_answer_indices.push(index);
          }
        });
      } else if (!allow_multiple_answers && correct_answer) {
        // For single correct answer, find the index
        const index = options.indexOf(correct_answer);
        if (index !== -1) {
          correct_answer_indices = [index];
        }
      }
    }

    const result = await pool.query(
      `INSERT INTO exam_question (exam_id, type, question_text, options, correct_answer, points, allow_multiple_answers, correct_answer_indices)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [examId, type, question_text, options || null, correct_answer, points || 1, allow_multiple_answers || false, correct_answer_indices]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add question error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a question from an exam (professor only)
router.delete("/:examId/questions/:questionId", authorize, async (req, res) => {
  try {
    const { examId, questionId } = req.params;
    const userId = req.user.id;

    // Only the author/professor can delete questions
    const exam = await pool.query(
      "SELECT * FROM exam WHERE exam_id = $1 AND author_id = $2",
      [examId, userId]
    );
    if (exam.rows.length === 0) {
      return res.status(403).json({ error: "Only the exam author can delete questions." });
    }

    // Check if exam is published - can't delete questions from published exams
    if (exam.rows[0].is_published) {
      return res.status(400).json({ 
        error: "Cannot delete questions from a published exam. Unpublish the exam first." 
      });
    }

    await pool.query(
      "DELETE FROM exam_question WHERE question_id = $1 AND exam_id = $2",
      [questionId, examId]
    );
    res.json({ message: "Question deleted" });
  } catch (err) {
    console.error("Delete question error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Update a question in an exam (professor only)
router.put("/:examId/questions/:questionId", authorize, async (req, res) => {
  try {
    const { examId, questionId } = req.params;
    const { type, question_text, options, correct_answer, points, allow_multiple_answers } = req.body;
    const userId = req.user.id;

    // Only the author/professor can update questions
    const exam = await pool.query(
      "SELECT * FROM exam WHERE exam_id = $1 AND author_id = $2",
      [examId, userId]
    );
    if (exam.rows.length === 0) {
      return res.status(403).json({ error: "Only the exam author can update questions." });
    }

    // Check if exam is published - can't update questions in published exams
    if (exam.rows[0].is_published) {
      return res.status(400).json({ 
        error: "Cannot update questions in a published exam. Unpublish the exam first." 
      });
    }

    // Check if the question exists and belongs to this exam
    const questionCheck = await pool.query(
      "SELECT * FROM exam_question WHERE question_id = $1 AND exam_id = $2",
      [questionId, examId]
    );
    if (questionCheck.rows.length === 0) {
      return res.status(404).json({ error: "Question not found or doesn't belong to this exam." });
    }
    
    // Calculate correct_answer_indices for MCQ
    let correct_answer_indices = null;
    if (type === 'mcq' && options && options.length > 0) {
      if (allow_multiple_answers && Array.isArray(correct_answer)) {
        // For multiple correct answers, find the indices
        correct_answer_indices = [];
        options.forEach((option, index) => {
          if (correct_answer.includes(option)) {
            correct_answer_indices.push(index);
          }
        });
      } else if (!allow_multiple_answers && correct_answer) {
        // For single correct answer, find the index
        const index = options.indexOf(correct_answer);
        if (index !== -1) {
          correct_answer_indices = [index];
        }
      }
    }

    // Update the question
    const result = await pool.query(
      `UPDATE exam_question 
       SET type = $1, question_text = $2, options = $3, correct_answer = $4, points = $5, allow_multiple_answers = $6, correct_answer_indices = $7
       WHERE question_id = $8 AND exam_id = $9
       RETURNING *`,
      [type, question_text, options || null, correct_answer, points || 1, allow_multiple_answers || false, correct_answer_indices, questionId, examId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update question error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all submissions for an exam (professor only)
router.get("/:examId/submissions", authorize, async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only professors can view all submissions
    if (userRole !== 'professor') {
      return res.status(403).json({ error: "Only professors can view all submissions." });
    }

    // Check if the professor has access to this exam
    const examCheck = await pool.query(
      `SELECT e.*, c.course_id, c.professor_id 
       FROM exam e 
       JOIN course c ON e.course_id = c.course_id 
       WHERE e.exam_id = $1`,
      [examId]
    );

    if (examCheck.rows.length === 0) {
      return res.status(404).json({ error: "Exam not found." });
    }

    if (examCheck.rows[0].professor_id !== userId) {
      return res.status(403).json({ error: "You don't have access to this exam's submissions." });
    }

    // Calculate the total points for this exam by summing the points from exam_question
    const totalPointsResult = await pool.query(
      `SELECT COALESCE(SUM(points), 0) as total_points 
       FROM exam_question 
       WHERE exam_id = $1`,
      [examId]
    );
    
    const totalPoints = totalPointsResult.rows[0].total_points;

    // Get all submissions with student information
    const submissions = await pool.query(
      `SELECT es.*, 
              u.first_name, u.last_name, u.email,
              e.title as exam_title
       FROM exam_submission es
       JOIN users u ON es.student_id = u.user_id
       JOIN exam e ON es.exam_id = e.exam_id
       WHERE es.exam_id = $1 
       AND es.submitted_at IS NOT NULL
       ORDER BY es.submitted_at DESC`,
      [examId]
    );

    // Add the calculated total points to each submission
    const submissionsWithTotalPoints = submissions.rows.map(submission => ({
      ...submission,
      exam_total_points: totalPoints
    }));

    res.json(submissionsWithTotalPoints);
  } catch (err) {
    console.error("Get exam submissions error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Get a specific student's exam submission (professor only)
router.get("/:examId/submissions/:submissionId", authorize, async (req, res) => {
  try {
    const { examId, submissionId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only professors can view detailed submissions
    if (userRole !== 'professor') {
      return res.status(403).json({ error: "Only professors can view detailed submissions." });
    }

    // Check if the professor has access to this exam
    const examCheck = await pool.query(
      `SELECT e.*, c.course_id, c.professor_id 
       FROM exam e 
       JOIN course c ON e.course_id = c.course_id 
       WHERE e.exam_id = $1`,
      [examId]
    );

    if (examCheck.rows.length === 0) {
      return res.status(404).json({ error: "Exam not found." });
    }

    if (examCheck.rows[0].professor_id !== userId) {
      return res.status(403).json({ error: "You don't have access to this exam's submissions." });
    }

    // Get the submission with student information
    const submissionResult = await pool.query(
      `SELECT es.*, 
              u.first_name, u.last_name, u.email,
              e.title as exam_title
       FROM exam_submission es
       JOIN users u ON es.student_id = u.user_id
       JOIN exam e ON es.exam_id = e.exam_id
       WHERE es.exam_id = $1 AND es.submission_id = $2`,
      [examId, submissionId]
    );

    if (submissionResult.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found." });
    }

    const submission = submissionResult.rows[0];

    // Get all questions and the student's answers
    const answers = await pool.query(
      `SELECT q.question_id, q.question_text, q.type, q.options, q.correct_answer, q.points,
              a.student_answer, a.is_correct, a.points_earned, a.answer_id
       FROM exam_question q
       LEFT JOIN student_answer a ON q.question_id = a.question_id AND a.submission_id = $1
       WHERE q.exam_id = $2
       ORDER BY q.question_id ASC`,
      [submissionId, examId]
    );

    res.json({
      submission,
      answers: answers.rows
    });
  } catch (err) {
    console.error("Get detailed submission error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Recheck/update a student's exam grade (professor only)
router.put("/:examId/submissions/:submissionId/recheck", authorize, async (req, res) => {
  try {
    const { examId, submissionId } = req.params;
    const { answers } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only professors can recheck grades
    if (userRole !== 'professor') {
      return res.status(403).json({ error: "Only professors can recheck grades." });
    }

    // Check if the professor has access to this exam
    const examCheck = await pool.query(
      `SELECT e.*, c.course_id, c.professor_id 
       FROM exam e 
       JOIN course c ON e.course_id = c.course_id 
       WHERE e.exam_id = $1`,
      [examId]
    );

    if (examCheck.rows.length === 0) {
      return res.status(404).json({ error: "Exam not found." });
    }

    if (examCheck.rows[0].professor_id !== userId) {
      return res.status(403).json({ error: "You don't have access to this exam's submissions." });
    }

    // Verify the submission exists
    const submissionCheck = await pool.query(
      "SELECT * FROM exam_submission WHERE submission_id = $1 AND exam_id = $2",
      [submissionId, examId]
    );

    if (submissionCheck.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found." });
    }

    // Get all questions to properly handle multiple-choice questions with multiple answers
    const questionsResult = await pool.query(
      "SELECT * FROM exam_question WHERE exam_id = $1",
      [examId]
    );
    const questions = questionsResult.rows;

    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let totalScore = 0;
      
      // Update each answer
      for (const answer of answers) {
        const { answer_id, is_correct, points_earned } = answer;
        
        // Get information about this specific answer
        const answerInfo = await client.query(
          `SELECT sa.*, eq.type, eq.correct_answer, eq.options, eq.points
           FROM student_answer sa
           JOIN exam_question eq ON sa.question_id = eq.question_id
           WHERE sa.answer_id = $1`,
          [answer_id]
        );
        
        // If professor has approved the answer (marked as correct)
        if (is_correct) {
          // For multiple-choice questions with multiple answers
          if (answerInfo.rows.length > 0 && 
              answerInfo.rows[0].type === 'multiple choice' && 
              typeof answerInfo.rows[0].correct_answer === 'string' && 
              answerInfo.rows[0].correct_answer.startsWith('{')) {
            
            console.log(`Rechecking multiple choice answer ${answer_id} - marked correct by professor`);
          }
          
          await client.query(
            `UPDATE student_answer 
             SET is_correct = $1, points_earned = $2, updated_at = CURRENT_TIMESTAMP
             WHERE answer_id = $3`,
            [is_correct, points_earned, answer_id]
          );
        } else {
          // Professor has marked the answer as incorrect
          await client.query(
            `UPDATE student_answer 
             SET is_correct = $1, points_earned = $2, updated_at = CURRENT_TIMESTAMP
             WHERE answer_id = $3`,
            [is_correct, points_earned, answer_id]
          );
        }
        
        totalScore += parseFloat(points_earned);
      }
      
      // Update the submission with the new score
      await client.query(
        `UPDATE exam_submission 
         SET score = $1, is_graded = true, updated_at = CURRENT_TIMESTAMP
         WHERE submission_id = $2`,
        [totalScore, submissionId]
      );
      
      // Get the updated submission
      const updatedSubmission = await client.query(
        `SELECT es.*, 
                u.first_name, u.last_name, u.email,
                e.title as exam_title
         FROM exam_submission es
         JOIN users u ON es.student_id = u.user_id
         JOIN exam e ON es.exam_id = e.exam_id
         WHERE es.submission_id = $1`,
        [submissionId]
      );
      
      // Create a log entry for the grade change
      await client.query(
        `INSERT INTO grade_change_log (submission_id, professor_id, previous_score, new_score, changed_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [submissionId, userId, submissionCheck.rows[0].score, totalScore]
      );
      
      // After successful recheck, notify the student
      const studentId = submissionCheck.rows[0].student_id;
      const examTitle = examCheck.rows[0].title;
      const courseName = examCheck.rows[0].course_name;

      await notificationService.createNotification(
        studentId,
        'grade',
        `Your exam "${examTitle}" has been regraded in ${courseName}`,
        {
          exam_id: examId,
          course_id: examCheck.rows[0].course_id,
          submission_id: submissionId,
          type: 'exam_grade',
          redirect_url: `/courses/${examCheck.rows[0].course_id}/exams`,
          state: { activeTab: 'completed', examId: examId, submissionId: submissionId }
        }
      );
      
      await client.query('COMMIT');
      res.json({ message: "Exam rechecked successfully", submission: updatedSubmission.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Recheck exam error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Get grade change history for a submission (professor only)
router.get("/:examId/submissions/:submissionId/history", authorize, async (req, res) => {
  try {
    const { examId, submissionId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only professors can view grade history
    if (userRole !== 'professor') {
      return res.status(403).json({ error: "Only professors can view grade history." });
    }

    // Check if the professor has access to this exam
    const examCheck = await pool.query(
      `SELECT e.*, c.course_id, c.professor_id 
       FROM exam e 
       JOIN course c ON e.course_id = c.course_id 
       WHERE e.exam_id = $1`,
      [examId]
    );

    if (examCheck.rows.length === 0) {
      return res.status(404).json({ error: "Exam not found." });
    }

    if (examCheck.rows[0].professor_id !== userId) {
      return res.status(403).json({ error: "You don't have access to this exam's submissions." });
    }

    // Get the grade change history
    const history = await pool.query(
      `SELECT gcl.*, u.first_name, u.last_name
       FROM grade_change_log gcl
       JOIN users u ON gcl.professor_id = u.user_id
       WHERE gcl.submission_id = $1
       ORDER BY gcl.changed_at DESC`,
      [submissionId]
    );

    res.json(history.rows);
  } catch (err) {
    console.error("Get grade history error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Get the recheck reason for a submission (professor only)
router.get("/:examId/submissions/:submissionId/recheck-reason", authorize, async (req, res) => {
  try {
    const { examId, submissionId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only professors can view recheck reasons
    if (userRole !== 'professor') {
      return res.status(403).json({ error: "Only professors can view recheck reasons." });
    }

    // Check if the professor has access to this exam
    const examCheck = await pool.query(
      `SELECT e.*, c.course_id, c.professor_id 
       FROM exam e 
       JOIN course c ON e.course_id = c.course_id 
       WHERE e.exam_id = $1`,
      [examId]
    );

    if (examCheck.rows.length === 0) {
      return res.status(404).json({ error: "Exam not found." });
    }

    if (examCheck.rows[0].professor_id !== userId) {
      return res.status(403).json({ error: "You don't have access to this exam's submissions." });
    }

    // Get the recheck reason from the new table
    const recheckRequest = await pool.query(
      `SELECT reason
       FROM exam_recheck_request
       WHERE submission_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [submissionId]
    );

    if (recheckRequest.rows.length > 0) {
      return res.json({ reason: recheckRequest.rows[0].reason });
    }

    return res.json({ reason: "No recheck request found" });
  } catch (err) {
    console.error("Get recheck reason error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Update the status of a recheck request (professor only)
router.put("/:examId/submissions/:submissionId/status", authorize, async (req, res) => {
  try {
    const { examId, submissionId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validate the status
    const validStatuses = ['graded', 'recheck_requested', 'rechecking', 'recheck_completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    // Only professors can update submission status
    if (userRole !== 'professor') {
      return res.status(403).json({ error: "Only professors can update submission status." });
    }

    // Check if the professor has access to this exam
    const examCheck = await pool.query(
      `SELECT e.*, c.course_id, c.professor_id 
       FROM exam e 
       JOIN course c ON e.course_id = c.course_id 
       WHERE e.exam_id = $1`,
      [examId]
    );

    if (examCheck.rows.length === 0) {
      return res.status(404).json({ error: "Exam not found." });
    }

    if (examCheck.rows[0].professor_id !== userId) {
      return res.status(403).json({ error: "You don't have access to this exam's submissions." });
    }

    // Verify the submission exists
    const submissionCheck = await pool.query(
      "SELECT * FROM exam_submission WHERE submission_id = $1 AND exam_id = $2",
      [submissionId, examId]
    );

    if (submissionCheck.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found." });
    }

    // Start a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update the submission status
      const result = await client.query(
        `UPDATE exam_submission 
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE submission_id = $2
         RETURNING *`,
        [status, submissionId]
      );
      
      // Also update the recheck_request status
      if (status === 'rechecking') {
        await client.query(
          `UPDATE exam_recheck_request
           SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
           WHERE submission_id = $1 
           AND status = 'pending'`,
          [submissionId]
        );
      } else if (status === 'recheck_completed') {
        await client.query(
          `UPDATE exam_recheck_request
           SET status = 'completed', updated_at = CURRENT_TIMESTAMP
           WHERE submission_id = $1 
           AND status = 'in_progress'`,
          [submissionId]
        );
      }

      // If status is changed to 'rechecking', notify the student
      if (status === 'rechecking') {
        const studentId = submissionCheck.rows[0].student_id;
        const examTitle = examCheck.rows[0].title;
        
        await notificationService.createNotification(
          studentId,
          'grade',
          `Your grade recheck request for ${examTitle} is now being processed`,
          {
            exam_id: examId,
            course_id: examCheck.rows[0].course_id,
            submission_id: submissionId,
            type: 'exam_grade',
            redirect_url: `/courses/${examCheck.rows[0].course_id}/exams`,
            state: { 
              activeTab: 'completed', 
              examId: examId,
              submissionId: submissionId,
              showCompletedOnly: true
            }
          }
        );
      }
      
      // If status is changed to 'recheck_completed', notify the student
      if (status === 'recheck_completed') {
        const studentId = submissionCheck.rows[0].student_id;
        const examTitle = examCheck.rows[0].title;
        
        await notificationService.createNotification(
          studentId, 
          'grade',
          `Your grade recheck for ${examTitle} has been completed`,
          {
            exam_id: examId,
            course_id: examCheck.rows[0].course_id,
            submission_id: submissionId,
            type: 'exam_grade',
            redirect_url: `/courses/${examCheck.rows[0].course_id}/exams`,
            state: { 
              activeTab: 'completed', 
              examId: examId,
              submissionId: submissionId,
              showCompletedOnly: true  // This ensures we show the completed exam
            }
          }
        );
      }
      
      await client.query('COMMIT');

      res.json({
        message: "Submission status updated successfully",
        submission: result.rows[0]
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Update submission status error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router; 