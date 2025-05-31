const express = require("express");
const router = express.Router();
const pool = require("../../db");
const authorize = require("../../middleware/authorize");
const professorOnly = require("../../middleware/professorOnly");

// Get aggregate student analytics across all exams in a course
router.get("/analytics/aggregate/:courseId", authorize, professorOnly, async (req, res) => {
  try {
    const { courseId } = req.params;
    const professorId = req.user.id;
    const includeNonParticipants = req.query.includeNonParticipants === 'true';
    
    // Verify professor has access to this course
    const courseCheck = await pool.query(
      `SELECT * FROM course WHERE course_id = $1 AND professor_id = $2`,
      [courseId, professorId]
    );
    
    if (courseCheck.rows.length === 0) {
      return res.status(403).json({ error: "You don't have access to this course's analytics" });
    }
    
    // Calculate total possible points across all published exams in the course
    const totalPossiblePointsResult = await pool.query(
      `SELECT COALESCE(SUM(eq.points), 0) as total_course_points
       FROM exam e
       JOIN exam_question eq ON e.exam_id = eq.exam_id
       WHERE e.course_id = $1 AND e.is_published = true`,
      [courseId]
    );
    
    const totalCoursePoints = totalPossiblePointsResult.rows[0].total_course_points;
    
    // For aggregate view across all exams, we'll get submissions and optionally add enrolled students
    let aggregatedSubmissions;
    
    if (includeNonParticipants) {
      // Get all enrolled students with their exam participation
      // This query joins enrolled students with their submissions (if any)
      aggregatedSubmissions = (await pool.query(
        `SELECT 
           u.user_id AS student_id,
           CONCAT(u.first_name, ' ', u.last_name) AS name,
           u.email,
           COUNT(DISTINCT es_data.exam_id) AS exams_taken,
           COALESCE(SUM(es_data.score), 0) AS total_score,
           $1::numeric AS total_possible_points,
           CASE WHEN $1::numeric > 0 
                THEN ROUND((COALESCE(SUM(es_data.score), 0) / $1::numeric) * 100)
                ELSE 0 
           END AS percentage
         FROM enrollment ce
         JOIN users u ON ce.student_id = u.user_id
         LEFT JOIN (
           SELECT 
             e.exam_id, 
             e.course_id, 
             es.submission_id,
             es.student_id,
             es.score,
             es.total_points,
             es.submitted_at,
             es.is_graded
           FROM exam e
           LEFT JOIN exam_submission es ON e.exam_id = es.exam_id AND es.is_graded = true
           WHERE e.course_id = $2
         ) es_data ON ce.student_id = es_data.student_id
         WHERE ce.course_id = $2
         GROUP BY u.user_id, u.first_name, u.last_name, u.email
         ORDER BY total_score DESC`,
        [totalCoursePoints, courseId]
      )).rows;
    } else {
      // Original query - only students who have submitted at least one exam
      aggregatedSubmissions = (await pool.query(
        `SELECT 
           u.user_id AS student_id,
           CONCAT(u.first_name, ' ', u.last_name) AS name,
           u.email,
           COUNT(DISTINCT e.exam_id) AS exams_taken,
           SUM(es.score) AS total_score,
           $1::numeric AS total_possible_points,
           CASE WHEN $1::numeric > 0 
                THEN ROUND((SUM(es.score) / $1::numeric) * 100)
                ELSE 0 
           END AS percentage
         FROM exam_submission es
         JOIN users u ON es.student_id = u.user_id
         JOIN exam e ON es.exam_id = e.exam_id
         WHERE e.course_id = $2 AND es.is_graded = true
         GROUP BY u.user_id, u.first_name, u.last_name, u.email
         ORDER BY total_score DESC`,
        [totalCoursePoints, courseId]
      )).rows;
    }
    
    // Calculate statistics
    let stats = {};
    
    if (aggregatedSubmissions.length > 0) {
      const scores = aggregatedSubmissions.map(s => s.total_score);
      
      // Calculate mode (most common score)
      const scoreFrequency = {};
      let maxFrequency = 0;
      let modeScore = null;
      
      scores.forEach(score => {
        scoreFrequency[score] = (scoreFrequency[score] || 0) + 1;
        if (scoreFrequency[score] > maxFrequency) {
          maxFrequency = scoreFrequency[score];
          modeScore = score;
        }
      });
      
      stats = {
        highest_score: Math.max(...scores),
        lowest_score: Math.min(...scores),
        average_score: scores.reduce((sum, score) => sum + Number(score), 0) / scores.length,
        median_score: calculateMedian(scores),
        mode_score: modeScore,
        mode_frequency: maxFrequency,
        total_submissions: aggregatedSubmissions.length,
        total_course_points: totalCoursePoints
      };
    }
    
    // Add percentile, rank, and performance metrics
    const aggregatedWithRank = aggregatedSubmissions.map((student, index) => {
      const percentage = student.percentage || 0;
      const performance = 
        percentage < 70 ? 'Poor' : 
        percentage <= 80 ? 'Fair' :
        percentage <= 90 ? 'Satisfactory' : 'Outstanding';
        
      return {
        ...student,
        rank: index + 1,
        score: student.total_score,
        total_points: student.total_possible_points,
        percentile: aggregatedSubmissions.length > 1 ? 
          Math.round(((aggregatedSubmissions.length - (index + 1)) / aggregatedSubmissions.length) * 100) : 0,
        performance
      };
    });
    
    // Get course title
    const courseTitle = courseCheck.rows[0].title || "Course";
    
    // Find difficult topics/areas across all exams
    const difficultQuestionsResult = await pool.query(
      `SELECT 
         eq.question_id,
         eq.question_text,
         eq.type,
         e.title AS exam_title,
         COUNT(eq.question_id) AS total_attempts,
         SUM(CASE WHEN sa.is_correct = false THEN 1 ELSE 0 END) AS incorrect_count,
         ROUND((SUM(CASE WHEN sa.is_correct = false THEN 1 ELSE 0 END)::numeric / COUNT(eq.question_id)) * 100, 1) AS difficulty_percentage
       FROM exam_submission es
       JOIN exam e ON es.exam_id = e.exam_id
       JOIN exam_question eq ON e.exam_id = eq.exam_id
       JOIN student_answer sa ON eq.question_id = sa.question_id AND es.submission_id = sa.submission_id
       WHERE e.course_id = $1 AND es.is_graded = true
       GROUP BY eq.question_id, eq.question_text, eq.type, e.title
       HAVING COUNT(eq.question_id) >= 5
       ORDER BY difficulty_percentage DESC
       LIMIT 10`,
      [courseId]
    );
    
    res.json({
      course_id: courseId,
      exam_title: `${courseTitle} - All Exams`, // Custom title for aggregate view
      statistics: stats,
      rankings: aggregatedWithRank,
      difficulty_analysis: {
        difficult_questions: difficultQuestionsResult.rows,
        analysis_note: "Questions with highest incorrect answer rate (minimum 5 attempts)"
      },
      include_non_participants: includeNonParticipants,
      total_course_points: totalCoursePoints
    });
    
  } catch (err) {
    console.error("Aggregate analytics error:", err.message);
    res.status(500).json({ error: "Server error generating aggregate analytics" });
  }
});

