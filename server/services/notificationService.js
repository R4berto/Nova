const pool = require('../db');
const { sendEmail } = require('./emailService');
const { sendPushNotification } = require('./pushNotificationService');
const { getIO } = require('../websocket');

class NotificationService {
  // Create a new notification
  async createNotification(userId, type, message, metadata = {}) {
    console.log(`Creating notification for user ${userId}:`, { type, message, metadata });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get user preferences first
      const preferencesResult = await client.query(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [userId]
      );

      let preferences = preferencesResult.rows[0];
      
      // If no preferences exist, create default preferences
      if (!preferences) {
        const defaultPrefsResult = await client.query(
          `INSERT INTO notification_preferences 
           (user_id, email_notifications, push_notifications, 
            due_date_reminders, new_content_alerts,
            grade_notifications, message_notifications)
           VALUES ($1, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
           RETURNING *`,
          [userId]
        );
        preferences = defaultPrefsResult.rows[0];
      }
      
      // Check type-specific preferences before proceeding
      if (type === 'message' && !preferences.message_notifications) {
        console.log(`User ${userId} has message notifications disabled, skipping`);
        await client.query('ROLLBACK');
        return null; // Skip creating the notification
      } else if (type === 'due_date' && !preferences.due_date_reminders) {
        console.log(`User ${userId} has due date reminders disabled, skipping`);
        await client.query('ROLLBACK');
        return null;
      } else if (type === 'new_content' && !preferences.new_content_alerts) {
        console.log(`User ${userId} has new content alerts disabled, skipping`);
        await client.query('ROLLBACK');
        return null;
      } else if (type === 'grade' && !preferences.grade_notifications) {
        console.log(`User ${userId} has grade notifications disabled, skipping`);
        await client.query('ROLLBACK');
        return null;
      }

      // Insert notification
      const notificationResult = await client.query(
        `INSERT INTO notifications (user_id, type, message, metadata)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, type, message, metadata]
      );

      const notification = notificationResult.rows[0];
      console.log(`Created notification ID ${notification.id} successfully`);

      // Schedule delivery based on preferences
      if (preferences.email_notifications) {
        await this.scheduleEmailDelivery(notification.id, userId, notification);
      }

      if (preferences.push_notifications) {
        await this.schedulePushDelivery(notification.id, userId, notification);
      }

      // Send real-time notification
      await this.sendRealtimeNotification(userId, notification);

      await client.query('COMMIT');
      return notification;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating notification:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get user notifications
  async getUserNotifications(userId, limit = 50, offset = 0) {
    try {
      const result = await pool.query(
        `SELECT * FROM notifications 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const unreadCount = await pool.query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false',
        [userId]
      );

      return {
        notifications: result.rows,
        unread_count: parseInt(unreadCount.rows[0].count)
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    try {
      const result = await pool.query(
        `UPDATE notifications 
         SET read = true 
         WHERE id = $1 AND user_id = $2 
         RETURNING *`,
        [notificationId, userId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllAsRead(userId) {
    try {
      await pool.query(
        'UPDATE notifications SET read = true WHERE user_id = $1',
        [userId]
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Clear all notifications for a user
  async clearAllNotifications(userId) {
    try {
      await pool.query(
        'DELETE FROM notifications WHERE user_id = $1',
        [userId]
      );
    } catch (error) {
      console.error('Error clearing all notifications:', error);
      throw error;
    }
  }

  // Update notification preferences
  async updatePreferences(userId, preferences) {
    try {
      const result = await pool.query(
        `INSERT INTO notification_preferences 
         (user_id, email_notifications, push_notifications, 
          due_date_reminders, new_content_alerts, 
          grade_notifications, message_notifications)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           email_notifications = $2,
           push_notifications = $3,
           due_date_reminders = $4,
           new_content_alerts = $5,
           grade_notifications = $6,
           message_notifications = $7,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          userId,
          preferences.email_notifications,
          preferences.push_notifications,
          preferences.due_date_reminders,
          preferences.new_content_alerts,
          preferences.grade_notifications,
          preferences.message_notifications
        ]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  // Get user preferences
  async getPreferences(userId) {
    try {
      const result = await pool.query(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [userId]
      );
      
      // If no preferences found, return default preferences
      if (result.rows.length === 0) {
        return {
          email_notifications: true,
          push_notifications: true,
          due_date_reminders: true,
          new_content_alerts: true,
          grade_notifications: true,
          message_notifications: true
        };
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      throw error;
    }
  }

  // Schedule email delivery
  async scheduleEmailDelivery(notificationId, userId, notification) {
    try {
      // Check if notification exists in database before creating delivery log
      const notificationCheck = await pool.query(
        'SELECT id FROM notifications WHERE id = $1',
        [notificationId]
      );
      
      if (notificationCheck.rows.length === 0) {
        console.error(`Cannot schedule email delivery: Notification ${notificationId} not found`);
        return;
      }
      
      const result = await pool.query(
        `INSERT INTO notification_delivery_log 
         (notification_id, delivery_method, status)
         VALUES ($1, 'email', 'pending')
         RETURNING *`,
        [notificationId]
      );

      // In a real implementation, this would be handled by a job queue
      try {
        await sendEmail(userId, notification);
        
        await pool.query(
          `UPDATE notification_delivery_log 
           SET status = 'sent', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [result.rows[0].id]
        );
      } catch (error) {
        await pool.query(
          `UPDATE notification_delivery_log 
           SET status = 'failed', error_message = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [error.message, result.rows[0].id]
        );
      }
    } catch (error) {
      console.error('Error scheduling email delivery:', error);
    }
  }

  // Schedule push notification delivery
  async schedulePushDelivery(notificationId, userId, notification) {
    try {
      // Check if notification exists in database before creating delivery log
      const notificationCheck = await pool.query(
        'SELECT id FROM notifications WHERE id = $1',
        [notificationId]
      );
      
      if (notificationCheck.rows.length === 0) {
        console.error(`Cannot schedule push delivery: Notification ${notificationId} not found`);
        return;
      }
      
      const result = await pool.query(
        `INSERT INTO notification_delivery_log 
         (notification_id, delivery_method, status)
         VALUES ($1, 'push', 'pending')
         RETURNING *`,
        [notificationId]
      );

      try {
        await sendPushNotification(userId, notification);
        
        await pool.query(
          `UPDATE notification_delivery_log 
           SET status = 'sent', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [result.rows[0].id]
        );
      } catch (error) {
        await pool.query(
          `UPDATE notification_delivery_log 
           SET status = 'failed', error_message = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [error.message, result.rows[0].id]
        );
      }
    } catch (error) {
      console.error('Error scheduling push delivery:', error);
    }
  }

  // Send real-time notification via WebSocket
  async sendRealtimeNotification(userId, notification) {
    console.log(`Attempting to send real-time notification to user ${userId}:`);
    console.log(notification);
    try {
      const io = getIO();
      if (!io) {
        console.error('Socket.io instance not available');
        return;
      }
      io.to(`user:${userId}`).emit('notification', notification);
      console.log(`Real-time notification sent to user ${userId}`);
      
      // Check if notification exists in database before creating delivery log
      if (notification && notification.id) {
        const notificationCheck = await pool.query(
          'SELECT id FROM notifications WHERE id = $1',
          [notification.id]
        );
        
        if (notificationCheck.rows.length === 0) {
          console.error(`Cannot log in-app delivery: Notification ${notification.id} not found`);
          return;
        }
        
        // Log in-app delivery
        await pool.query(
          `INSERT INTO notification_delivery_log 
           (notification_id, delivery_method, status, created_at, updated_at)
           VALUES ($1, 'in_app', 'sent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [notification.id]
        );
      }
    } catch (error) {
      console.error(`Error sending real-time notification to user ${userId}:`, error);
      
      // Log failure only if notification exists
      if (notification && notification.id) {
        try {
          const notificationCheck = await pool.query(
            'SELECT id FROM notifications WHERE id = $1',
            [notification.id]
          );
          
          if (notificationCheck.rows.length === 0) {
            return;
          }
          
          await pool.query(
            `INSERT INTO notification_delivery_log 
             (notification_id, delivery_method, status, error_message, created_at, updated_at)
             VALUES ($1, 'in_app', 'failed', $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [notification.id, error.message]
          );
        } catch (logError) {
          console.error('Error logging notification failure:', logError);
        }
      }
    }
  }

  // Get notification by ID
  async getNotificationById(notificationId) {
    try {
      const result = await pool.query(
        'SELECT * FROM notifications WHERE id = $1',
        [notificationId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error getting notification by ID:', error);
      throw error;
    }
  }

  // Create due date reminder
  async createDueDateReminder(userId, assignmentId, dueDate) {
    const message = `Reminder: Assignment is due on ${new Date(dueDate).toLocaleString()}`;
    return this.createNotification(userId, 'due_date', message, {
      assignment_id: assignmentId,
      due_date: dueDate
    });
  }

  // Create new content alert
  async createNewContentAlert(userId, courseId, contentType, contentName) {
    const message = `New ${contentType} "${contentName}" has been added to your course`;
    return this.createNotification(userId, 'new_content', message, {
      course_id: courseId,
      content_name: contentName
    });
  }

  // Create grade notification
  async createGradeNotification(userId, assignmentId, grade) {
    const message = `Your assignment has been graded. Grade: ${grade}`;
    return this.createNotification(userId, 'grade', message, {
      assignment_id: assignmentId,
      grade: grade
    });
  }

  // Create message notification
  async createMessageNotification(userId, senderId, message) {
    const senderQuery = await pool.query(
      'SELECT first_name, last_name FROM users WHERE user_id = $1',
      [senderId]
    );
    
    const senderName = senderQuery.rows[0] ? 
      `${senderQuery.rows[0].first_name} ${senderQuery.rows[0].last_name}` : 
      'Someone';
    
    const notificationMessage = `New message from ${senderName}`;
    
    return this.createNotification(userId, 'message', notificationMessage, {
      sender_id: senderId,
      message: message
    });
  }

  // Notify students about new assignment
  async notifyStudentsAboutNewAssignment(courseId, title, description, dueDate, points, assignmentId) {
    try {
      // Get course details
      const courseResult = await pool.query(
        'SELECT course_name FROM course WHERE course_id = $1',
        [courseId]
      );
      const courseName = courseResult.rows[0]?.course_name || 'course';

      // Get all students enrolled in the course
      const enrolledStudents = await pool.query(
        'SELECT student_id FROM enrollment WHERE course_id = $1',
        [courseId]
      );

      // Create notification message
      const notificationMessage = `New assignment: "${title}" in ${courseName}`;

      // Send notifications to all enrolled students
      for (const student of enrolledStudents.rows) {
        try {
          // Create notification with metadata for redirection
          await this.createNotification(
            student.student_id,
            'new_content',
            notificationMessage,
            {
              course_id: courseId,
              assignment_id: assignmentId,
              type: 'assignment',
              title: title,
              redirect_url: `/courses/${courseId}/assignments?assignmentId=${assignmentId}`
            }
          );
        } catch (notifError) {
          console.error(`Failed to create notification for student ${student.student_id}:`, notifError);
          // Continue with other students even if one notification fails
        }
      }
    } catch (error) {
      console.error('Error sending assignment notifications:', error);
      // Don't throw, let the main function continue
    }
  }

  // Notify students about assignment update
  async notifyStudentsAboutAssignmentUpdate(assignmentId, title, description, dueDate, points) {
    try {
      // Get assignment and course details
      const assignmentResult = await pool.query(
        'SELECT course_id FROM assignment WHERE assignment_id = $1',
        [assignmentId]
      );
      
      if (assignmentResult.rows.length === 0) {
        console.error(`Assignment ${assignmentId} not found for notification`);
        return;
      }
      
      const courseId = assignmentResult.rows[0].course_id;
      
      // Get course name
      const courseResult = await pool.query(
        'SELECT course_name FROM course WHERE course_id = $1',
        [courseId]
      );
      const courseName = courseResult.rows[0]?.course_name || 'course';

      // Get all students enrolled in the course
      const enrolledStudents = await pool.query(
        'SELECT student_id FROM enrollment WHERE course_id = $1',
        [courseId]
      );

      // Create notification message
      const notificationMessage = `Assignment updated: "${title}" in ${courseName}`;

      // Send notifications to all enrolled students
      for (const student of enrolledStudents.rows) {
        try {
          // Create notification with metadata for redirection
          await this.createNotification(
            student.student_id,
            'new_content',
            notificationMessage,
            {
              course_id: courseId,
              assignment_id: assignmentId,
              type: 'assignment_update',
              redirect_url: `/courses/${courseId}/assignments?assignmentId=${assignmentId}`
            }
          );
        } catch (notifError) {
          console.error(`Failed to create notification for student ${student.student_id}:`, notifError);
          // Continue with other students even if one notification fails
        }
      }
    } catch (error) {
      console.error('Error sending assignment update notifications:', error);
      // Don't throw, let the main function continue
    }
  }

  // Notify instructor about new submission
  async notifyStudentsAboutNewSubmission(assignmentId, studentId) {
    try {
      // Get assignment and course details
      const assignmentResult = await pool.query(
        `SELECT a.course_id, a.title, c.instructor_id, u.first_name, u.last_name
         FROM assignment a
         JOIN course c ON a.course_id = c.course_id
         JOIN users u ON u.user_id = $2
         WHERE a.assignment_id = $1`,
        [assignmentId, studentId]
      );
      
      if (assignmentResult.rows.length === 0) {
        console.error(`Assignment ${assignmentId} not found for submission notification`);
        return;
      }
      
      const { course_id, title, instructor_id, first_name, last_name } = assignmentResult.rows[0];
      
      // Only notify the instructor
      if (instructor_id) {
        const notificationMessage = `New submission: ${first_name} ${last_name} has submitted "${title}"`;
        
        await this.createNotification(
          instructor_id,
          'new_content',
          notificationMessage,
          {
            course_id: course_id,
            assignment_id: assignmentId,
            student_id: studentId,
            type: 'assignment_submission',
            redirect_url: `/courses/${course_id}/assignments?assignmentId=${assignmentId}`
          }
        );
      }
    } catch (error) {
      console.error('Error sending submission notification:', error);
      // Don't throw, let the main function continue
    }
  }

  // Notify student about new grade
  async notifyStudentsAboutNewGrade(submissionId, grade, feedback) {
    try {
      // Get submission details
      const submissionResult = await pool.query(
        `SELECT s.student_id, s.assignment_id, a.title, a.course_id
         FROM assignment_submission s
         JOIN assignment a ON s.assignment_id = a.assignment_id
         WHERE s.submission_id = $1`,
        [submissionId]
      );
      
      if (submissionResult.rows.length === 0) {
        console.error(`Submission ${submissionId} not found for grade notification`);
        return;
      }
      
      const { student_id, assignment_id, title, course_id } = submissionResult.rows[0];
      
      // Create notification for the student
      const notificationMessage = `Your assignment "${title}" has been graded: ${grade}`;
      
      await this.createNotification(
        student_id,
        'grade',
        notificationMessage,
        {
          course_id: course_id,
          assignment_id: assignment_id,
          submission_id: submissionId,
          grade: grade,
          type: 'grade',
          redirect_url: `/courses/${course_id}/assignments?assignmentId=${assignment_id}`
        }
      );
    } catch (error) {
      console.error('Error sending grade notification:', error);
      // Don't throw, let the main function continue
    }
  }
}

module.exports = new NotificationService(); 