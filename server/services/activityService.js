const pool = require("../db");

/**
 * Service to track and log student activities for the Decision Support System
 */
const activityService = {
  /**
   * Log a student activity
   * @param {string} studentId - UUID of the student
   * @param {number} courseId - Course ID
   * @param {string} activityType - Type of activity
   * @param {object} details - Additional details about the activity
   * @returns {Promise<object>} The created activity record
   */
  async logActivity(studentId, courseId, activityType, details = {}) {
    try {
      const result = await pool.query(
        `INSERT INTO student_activity (student_id, course_id, activity_type, details)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [studentId, courseId, activityType, details]
      );
      return result.rows[0];
    } catch (err) {
      console.error("Error logging student activity:", err.message);
      throw err;
    }
  },
  
  /**
   * Log exam-related activity
   * @param {string} studentId - UUID of the student
   * @param {number} examId - Exam ID
   * @param {string} activityType - Type of exam activity (exam_start, exam_submission)
   * @param {object} additionalDetails - Additional details
   * @returns {Promise<object>} The created activity record
   */
  async logExamActivity(studentId, examId, activityType, additionalDetails = {}) {
    try {
      // Get course ID from exam
      const examResult = await pool.query(
        "SELECT course_id FROM exam WHERE exam_id = $1",
        [examId]
      );
      
      if (examResult.rows.length === 0) {
        throw new Error("Exam not found");
      }
      
      const courseId = examResult.rows[0].course_id;
      
      // Log the activity with exam details
      return this.logActivity(studentId, courseId, activityType, {
        exam_id: examId,
        ...additionalDetails
      });
    } catch (err) {
      console.error("Error logging exam activity:", err.message);
      throw err;
    }
  },
  
  /**
   * Get student activity statistics for a course
   * @param {number} courseId - Course ID
   * @param {string} studentId - Optional student ID to filter by
   * @returns {Promise<object[]>} Activity statistics
   */
  async getCourseActivityStats(courseId, studentId = null) {
    try {
      let query = `
        SELECT 
          student_id,
          COUNT(*) as total_activities,
          COUNT(DISTINCT DATE(created_at)) as active_days,
          COUNT(CASE WHEN activity_type = 'exam_start' THEN 1 END) as exams_started,
          COUNT(CASE WHEN activity_type = 'exam_submission' THEN 1 END) as exams_submitted,
          COUNT(CASE WHEN activity_type = 'assignment_view' THEN 1 END) as assignments_viewed,
          COUNT(CASE WHEN activity_type = 'assignment_submission' THEN 1 END) as assignments_submitted,
          MAX(created_at) as last_activity
        FROM student_activity
        WHERE course_id = $1
      `;
      
      const params = [courseId];
      
      // Add student filter if provided
      if (studentId) {
        query += " AND student_id = $2";
        params.push(studentId);
      }
      
      query += " GROUP BY student_id";
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (err) {
      console.error("Error getting course activity statistics:", err.message);
      throw err;
    }
  }
};

module.exports = activityService; 