// Get student analytics for a specific exam
router.get("/analytics/:examId", authorize, professorOnly, async (req, res) => {
  try {
    const { examId } = req.params;
    const professorId = req.user.id;
    const includeNonParticipants = req.query.includeNonParticipants === 'true';
    
    // Verify professor has access to this exam
    const examCheck = await pool.query(
      `SELECT e.*, c.course_id, c.professor_id 
       FROM exam e 
       JOIN course c ON e.course_id = c.course_id 
       WHERE e.exam_id = $1`,
      [examId]
    );
    
    if (examCheck.rows.length === 0) {
      return res.status(404).json({ error: "Exam not found" });
    }
    
    if (examCheck.rows[0].professor_id !== professorId) {
      return res.status(403).json({ error: "You don't have access to this exam's analytics" });
    }

    const courseId = examCheck.rows[0].course_id;
    let submissions;

    // Check if the exam is past due
    const now = new Date();
    const isDueOver = examCheck.rows[0].due_date && new Date(examCheck.rows[0].due_date) < now;
    
    if (includeNonParticipants && isDueOver) {
      // Include enrolled students who have not taken the exam with zero scores
      submissions = (await pool.query(
        `SELECT 
           ce.student_id,
           CONCAT(u.first_name, ' ', u.last_name) as name,
           u.email,
           COALESCE(es.submission_id, 0) as submission_id,
           COALESCE(es.score, 0) as score,
           COALESCE(es.total_points, 
             (SELECT SUM(points) FROM exam_question WHERE exam_id = $1)) as total_points,
           CASE 
             WHEN es.submission_id IS NOT NULL AND es.total_points > 0 
               THEN ROUND((es.score / es.total_points) * 100)
             ELSE 0 
           END as percentage,
           COALESCE(es.submitted_at, NULL) as submitted_at,
           COALESCE(es.is_graded, false) as is_graded,
           CASE WHEN es.submission_id IS NULL THEN true ELSE false END as non_participant,
           $3::boolean as is_due_over
         FROM enrollment ce
         JOIN users u ON ce.student_id = u.user_id
         LEFT JOIN exam_submission es ON ce.student_id = es.student_id AND es.exam_id = $1 AND es.is_graded = true
         WHERE ce.course_id = $2
         ORDER BY score DESC`,
        [examId, courseId, isDueOver]
      )).rows;
    } else {
      // Original query - only students who have submitted the exam
      submissions = (await pool.query(
        `SELECT 
           es.submission_id,
           es.student_id,
           CONCAT(u.first_name, ' ', u.last_name) as name,
           u.email,
           es.score,
           es.total_points,
           CASE WHEN es.total_points > 0 
                THEN ROUND((es.score / es.total_points) * 100)
                ELSE 0 
           END as percentage,
           es.submitted_at,
           es.is_graded,
           false as non_participant,
           $2::boolean as is_due_over
         FROM exam_submission es
         JOIN users u ON es.student_id = u.user_id
         WHERE es.exam_id = $1 AND es.is_graded = true
         ORDER BY es.score DESC`,
        [examId, isDueOver]
      )).rows;
    }
    
    // Calculate statistics
    let stats = {};
    
    if (submissions.length > 0) {
      const scores = submissions.map(s => s.score);
      
      // Calculate mode (most common score)
      const scoreFrequency = {};
      let maxFrequency = 0;
      let modeScore = null;
      
      scores.forEach(score => {
        scoreFrequency[score] = (scoreFrequency[score] || 0) + 1;
        if (scoreFrequency[score] > maxFrequency) {
          maxFrequency = scoreFrequency[score];
          modeScore = score;
        }
      });
      
      stats = {
        highest_score: Math.max(...scores),
        lowest_score: Math.min(...scores),
        average_score: scores.reduce((sum, score) => sum + Number(score), 0) / scores.length,
        median_score: calculateMedian(scores),
        mode_score: modeScore,
        mode_frequency: maxFrequency,
        total_submissions: submissions.length,
        participants: submissions.filter(s => !s.non_participant).length,
        non_participants: submissions.filter(s => s.non_participant).length,
        total_points: submissions[0].total_points
      };
    }
    
    // Add percentile and rank to each submission
    const submissionsWithRank = submissions.map((submission, index) => {
      const percentage = submission.percentage || 0;
      const performance = 
        percentage < 70 ? 'Poor' : 
        percentage <= 80 ? 'Fair' :
        percentage <= 90 ? 'Satisfactory' : 'Outstanding';
        
      return {
        ...submission,
        rank: index + 1,
        percentile: submissions.length > 1 ? 
          Math.round(((submissions.length - (index + 1)) / submissions.length) * 100) : 0,
        performance
      };
    });
    
    // Get question difficulty analysis for this exam
    const questionDifficultyResult = await pool.query(
      `SELECT 
         q.question_id,
         q.question_text,
         q.type,
         q.points,
         COUNT(sa.question_id) AS total_attempts,
         SUM(CASE WHEN sa.is_correct = false THEN 1 ELSE 0 END) AS incorrect_count,
         ROUND((SUM(CASE WHEN sa.is_correct = false THEN 1 ELSE 0 END)::numeric / COUNT(sa.question_id)) * 100, 1) AS difficulty_percentage
       FROM exam_question q
       JOIN student_answer sa ON q.question_id = sa.question_id
       JOIN exam_submission es ON sa.submission_id = es.submission_id
       WHERE q.exam_id = $1 AND es.is_graded = true
       GROUP BY q.question_id, q.question_text, q.type, q.points
       ORDER BY difficulty_percentage DESC`,
      [examId]
    );
    
    res.json({
      exam_id: examId,
      exam_title: examCheck.rows[0].title,
      course_id: courseId,
      due_date: examCheck.rows[0].due_date,
      is_due_over: isDueOver,
      statistics: stats,
      rankings: submissionsWithRank,
      difficulty_analysis: {
        difficult_questions: questionDifficultyResult.rows,
        analysis_note: "Questions ordered by incorrect answer rate"
      },
      include_non_participants: includeNonParticipants
    });
    
  } catch (err) {
    console.error("Student analytics error:", err.message);
    res.status(500).json({ error: "Server error generating analytics" });
  }
});

// For backward compatibility - redirect old rankings endpoints to new analytics endpoints
router.get("/rankings/aggregate/:courseId", (req, res) => {
  res.redirect(`/dss/exams/analytics/aggregate/${req.params.courseId}`);
});

router.get("/rankings/:examId", (req, res) => {
  res.redirect(`/dss/exams/analytics/${req.params.examId}`);
});

// Helper function to calculate median
function calculateMedian(scores) {
  const sortedScores = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sortedScores.length / 2);
  
  if (sortedScores.length % 2 === 0) {
    return (Number(sortedScores[mid - 1]) + Number(sortedScores[mid])) / 2;
  } else {
    return Number(sortedScores[mid]);
  }
}

module.exports = router; 