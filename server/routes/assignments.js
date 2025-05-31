const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const authorize = require('../middleware/authorize');
const notificationService = require('../services/notificationService');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/assignments';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = uuidv4();
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB limit
  }
});

// Get all assignments for a course
router.get('/:courseId', authorize, async (req, res) => {
  try {
    const { courseId } = req.params;
    console.log('Fetching assignments for course:', courseId); // Debug log

    const result = await pool.query(
      `SELECT a.*, 
              u.first_name as author_first_name,
              u.last_name as author_last_name,
              COALESCE(json_agg(
                CASE WHEN aa.attachment_id IS NOT NULL THEN
                  json_build_object(
                    'attachment_id', aa.attachment_id,
                    'file_name', aa.file_name,
                    'file_path', aa.file_path,
                    'file_size', aa.file_size,
                    'mime_type', aa.mime_type,
                    'type', CASE WHEN aa.mime_type = 'link' THEN 'link' ELSE 'file' END,
                    'isLink', aa.mime_type = 'link',
                    'file_type', CASE WHEN aa.mime_type = 'link' THEN 'link' ELSE aa.mime_type END
                  )
                ELSE NULL END
              ) FILTER (WHERE aa.attachment_id IS NOT NULL), '[]') as attachments
       FROM assignment a
       LEFT JOIN users u ON a.author_id = u.user_id
       LEFT JOIN assignment_attachment aa ON a.assignment_id = aa.assignment_id
       WHERE a.course_id = $1
       GROUP BY a.assignment_id, u.first_name, u.last_name
       ORDER BY a.created_at DESC`,
      [courseId]
    );

    console.log('Query result:', result.rows.length, 'assignments found'); // Debug log

    // Transform the result to match the expected format
    const assignments = result.rows.map(row => {
      // Process attachments to add file_url and handle links
      let attachments = [];
      if (row.attachments && row.attachments[0] && row.attachments[0].file_path) {
        attachments = row.attachments.map(attachment => {
          if (attachment.mime_type === 'link') {
            // For links, use the file_path (which contains the URL) as both file_url and file_name
            return {
              ...attachment,
              file_url: attachment.file_path, // The URL is stored in file_path for links
              type: 'link',
              isLink: true,
              file_type: 'link'
            };
          } else {
            // For files, convert file path to URL - remove 'uploads/' from the beginning since it's part of the route
            const filePath = attachment.file_path.replace(/^uploads\//, '');
            return {
              ...attachment,
              file_url: `/uploads/${filePath}`,
              type: 'file',
              isLink: false,
              file_type: attachment.mime_type
            };
          }
        });
      }

      return {
        assignment_id: row.assignment_id,
        course_id: row.course_id,
        title: row.title,
        description: row.description,
        due_date: row.due_date,
        points: row.points,
        created_at: row.created_at,
        updated_at: row.updated_at,
        accepting_submission: row.accepting_submission !== false, // Include accepting_submission with default true if null
        author: {
          first_name: row.author_first_name,
          last_name: row.author_last_name
        },
        attachments: attachments
      };
    });

    res.json(assignments);
  } catch (err) {
    console.error('Error in GET /:courseId:', err);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Create a new assignment
router.post('/:courseId', authorize, upload.array('files'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { courseId } = req.params;
    const { title, description, due_date, points, links } = req.body;
    const { id } = req.user; // Get user_id from verified token
    const files = req.files || [];

    // Validate course exists and user has access
    const courseCheck = await client.query(
      'SELECT course_id FROM course WHERE course_id = $1',
      [courseId]
    );
    if (courseCheck.rows.length === 0) {
      throw new Error('Course not found');
    }

    // Validate required fields
    if (!title) {
      throw new Error('Title is required');
    }

    console.log('Creating assignment with data:', {
      courseId,
      title,
      description,
      due_date,
      points,
      author_id: id,
      files_count: files.length,
      links: links ? JSON.parse(links) : []
    });

    // Insert assignment
    const assignmentResult = await client.query(
      `INSERT INTO assignment (course_id, author_id, title, description, due_date, points)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING assignment_id`,
      [courseId, id, title, description, due_date, points]
    );

    const assignmentId = assignmentResult.rows[0].assignment_id;

    // Insert file attachments if any
    if (files.length > 0) {
      const attachmentValues = files.map(file => [
        assignmentId,
        file.originalname,
        file.path,
        file.size,
        file.mimetype
      ]);

      await client.query(
        `INSERT INTO assignment_attachment 
         (assignment_id, file_name, file_path, file_size, mime_type)
         VALUES ${attachmentValues.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(',')}`,
        attachmentValues.flat()
      );
    }

    // Insert link attachments if any
    if (links) {
      try {
        const linkAttachments = JSON.parse(links);
        if (Array.isArray(linkAttachments) && linkAttachments.length > 0) {
          const linkValues = linkAttachments.map(link => [
            assignmentId,
            link.url || link.name, // Use URL as the file_name
            link.url || link.name, // Use URL as the file_path for links
            0, // Links have no file size
            'link' // Use 'link' as mime_type to identify it as a link
          ]);

          await client.query(
            `INSERT INTO assignment_attachment 
             (assignment_id, file_name, file_path, file_size, mime_type)
             VALUES ${linkValues.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(',')}`,
            linkValues.flat()
          );
        }
      } catch (error) {
        console.error('Error parsing links:', error);
        // Don't fail the entire operation if links fail to parse
      }
    }

    await client.query('COMMIT');
    
    // Send response
    res.json({ 
      message: 'Assignment created successfully', 
      assignment_id: assignmentId 
    });
    
    // Notify students about the new assignment
    try {
      await notificationService.notifyStudentsAboutNewAssignment(courseId, title, description, due_date, points, assignmentId);
    } catch (notifError) {
      console.error('Error sending notifications:', notifError);
      // Don't fail the operation if notifications fail
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating assignment:', err);
    res.status(500).json({ 
      error: 'Failed to create assignment',
      details: err.message 
    });
  } finally {
    client.release();
  }
});

// Update an assignment
router.put('/:assignmentId', authorize, upload.array('files'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { assignmentId } = req.params;
    const { title, description, due_date, points, links } = req.body;
    const files = req.files || [];

    // Update assignment
    await client.query(
      `UPDATE assignment
       SET title = $1, description = $2, due_date = $3, points = $4
       WHERE assignment_id = $5`,
      [title, description, due_date === '' ? null : due_date, points, assignmentId]
    );

    // Delete existing attachments if requested
    if (req.body.delete_attachments) {
      const attachmentsToDelete = JSON.parse(req.body.delete_attachments);
      for (const attachmentId of attachmentsToDelete) {
        const result = await client.query(
          'SELECT file_path FROM assignment_attachment WHERE attachment_id = $1',
          [attachmentId]
        );
        if (result.rows[0]) {
          // Only delete actual files, not links
          if (result.rows[0].file_path && !result.rows[0].file_path.startsWith('http')) {
            try {
              fs.unlinkSync(result.rows[0].file_path);
            } catch (error) {
              console.error('Error deleting file:', error);
              // Continue anyway
            }
          }
        }
        await client.query(
          'DELETE FROM assignment_attachment WHERE attachment_id = $1',
          [attachmentId]
        );
      }
    }

    // Add new file attachments
    if (files.length > 0) {
      const attachmentValues = files.map(file => [
        assignmentId,
        file.originalname,
        file.path,
        file.size,
        file.mimetype
      ]);

      await client.query(
        `INSERT INTO assignment_attachment 
         (assignment_id, file_name, file_path, file_size, mime_type)
         VALUES ${attachmentValues.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(',')}`,
        attachmentValues.flat()
      );
    }

    // Add new link attachments if any
    if (links) {
      try {
        const linkAttachments = JSON.parse(links);
        if (Array.isArray(linkAttachments) && linkAttachments.length > 0) {
          const linkValues = linkAttachments.map(link => [
            assignmentId,
            link.url || link.name, // Use URL as the file_name
            link.url || link.name, // Use URL as the file_path for links
            0, // Links have no file size
            'link' // Use 'link' as mime_type to identify it as a link
          ]);

          await client.query(
            `INSERT INTO assignment_attachment 
             (assignment_id, file_name, file_path, file_size, mime_type)
             VALUES ${linkValues.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(',')}`,
            linkValues.flat()
          );
        }
      } catch (error) {
        console.error('Error parsing links:', error);
        // Don't fail the entire operation if links fail to parse
      }
    }

    await client.query('COMMIT');
    
    // Send response
    res.json({ message: 'Assignment updated successfully' });
    
    // Notify students about the updated assignment
    try {
      await notificationService.notifyStudentsAboutAssignmentUpdate(assignmentId, title, description, due_date, points);
    } catch (notifError) {
      console.error('Error sending update notifications:', notifError);
      // Don't fail the operation if notifications fail
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating assignment:', err);
    res.status(500).json({ error: 'Failed to update assignment' });
  } finally {
    client.release();
  }
});

// Delete an assignment
router.delete('/:assignmentId', authorize, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { assignmentId } = req.params;

    // Get all attachment paths
    const attachmentsResult = await client.query(
      'SELECT file_path FROM assignment_attachment WHERE assignment_id = $1',
      [assignmentId]
    );

    // Delete files from storage
    for (const attachment of attachmentsResult.rows) {
      if (fs.existsSync(attachment.file_path)) {
        fs.unlinkSync(attachment.file_path);
      }
    }

    // Delete assignment (cascade will handle attachments and submissions)
    await client.query(
      'DELETE FROM assignment WHERE assignment_id = $1',
      [assignmentId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Assignment deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Submit an assignment
router.post('/:assignmentId/submit', authorize, upload.array('files'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { assignmentId } = req.params;
    const { links } = req.body; // Add links parameter
    const { id } = req.user;
    const files = req.files || [];

    console.log(`Submitting assignment ${assignmentId} for user ${id} with ${files.length} files and links:`, links ? JSON.parse(links) : []);

    // Allow submissions with either files or links
    if (files.length === 0 && !links) {
      throw new Error('No files or links submitted');
    }

    // Check if the assignment exists and is accepting submissions
    const assignmentCheck = await client.query(
      `SELECT assignment_id, accepting_submission, due_date 
       FROM assignment 
       WHERE assignment_id = $1`,
      [assignmentId]
    );

    if (assignmentCheck.rows.length === 0) {
      throw new Error('Assignment not found');
    }

    const assignment = assignmentCheck.rows[0];
    
    // Check if assignment is accepting submissions
    if (assignment.accepting_submission === false) {
      return res.status(403).json({ 
        error: 'This assignment is not accepting submissions at this time' 
      });
    }

    // Check if submission due date has passed
    // Only check due date if assignment is not explicitly set to accept submissions
    // This allows instructors to override due dates by toggling "accepting submissions"
    if (assignment.due_date && assignment.accepting_submission !== true) {
      const now = new Date();
      const dueDate = new Date(assignment.due_date);
      if (now > dueDate) {
        return res.status(403).json({ 
          error: 'The due date for this assignment has passed' 
        });
      }
    }

    // Check if submission already exists
    const existingSubmission = await client.query(
      `SELECT submission_id FROM assignment_submission 
       WHERE assignment_id = $1 AND student_id = $2`,
      [assignmentId, id]
    );

    let submissionId;

    if (existingSubmission.rows.length > 0) {
      // Update existing submission
      submissionId = existingSubmission.rows[0].submission_id;
      console.log(`Updating existing submission ${submissionId}`);
      
      // Delete old attachments before adding new ones
      await client.query(
        'DELETE FROM submission_attachment WHERE submission_id = $1',
        [submissionId]
      );
      
      await client.query(
        `UPDATE assignment_submission
         SET submitted_at = CURRENT_TIMESTAMP
         WHERE submission_id = $1`,
        [submissionId]
      );
    } else {
      // Insert new submission
      console.log(`Creating new submission for assignment ${assignmentId} by student ${id}`);
      const submissionResult = await client.query(
        `INSERT INTO assignment_submission (assignment_id, student_id)
         VALUES ($1, $2)
         RETURNING submission_id`,
        [assignmentId, id]
      );

      submissionId = submissionResult.rows[0].submission_id;
      console.log(`Created new submission with ID ${submissionId}`);
    }

    // Insert file attachments
    if (files.length > 0) {
      console.log(`Adding ${files.length} file attachments to submission ${submissionId}`);
      const attachmentValues = files.map(file => [
        submissionId,
        file.originalname,
        file.path,
        file.size,
        file.mimetype
      ]);

      const placeholders = attachmentValues.map((_, i) => 
        `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
      ).join(',');

      const query = `
        INSERT INTO submission_attachment 
        (submission_id, file_name, file_path, file_size, mime_type)
        VALUES ${placeholders}
      `;

      await client.query(query, attachmentValues.flat());
    }

    // Insert link attachments if any
    if (links) {
      try {
        const linkAttachments = JSON.parse(links);
        if (Array.isArray(linkAttachments) && linkAttachments.length > 0) {
          console.log(`Adding ${linkAttachments.length} link attachments to submission ${submissionId}`);
          const linkValues = linkAttachments.map(link => [
            submissionId,
            link.url || link.name, // Use URL as the file_name
            link.url || link.name, // Use URL as the file_path for links
            0, // Links have no file size
            'link' // Use 'link' as mime_type to identify it as a link
          ]);

          const linkPlaceholders = linkValues.map((_, i) => 
            `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
          ).join(',');

          const linkQuery = `
            INSERT INTO submission_attachment 
            (submission_id, file_name, file_path, file_size, mime_type)
            VALUES ${linkPlaceholders}
          `;

          await client.query(linkQuery, linkValues.flat());
        }
      } catch (error) {
        console.error('Error parsing links:', error);
        // Don't fail the entire operation if links fail to parse
      }
    }

    await client.query('COMMIT');
    
    // Send response
    res.json({ 
      message: 'Submission successful', 
      submission_id: submissionId 
    });
    
    // Notify instructor about the new submission
    try {
      await notificationService.notifyStudentsAboutNewSubmission(assignmentId, id);
    } catch (notifError) {
      console.error('Error sending submission notification:', notifError);
      // Don't fail the operation if notifications fail
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error submitting assignment:', err);
    res.status(500).json({ 
      error: 'Failed to submit assignment',
      details: err.message 
    });
  } finally {
    client.release();
  }
});

// Get submissions for an assignment
router.get('/:assignmentId/submissions', authorize, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    
    console.log('Fetching submissions for assignment:', assignmentId);
    
    // First get all submissions
    const submissionsResult = await pool.query(
      `SELECT s.*, u.first_name, u.last_name
       FROM assignment_submission s
       JOIN users u ON s.student_id = u.user_id
       WHERE s.assignment_id = $1
       ORDER BY s.submitted_at DESC`,
      [assignmentId]
    );
    
    const submissions = submissionsResult.rows;
    console.log(`Found ${submissions.length} submissions for assignment ${assignmentId}`);
    
    // If there are submissions, get their attachments
    if (submissions.length > 0) {
      // For each submission, get its attachments
      for (const submission of submissions) {
        const attachmentsResult = await pool.query(
          `SELECT attachment_id, file_name, file_path, file_size, mime_type
           FROM submission_attachment
           WHERE submission_id = $1`,
          [submission.submission_id]
        );
        
        // Process attachments to handle both files and links
        const files = attachmentsResult.rows.map(attachment => {
          if (attachment.mime_type === 'link') {
            // For links, the URL is stored in file_path
            return {
              ...attachment,
              file_url: attachment.file_path, // The URL is stored in file_path for links
              isLink: true,
              type: 'link',
              file_type: 'link'
            };
          } else {
            // For files, convert file path to URL
            const filePath = attachment.file_path.replace(/^uploads\//, '');
            return {
              ...attachment,
              file_url: `/uploads/${filePath}`,
              isLink: false,
              type: 'file',
              file_type: attachment.mime_type
            };
          }
        });
        
        submission.files = files || [];
      }
    }
    
    res.json(submissions);
  } catch (err) {
    console.error('Error fetching submissions:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Grade a submission
router.post('/submissions/:submissionId/grade', authorize, async (req, res) => {
  try {
    const { submissionId } = req.params;
    let { grade, feedback } = req.body;

    // Fetch assignment points and current grade
    const submissionRes = await pool.query(
      `SELECT s.grade AS current_grade, a.points
       FROM assignment_submission s
       JOIN assignment a ON s.assignment_id = a.assignment_id
       WHERE s.submission_id = $1`,
      [submissionId]
    );
    if (submissionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    const { current_grade, points } = submissionRes.rows[0];
    const maxPoints = points || 100;

    // Validate grade is numeric and in range
    if (grade === undefined || grade === null || grade === '') {
      return res.status(400).json({ error: 'Grade is required' });
    }
    if (isNaN(Number(grade)) || Number(grade) < 0 || Number(grade) > maxPoints) {
      return res.status(400).json({ error: `Grade must be a number between 0 and ${maxPoints}` });
    }
    // Prevent duplicate return unless grade is changed
    if (current_grade !== null && current_grade !== undefined && current_grade.toString() === grade.toString()) {
      // Grade is the same as before
      const updateRes = await pool.query(
        `UPDATE assignment_submission SET feedback = $1 WHERE submission_id = $2`,
        [feedback, submissionId]
      );
      return res.status(200).json({ message: 'Feedback updated, grade unchanged' });
    }

    await pool.query(
      `UPDATE assignment_submission
       SET grade = $1, feedback = $2, returned = TRUE
       WHERE submission_id = $3`,
      [grade, feedback, submissionId]
    );

    // Send response
    res.json({ message: 'Grade submitted successfully' });

    // Notify students about the new grade
    try {
      await notificationService.notifyStudentsAboutNewGrade(submissionId, grade, feedback);
    } catch (notifError) {
      console.error('Error sending grade notification:', notifError);
      // Don't fail the operation if notifications fail
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a submission
router.delete("/:assignmentId/submissions/:submissionId", authorize, async (req, res) => {
  const client = await pool.connect();
  try {
    const { assignmentId, submissionId } = req.params;
    
    // Get the user ID from the jwt token
    const studentId = req.user.user_id || req.user.id;
    
    console.log(`Attempting to delete submission ${submissionId} for assignment ${assignmentId} by student ${studentId}`);
    
    // Return an error if the user ID is undefined
    if (!studentId) {
      return res.status(401).json({ error: "User authentication failed. Please login again." });
    }

    await client.query('BEGIN');

    // First verify the submission exists and belongs to the student
    const submissionCheck = await client.query(
      "SELECT * FROM assignment_submission WHERE submission_id = $1 AND assignment_id = $2",
      [submissionId, assignmentId]
    );

    if (submissionCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Submission not found" });
    }

    // Verify the submission belongs to the current user
    if (submissionCheck.rows[0].student_id !== studentId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: "You can only unsubmit your own submissions" });
    }

    // Prevent unsubmitting if the submission has been graded
    if (submissionCheck.rows[0].grade || submissionCheck.rows[0].returned) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: "You cannot unsubmit an assignment that has been graded" });
    }

    // Get file information before deletion
    const fileInfo = await client.query(
      "SELECT file_path FROM submission_attachment WHERE submission_id = $1",
      [submissionId]
    );

    // Delete submission attachments first (due to foreign key constraint)
    await client.query(
      "DELETE FROM submission_attachment WHERE submission_id = $1",
      [submissionId]
    );

    // Delete the submission
    await client.query(
      "DELETE FROM assignment_submission WHERE submission_id = $1",
      [submissionId]
    );

    await client.query('COMMIT');

    // Delete physical files if they exist
    if (fileInfo.rows.length > 0) {
      for (const file of fileInfo.rows) {
        if (file.file_path) {
          try {
            if (fs.existsSync(file.file_path)) {
              fs.unlinkSync(file.file_path);
            }
          } catch (err) {
            console.error('Error deleting physical file:', err);
            // Continue even if file deletion fails
          }
        }
      }
    }

    res.json({ message: "Submission deleted successfully" });
    
    // Notify instructor about the unsubmission
    try {
      // Get assignment and course details for notification
      const assignmentResult = await pool.query(
        `SELECT a.course_id, a.title, c.instructor_id, u.first_name, u.last_name
         FROM assignment a
         JOIN course c ON a.course_id = c.course_id
         JOIN users u ON u.user_id = $1
         WHERE a.assignment_id = $2`,
        [studentId, assignmentId]
      );
      
      if (assignmentResult.rows.length > 0) {
        const { course_id, title, instructor_id, first_name, last_name } = assignmentResult.rows[0];
        
        // Only notify the instructor
        if (instructor_id) {
          const notificationMessage = `${first_name} ${last_name} has unsubmitted "${title}"`;
          
          await notificationService.createNotification(
            instructor_id,
            'new_content',
            notificationMessage,
            {
              course_id: course_id,
              assignment_id: assignmentId,
              student_id: studentId,
              type: 'assignment_unsubmission',
              redirect_url: `/courses/${course_id}/assignments?assignmentId=${assignmentId}`
            }
          );
        }
      }
    } catch (notifError) {
      console.error('Error sending unsubmission notification:', notifError);
      // Don't fail the operation if notification fails
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error deleting submission:", err);
    res.status(500).json({ error: "Failed to delete submission" });
  } finally {
    client.release();
  }
});

// Get a specific submission
router.get("/:assignmentId/submissions/:submissionId", authorize, async (req, res) => {
  try {
    const { assignmentId, submissionId } = req.params;
    
    // Get the user ID from the jwt token
    const studentId = req.user.user_id || req.user.id;
    
    console.log(`Fetching submission ${submissionId} for assignment ${assignmentId}, requested by user ${studentId}`);
    
    // Return an error if the user ID is undefined
    if (!studentId) {
      return res.status(401).json({ error: "User authentication failed. Please login again." });
    }

    // Query for the submission
    const submissionQuery = `
      SELECT s.*, 
             json_agg(
               CASE WHEN sa.attachment_id IS NOT NULL THEN
                 json_build_object(
                   'attachment_id', sa.attachment_id,
                   'file_name', sa.file_name,
                   'file_size', sa.file_size,
                   'file_path', sa.file_path,
                   'mime_type', sa.mime_type
                 )
               ELSE NULL END
             ) FILTER (WHERE sa.attachment_id IS NOT NULL) as files
      FROM assignment_submission s
      LEFT JOIN submission_attachment sa ON s.submission_id = sa.submission_id
      WHERE s.submission_id = $1 AND s.assignment_id = $2
      GROUP BY s.submission_id`;

    const submission = await pool.query(submissionQuery, [submissionId, assignmentId]);

    if (submission.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Get the submission data
    const submissionData = submission.rows[0];

    // Check if this is the student's own submission or a professor
    const isOwner = submissionData.student_id === studentId;
    const isProfessor = req.user.role === 'professor';

    // Only allow access to the owner or professors
    if (!isOwner && !isProfessor) {
      return res.status(403).json({ error: "You don't have permission to view this submission" });
    }

    // Format the files array
    if (submissionData.files && submissionData.files[0] !== null) {
      submissionData.files = submissionData.files.map(file => {
        // Extract just the UUID filename from the file path
        let filename = '';
        
        if (file.file_path) {
          // First try to find a UUID pattern in the file path
          const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]+$/i;
          const uuidMatch = file.file_path.match(uuidPattern);
          
          if (uuidMatch) {
            filename = uuidMatch[0];
          } else {
            // Otherwise, just use the basename of the file path
            filename = path.basename(file.file_path);
          }
        }
        
        return {
          ...file,
          file_url: `/uploads/assignments/${filename}`
        };
      });
    } else {
      submissionData.files = [];
    }

    res.json(submissionData);
  } catch (err) {
    console.error("Error fetching submission:", err);
    res.status(500).json({ error: "Server error while fetching submission" });
  }
});

// Add endpoints for file listing and lookup

// Endpoint to list files in the uploads/assignments directory
router.get('/uploads/list/assignments', authorize, (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, '../../uploads/assignments');
    
    // Check if directory exists
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ files: [] });
    }
    
    // Read directory contents
    const files = fs.readdirSync(uploadsDir);
    
    res.json({ files });
  } catch (error) {
    console.error('Error listing uploads directory:', error);
    res.status(500).json({ error: 'Server error listing directory' });
  }
});

// Endpoint to find a file in the database and return its path
router.post('/find-file', authorize, async (req, res) => {
  const client = await pool.connect();
  try {
    const { attachmentId, fileName } = req.body;
    
    if (!attachmentId) {
      return res.status(400).json({ error: 'Attachment ID is required' });
    }
    
    console.log(`Looking up file for attachment ID: ${attachmentId}, fileName: ${fileName}`);
    
    // First try to find by attachment ID
    const result = await client.query(
      'SELECT file_path, file_name FROM assignment_attachment WHERE attachment_id = $1',
      [attachmentId]
    );
    
    if (result.rows.length > 0) {
      const { file_path, file_name } = result.rows[0];
      console.log(`Found file in database: ${file_path}`);
      
      // Verify file exists
      if (fs.existsSync(file_path)) {
        return res.json({ 
          filePath: `/${file_path}`, // Convert to URL path
          fileName: file_name
        });
      } else {
        console.log(`File not found at path: ${file_path}`);
      }
    } else {
      console.log('No attachment found with the provided ID');
    }
    
    // If we get here, try to find the file in the uploads directory
    try {
      const uploadsDir = path.join(__dirname, '../../uploads/assignments');
      if (fs.existsSync(uploadsDir)) {
        // List all files
        const files = fs.readdirSync(uploadsDir);
        
        // Try to find by ID in filename
        const idMatch = files.find(file => file.includes(attachmentId.toString()));
        if (idMatch) {
          const filePath = path.join('uploads/assignments', idMatch);
          console.log(`Found file by ID in name: ${filePath}`);
          return res.json({ 
            filePath: `/${filePath.replace(/\\/g, '/')}`, // Convert to URL path
            fileName: fileName || idMatch
          });
        }
        
        // Try to find by original filename if provided
        if (fileName) {
          const nameMatch = files.find(file => 
            file.toLowerCase().includes(fileName.toLowerCase()) ||
            path.extname(file).toLowerCase() === path.extname(fileName).toLowerCase()
          );
          
          if (nameMatch) {
            const filePath = path.join('uploads/assignments', nameMatch);
            console.log(`Found file by name similarity: ${filePath}`);
            return res.json({ 
              filePath: `/${filePath.replace(/\\/g, '/')}`, // Convert to URL path
              fileName: fileName
            });
          }
        }
      }
    } catch (dirError) {
      console.error('Error searching uploads directory:', dirError);
    }
    
    // If we couldn't find anything
    res.status(404).json({ error: 'File not found' });
  } catch (error) {
    console.error('Error in find-file endpoint:', error);
    res.status(500).json({ error: 'Server error finding file' });
  } finally {
    client.release();
  }
});

// Add direct download endpoint

// Helper function to sanitize filename
const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
};

// Endpoint to directly download a file by attachment ID
router.get('/download/:attachmentId', authorize, async (req, res) => {
  const client = await pool.connect();
  try {
    const { attachmentId } = req.params;
    const originalName = req.query.originalName; // Optional parameter
    
    console.log(`Download request for attachment ID: ${attachmentId}`);
    
    // Get attachment info from database
    const result = await client.query(
      'SELECT file_path, file_name, mime_type FROM assignment_attachment WHERE attachment_id = $1',
      [attachmentId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    const { file_path, file_name, mime_type } = result.rows[0];
    console.log(`Found attachment: ${file_path}, ${file_name}, ${mime_type}`);
    
    // Check if file exists
    if (!fs.existsSync(file_path)) {
      console.error(`File not found at path: ${file_path}`);
      
      // If file doesn't exist at the recorded path, try to find it in the uploads directory
      const uploadsDir = path.join(__dirname, '../../uploads/assignments');
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        
        // Try to find by ID in filename or by original name
        const fileName = originalName || file_name;
        const fileMatch = files.find(file => 
          file.includes(attachmentId.toString()) || 
          (fileName && (
            file.toLowerCase().includes(fileName.toLowerCase()) ||
            path.extname(file).toLowerCase() === path.extname(fileName).toLowerCase()
          ))
        );
        
        if (fileMatch) {
          const filePath = path.join(uploadsDir, fileMatch);
          console.log(`File found at alternate location: ${filePath}`);
          
          // Determine content type from file extension
          const ext = path.extname(fileMatch).toLowerCase();
          const contentType = mime_type || 
                             {
                              '.jpg': 'image/jpeg',
                              '.jpeg': 'image/jpeg',
                              '.png': 'image/png',
                              '.gif': 'image/gif',
                              '.pdf': 'application/pdf',
                              '.doc': 'application/msword',
                              '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                             }[ext] || 'application/octet-stream';
          
          // Set download headers
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(file_name || fileMatch)}"`);
          
          // Stream the file
          const fileStream = fs.createReadStream(filePath);
          fileStream.pipe(res);
          return;
        }
      }
      
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Set content type and disposition headers for download
    res.setHeader('Content-Type', mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(file_name)}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(file_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error in download endpoint:', error);
    res.status(500).json({ error: 'Server error downloading file' });
  } finally {
    client.release();
  }
});

// Add a specific endpoint to fetch the Activity_2_beziermethod.png image
router.get('/submissions/image/:imageName', authorize, async (req, res) => {
  try {
    const { imageName } = req.params;
    
    // Safety check - only allow specific images
    if (imageName !== 'Activity_2_beziermethod.png') {
      return res.status(403).send('Access denied');
    }
    
    // Define possible locations for the image
    const possiblePaths = [
      path.join(__dirname, '..', 'uploads', 'assignments', imageName),
      path.join(__dirname, '..', 'public', 'images', imageName),
      path.join(__dirname, '..', 'public', imageName),
      path.join(__dirname, '..', 'public', 'assets', imageName),
      // Add more possible paths if needed
    ];
    
    // Try each path until we find the image
    for (const imagePath of possiblePaths) {
      if (fs.existsSync(imagePath)) {
        return res.sendFile(imagePath);
      }
    }
    
    // If no image found, return a 404
    res.status(404).send('Image not found');
  } catch (error) {
    console.error('Error serving submission image:', error);
    res.status(500).send('Server error');
  }
});

// Add a specific endpoint to fetch submission images based on submission ID and filename
router.get('/submissions/:submissionId/files/:filename', authorize, async (req, res) => {
  const client = await pool.connect();
  try {
    const { submissionId, filename } = req.params;
    
    console.log(`Fetching file ${filename} for submission ID: ${submissionId}`);
    
    // First, check if this file exists in the submission_attachment table
    const attachmentResult = await client.query(
      `SELECT file_path, file_name, mime_type 
       FROM submission_attachment 
       WHERE submission_id = $1`,
      [submissionId]
    );
    
    // If we found files for this submission
    if (attachmentResult.rows.length > 0) {
      const { file_path, mime_type } = attachmentResult.rows[0];
      console.log(`Found file in database: ${file_path}`);
      
      if (fs.existsSync(file_path)) {
        // Set content type if available
        if (mime_type) {
          res.setHeader('Content-Type', mime_type);
        }
        return res.sendFile(path.resolve(file_path));
      } else {
        console.log(`File not found at path: ${file_path}`);
      }
    }
    
    // Need to scan the uploads/assignments directory for files
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'assignments');
    
    if (fs.existsSync(uploadsDir)) {
      // Get all files in the directory
      const files = fs.readdirSync(uploadsDir);
      console.log(`Scanning ${files.length} files in uploads/assignments directory`);
      
      // 1. First try: Look for an exact UUID match (these are likely direct student submissions)
      const allUuids = files.filter(file => {
        // Extract the UUID part (remove extension)
        const uuidPart = file.split('.')[0];
        return uuidPart.length >= 32 && /^[0-9a-f-]+$/i.test(uuidPart);
      });
      
      console.log(`Found ${allUuids.length} files with UUID-like names`);
      
      // Get file extension from requested filename to help match similar files
      const requestedExtension = path.extname(filename).toLowerCase();
      
      // 2. Look for files with matching extension
      const matchingExtFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ext === requestedExtension || 
               ext === '.jpg' || ext === '.jpeg' || 
               ext === '.png' || ext === '.gif' || 
               ext === '.pdf';
      });
      
      console.log(`Found ${matchingExtFiles.length} files with matching or common extensions`);
      
      // Create a priority list of files to try
      let filesToTry = [];
      
      // If we have UUID files and matching extensions, prioritize those
      if (matchingExtFiles.length > 0 && allUuids.length > 0) {
        // Find UUID files with matching extensions
        const uuidsWithMatchingExt = allUuids.filter(file => 
          matchingExtFiles.includes(file)
        );
        
        if (uuidsWithMatchingExt.length > 0) {
          console.log(`Found ${uuidsWithMatchingExt.length} UUID files with matching extensions`);
          filesToTry = [...uuidsWithMatchingExt, ...filesToTry];
        }
      }
      
      // Add all UUIDs
      filesToTry = [...filesToTry, ...allUuids];
      
      // Add all matching extensions
      filesToTry = [...filesToTry, ...matchingExtFiles];
      
      // Add all remaining files as a last resort
      filesToTry = [...filesToTry, ...files.filter(f => !filesToTry.includes(f))];
      
      // Remove duplicates
      filesToTry = [...new Set(filesToTry)];
      
      console.log(`Attempting to serve files in priority order (${filesToTry.length} total files)`);
      
      // Try each file in order
      for (const file of filesToTry) {
        const filePath = path.join(uploadsDir, file);
        
        if (fs.existsSync(filePath)) {
          // Determine MIME type from file extension
          const ext = path.extname(file).toLowerCase();
          const contentType = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          }[ext] || 'application/octet-stream';
          
          console.log(`Serving file: ${file} with content type: ${contentType}`);
          res.setHeader('Content-Type', contentType);
          return res.sendFile(filePath);
        }
      }
    }
    
    // If we still can't find the file, check if there's a placeholder
    const placeholderPath = path.join(__dirname, '..', 'uploads', 'assignments', 'Activity_2_beziermethod.png');
    if (fs.existsSync(placeholderPath)) {
      console.log('Using placeholder image as fallback');
      return res.sendFile(placeholderPath);
    }
    
    // If no files found at all
    res.status(404).send('File not found');
  } catch (error) {
    console.error('Error serving submission file:', error);
    res.status(500).send('Server error');
  } finally {
    client.release();
  }
});

// Serve uploaded files
router.get('/uploads/assignments/:filename', authorize, (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads/assignments', filename);
    
    console.log(`Attempting to serve file: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return res.status(404).json({ error: 'File not found' });
    }

    // Get file extension to determine content type
    const ext = path.extname(filename).toLowerCase();
    const contentType = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }[ext] || 'application/octet-stream';

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      res.status(500).json({ error: 'Error streaming file' });
    });
    fileStream.pipe(res);
  } catch (err) {
    console.error('Error serving file:', err);
    res.status(500).json({ error: 'Error serving file' });
  }
});

// Also handle the duplicate path pattern that clients might request
router.get('/uploads/uploads/assignments/:filename', authorize, (req, res) => {
  try {
    // Redirect to the correct path
    const { filename } = req.params;
    res.redirect(`/uploads/assignments/${filename}`);
  } catch (err) {
    console.error('Error redirecting file request:', err);
    res.status(500).json({ error: 'Error redirecting file request' });
  }
});

// Handle various nested paths that might occur due to the assignments router being mounted at /assignments
router.get('/uploads/assignments/uploads/assignments/:filename', authorize, (req, res) => {
  const { filename } = req.params;
  // Redirect to the correct path
  res.redirect(`/uploads/assignments/${filename}`);
});

// Handle another potential nesting path
router.get('/uploads/assignments/assignments/:filename', authorize, (req, res) => {
  const { filename } = req.params;
  // Redirect to the correct path
  res.redirect(`/uploads/assignments/${filename}`);
});

// Add a route to handle direct UUID file access
router.get('/:uuid([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}).:ext', authorize, (req, res) => {
  const { uuid, ext } = req.params;
  const filename = `${uuid}.${ext}`;
  // Redirect to the static file server
  res.redirect(`/uploads/assignments/${filename}`);
});

// Add endpoint to update assignment points
router.put('/assignments/:assignmentId/points', authorize, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { points } = req.body;
    const pointsValue = Number(points);
    if (!Number.isInteger(pointsValue) || pointsValue <= 0) {
      return res.status(400).json({ error: 'Points must be a positive integer' });
    }
    const updateRes = await pool.query(
      'UPDATE assignment SET points = $1 WHERE assignment_id = $2 RETURNING *',
      [pointsValue, assignmentId]
    );
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json(updateRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update points' });
  }
});

// Toggle accepting submissions for an assignment
router.put('/:assignmentId/toggle-accepting', authorize, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { accepting_submission } = req.body;
    
    // Validate input
    if (accepting_submission === undefined) {
      return res.status(400).json({ error: 'accepting_submission status is required' });
    }
    
    // Check if the assignment exists
    const assignmentCheck = await pool.query(
      'SELECT assignment_id FROM assignment WHERE assignment_id = $1',
      [assignmentId]
    );
    
    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
     
    // Update the assignment's accepting_submission status
    await pool.query(
      `UPDATE assignment 
       SET accepting_submission = $1
       WHERE assignment_id = $2`,
      [accepting_submission, assignmentId]
    );
    
    res.status(200).json({ 
      message: 'Assignment submission status updated successfully',
      accepting_submission
    });
  } catch (err) {
    console.error('Error toggling accepting_submission status:', err);
    res.status(500).json({ 
      error: 'Failed to update submission status',
      details: err.message 
    });
  }
});

// Return batch grades for multiple students at once
router.post('/submissions/batch-grade', authorize, async (req, res) => {
  try {
    const { submissionIds, grade, feedback } = req.body;
    
    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      return res.status(400).json({ error: 'No submission IDs provided' });
    }
    
    if (grade === undefined || grade === null || grade === '') {
      return res.status(400).json({ error: 'Grade is required' });
    }

    const results = {
      success: [],
      failed: []
    };

    // Process each submission in sequence
    for (const submissionId of submissionIds) {
      try {
        // Fetch assignment points to validate grade
        const submissionRes = await pool.query(
          `SELECT a.points
           FROM assignment_submission s
           JOIN assignment a ON s.assignment_id = a.assignment_id
           WHERE s.submission_id = $1`,
          [submissionId]
        );
        
        if (submissionRes.rows.length === 0) {
          results.failed.push({ submissionId, reason: 'Submission not found' });
          continue;
        }
        
        const { points } = submissionRes.rows[0];
        const maxPoints = points || 100;
        
        // Validate grade is in range
        if (isNaN(Number(grade)) || Number(grade) < 0 || Number(grade) > maxPoints) {
          results.failed.push({ 
            submissionId, 
            reason: `Grade must be between 0 and ${maxPoints}` 
          });
          continue;
        }
        
        // Update the submission with grade and feedback
        await pool.query(
          `UPDATE assignment_submission
           SET grade = $1, feedback = $2, returned = TRUE
           WHERE submission_id = $3`,
          [grade, feedback || '', submissionId]
        );
        
        results.success.push(submissionId);
        
        // Send notification for each successful grade
        try {
          await notificationService.notifyStudentsAboutNewGrade(submissionId, grade, feedback || '');
        } catch (notifError) {
          console.error(`Failed to send notification for submission ${submissionId}:`, notifError);
          // Continue with other submissions even if notification fails
        }
      } catch (err) {
        console.error(`Error processing submission ${submissionId}:`, err);
        results.failed.push({ submissionId, reason: 'Server error' });
      }
    }
    
    res.json({
      message: `Successfully graded ${results.success.length} of ${submissionIds.length} submissions`,
      results
    });
  } catch (err) {
    console.error('Error in batch grading:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 