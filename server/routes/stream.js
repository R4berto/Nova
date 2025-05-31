const router = require("express").Router();
const pool = require("../db");
const authorization = require("../middleware/authorization");
const notificationService = require('../services/notificationService');

// Get course stream (announcements and materials)
router.get("/:courseId", authorization, async (req, res) => {
    try {
        const { courseId } = req.params;
        
        // Get announcements with attachments
        const announcements = await pool.query(
            `SELECT a.*, u.first_name, u.last_name, u.role, up.profile_picture_url,
                    array_agg(json_build_object(
                        'attachment_id', att.attachment_id,
                        'file_name', att.file_name,
                        'file_url', att.file_url,
                        'file_type', att.file_type,
                        'file_size', att.file_size
                    )) as attachments
             FROM announcement a 
             JOIN users u ON a.author_id = u.user_id
             LEFT JOIN user_profile up ON u.user_id = up.user_id
             LEFT JOIN announcement_attachment att ON a.announcement_id = att.announcement_id
             WHERE a.course_id = $1 
             GROUP BY a.announcement_id, u.first_name, u.last_name, u.role, up.profile_picture_url
             ORDER BY a.created_at DESC`,
            [courseId]
        );

        // Get course materials
        const materials = await pool.query(
            `SELECT m.*, u.first_name, u.last_name, u.role, up.profile_picture_url
             FROM course_material m 
             JOIN users u ON m.author_id = u.user_id 
             LEFT JOIN user_profile up ON u.user_id = up.user_id
             WHERE m.course_id = $1 
             ORDER BY 
                CASE WHEN m.due_date IS NOT NULL 
                     THEN m.due_date 
                     ELSE m.created_at END DESC`,
            [courseId]
        );

        // Combine and sort by date
        const stream = {
            announcements: announcements.rows,
            materials: materials.rows
        };

        res.json(stream);
    } catch (err) {
        console.error(err.message);
        res.status(500).json("Server error");
    }
});

// Create course announcement
router.post("/:courseId/announcement", authorization, async (req, res) => {
    try {
        const { courseId } = req.params;
        const { title, content, attachments } = req.body;
        const userId = req.user;
        
        // Debug output
        console.log('Creating announcement for course:', courseId);
        console.log('User ID from request:', userId);
        
        // Extract user ID from either token structure
        let userIdValue = userId;
        if (typeof userId === 'object' && userId !== null) {
            userIdValue = userId.id || userId.user_id;
        }
        console.log('Extracted userIdValue:', userIdValue);

        // Start a transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create the announcement
            const newAnnouncement = await client.query(
                `INSERT INTO announcement (course_id, author_id, content, title)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [courseId, userIdValue, content, title]
            );

            // If there are attachments, insert them
            if (attachments && attachments.length > 0) {
                for (const attachment of attachments) {
                    await client.query(
                        `INSERT INTO announcement_attachment 
                         (announcement_id, file_name, file_url, file_type, file_size)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [
                            newAnnouncement.rows[0].announcement_id,
                            attachment.fileName,
                            attachment.fileUrl,
                            attachment.fileType,
                            attachment.fileSize
                        ]
                    );
                }
            }

            await client.query('COMMIT');

            // Get the complete announcement with attachments
            const completeAnnouncement = await client.query(
                `SELECT a.*, u.first_name, u.last_name, u.role, up.profile_picture_url,
                        array_agg(json_build_object(
                            'attachment_id', att.attachment_id,
                            'file_name', att.file_name,
                            'file_url', att.file_url,
                            'file_type', att.file_type,
                            'file_size', att.file_size
                        )) as attachments
                 FROM announcement a
                 JOIN users u ON a.author_id = u.user_id
                 LEFT JOIN user_profile up ON u.user_id = up.user_id
                 LEFT JOIN announcement_attachment att ON a.announcement_id = att.announcement_id
                 WHERE a.announcement_id = $1
                 GROUP BY a.announcement_id, u.first_name, u.last_name, u.role, up.profile_picture_url`,
                [newAnnouncement.rows[0].announcement_id]
            );

            // Get course name for notification
            const courseData = await pool.query(
                `SELECT course_name FROM course WHERE course_id = $1`,
                [courseId]
            );
            const courseName = courseData.rows[0]?.course_name || 'your course';

            // Get author name for notification (already available in completeAnnouncement)
            const authorName = `${completeAnnouncement.rows[0].first_name} ${completeAnnouncement.rows[0].last_name}`;

            // Create notification message
            const notificationMessage = title ? 
                `New announcement: "${title}" in ${courseName}` : 
                `New announcement from ${authorName} in ${courseName}`;

            // Get all students enrolled in the course
            const enrolledStudents = await pool.query(
                `SELECT e.student_id, u.first_name, u.last_name, u.role 
                 FROM enrollment e
                 JOIN users u ON e.student_id = u.user_id 
                 WHERE e.course_id = $1`,
                [courseId]
            );
            
            console.log(`Found ${enrolledStudents.rows.length} enrolled students for course ${courseId}`);

            // Send notifications to all enrolled students
            let notifiedCount = 0;
            for (const student of enrolledStudents.rows) {
                try {
                    // Skip notification to the author of the announcement
                    if (student.student_id === userIdValue) {
                        console.log(`Skipping notification to author: ${student.first_name} ${student.last_name} (${student.student_id})`);
                        continue;
                    }
                    
                    // Only send notifications to students, not professors
                    if (student.role !== 'student') {
                        console.log(`Skipping notification to non-student: ${student.first_name} ${student.last_name} (${student.role})`);
                        continue;
                    }
                    
                    console.log(`Sending notification to student: ${student.first_name} ${student.last_name} (${student.student_id})`);
                    
                    // Create notification with metadata for redirection
                    await notificationService.createNotification(
                        student.student_id,
                        'new_content',
                        notificationMessage,
                        {
                            announcement_id: newAnnouncement.rows[0].announcement_id,
                            course_id: courseId,
                            type: 'announcement',
                            redirect_url: `/courses/${courseId}/stream`
                        }
                    );
                    notifiedCount++;
                } catch (notifError) {
                    console.error(`Failed to create notification for student ${student.student_id}:`, notifError);
                    // Continue with other students even if one notification fails
                }
            }
            
            console.log(`Successfully notified ${notifiedCount} students about new announcement`);

            res.json(completeAnnouncement.rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).json("Server error");
    }
});

// Create course material
router.post("/:courseId/material", authorization, async (req, res) => {
    try {
        const { courseId } = req.params;
        const { title, content, type, dueDate, points } = req.body;
        const userId = req.user;
        
        // Extract user ID from either token structure
        let userIdValue = userId;
        if (typeof userId === 'object' && userId !== null) {
            userIdValue = userId.id || userId.user_id;
        }

        // Check if user is authorized for this course
        const courseCheck = await pool.query(
            `SELECT professor_id FROM course WHERE course_id = $1`,
            [courseId]
        );

        if (courseCheck.rows[0].professor_id !== userIdValue) {
            return res.status(403).json("Not authorized to post materials");
        }

        const newMaterial = await pool.query(
            `INSERT INTO course_material 
             (course_id, author_id, title, content, type, due_date, points)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [courseId, userIdValue, title, content, type, dueDate, points]
        );

        // Get course name for notification
        const courseData = await pool.query(
            `SELECT course_name FROM course WHERE course_id = $1`,
            [courseId]
        );
        const courseName = courseData.rows[0]?.course_name || 'your course';

        // Get author name for notification
        const authorData = await pool.query(
            `SELECT first_name, last_name FROM users WHERE user_id = $1`,
            [userIdValue]
        );
        const authorName = authorData.rows[0] ? 
            `${authorData.rows[0].first_name} ${authorData.rows[0].last_name}` : 
            'Your instructor';

        // Create notification message based on material type
        let materialTypeLabel = type || 'material';
        let notificationMessage = `New ${materialTypeLabel}: "${title}" added to ${courseName}`;
        
        // Get all students enrolled in the course
        const enrolledStudents = await pool.query(
            `SELECT student_id FROM enrollment WHERE course_id = $1`,
            [courseId]
        );

        // Send notifications to all enrolled students
        for (const student of enrolledStudents.rows) {
            try {
                // Create notification with metadata for redirection
                await notificationService.createNotification(
                    student.student_id,
                    'new_content',
                    notificationMessage,
                    {
                        material_id: newMaterial.rows[0].material_id,
                        course_id: courseId,
                        type: 'material',
                        material_type: type,
                        redirect_url: `/courses/${courseId}/stream`
                    }
                );
            } catch (notifError) {
                console.error(`Failed to create notification for student ${student.student_id}:`, notifError);
                // Continue with other students even if one notification fails
            }
        }

        res.json(newMaterial.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json("Server error");
    }
});

module.exports = router; 