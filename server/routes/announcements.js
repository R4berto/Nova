const router = require("express").Router();
const pool = require("../db");
const authorization = require("../middleware/authorization");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const notificationService = require('../services/notificationService');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`Created uploads directory at ${uploadDir}`);
}

// Configure multer for file storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + extension);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB file size limit
});

// Get announcements for a course
router.get("/:courseId", authorization, async (req, res) => {
    try {
        const { courseId } = req.params;
        
        // Get announcements with attachments
        const announcementsResult = await pool.query(
            `SELECT a.*, u.first_name, u.last_name, u.role, up.profile_picture_url
             FROM announcement a 
             JOIN users u ON a.author_id = u.user_id
             LEFT JOIN user_profile up ON u.user_id = up.user_id
             WHERE a.course_id = $1 
             ORDER BY a.created_at DESC`,
            [courseId]
        );

        const announcements = announcementsResult.rows;

        // Get attachments for each announcement
        for (const announcement of announcements) {
            const attachmentsResult = await pool.query(
                `SELECT * FROM announcement_attachment
                 WHERE announcement_id = $1`,
                [announcement.announcement_id]
            );
            announcement.attachments = attachmentsResult.rows;
        }

        res.json(announcements);
    } catch (err) {
        console.error(err.message);
        res.status(500).json("Server error");
    }
});

// Create announcement
router.post("/:courseId", authorization, async (req, res) => {
    try {
        const { courseId } = req.params;
        const { content, title, author_id } = req.body;
        const userId = req.user;
        
        // Debug logging
        console.log('POST announcement request received');
        console.log('CourseId:', courseId);
        console.log('UserId from token:', userId);
        console.log('Author ID in body:', author_id);
        console.log('Content length:', content ? content.length : 0);
        console.log('Title:', title);

        // Extract user ID from either token structure
        let userIdValue = userId;
        if (typeof userId === 'object' && userId !== null) {
            userIdValue = userId.id || userId.user_id;
        }
        
        // Use author_id from body if provided, otherwise use from token
        const effectiveUserId = author_id || userIdValue;
        console.log('Effective User ID:', effectiveUserId);

        // Create the announcement
        const newAnnouncement = await pool.query(
            `INSERT INTO announcement (course_id, author_id, content, title)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [courseId, effectiveUserId, content, title]
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
            [effectiveUserId]
        );
        const authorName = authorData.rows[0] ? 
            `${authorData.rows[0].first_name} ${authorData.rows[0].last_name}` : 
            'Your instructor';

        // Create notification message
        const notificationMessage = title ? 
            `New announcement: "${title}" in ${courseName}` : 
            `New announcement from ${authorName} in ${courseName}`;

        // Get all students enrolled in the course
        const enrolledStudents = await pool.query(
            `SELECT student_id FROM enrollment WHERE course_id = $1`,
            [courseId]
        );

        // Send notifications to all enrolled students
        for (const student of enrolledStudents.rows) {
            try {
                // Skip notification to the author of the announcement
                if (student.student_id === effectiveUserId) {
                    continue;
                }
                
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
            } catch (notifError) {
                console.error(`Failed to create notification for student ${student.student_id}:`, notifError);
                // Continue with other students even if one notification fails
            }
        }

        res.json(newAnnouncement.rows[0]);
    } catch (err) {
        console.error('Error creating announcement:', err.message);
        res.status(500).json("Server error");
    }
});

// Edit announcement
router.put("/:announcementId", authorization, async (req, res) => {
    try {
        const { announcementId } = req.params;
        const { content, title } = req.body;
        const userId = req.user;
        
        // Debug logging
        console.log('PUT announcement request received');
        console.log('AnnouncementId:', announcementId);
        console.log('Content length:', content ? content.length : 0);
        console.log('Title:', title);

        // Extract user ID from token structure
        let userIdValue = userId;
        if (typeof userId === 'object' && userId !== null) {
            userIdValue = userId.id || userId.user_id;
        }
        
        // First check if the user is the author or a professor
        const authorCheckResult = await pool.query(
            `SELECT a.author_id, a.course_id, u.role 
             FROM announcement a
             JOIN users u ON u.user_id = $1
             WHERE a.announcement_id = $2`,
            [userIdValue, announcementId]
        );
        
        if (authorCheckResult.rows.length === 0) {
            return res.status(404).json({ message: "Announcement not found" });
        }
        
        const { author_id, role, course_id } = authorCheckResult.rows[0];
        
        // Only the author or a professor can edit
        if (author_id !== userIdValue && role !== 'professor') {
            return res.status(403).json({ message: "Not authorized to edit this announcement" });
        }
        
        // Update the announcement
        const updateResult = await pool.query(
            `UPDATE announcement 
             SET content = $1, title = $2, updated_at = CURRENT_TIMESTAMP
             WHERE announcement_id = $3
             RETURNING *`,
            [content, title, announcementId]
        );

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ message: "Announcement not found" });
        }

        // Get course name for notification
        const courseData = await pool.query(
            `SELECT course_name FROM course WHERE course_id = $1`,
            [course_id]
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

        // Create notification message
        const notificationMessage = title ? 
            `Updated announcement: "${title}" in ${courseName}` : 
            `${authorName} updated an announcement in ${courseName}`;

        // Get all students enrolled in the course
        const enrolledStudents = await pool.query(
            `SELECT student_id FROM enrollment WHERE course_id = $1`,
            [course_id]
        );

        // Send notifications to all enrolled students
        for (const student of enrolledStudents.rows) {
            try {
                // Skip notification to the editor of the announcement
                if (student.student_id === userIdValue) {
                    continue;
                }
                
                // Create notification with metadata for redirection
                await notificationService.createNotification(
                    student.student_id,
                    'new_content',
                    notificationMessage,
                    {
                        announcement_id: announcementId,
                        course_id: course_id,
                        type: 'announcement_update',
                        redirect_url: `/courses/${course_id}/stream`
                    }
                );
            } catch (notifError) {
                console.error(`Failed to create notification for student ${student.student_id}:`, notifError);
                // Continue with other students even if one notification fails
            }
        }

        res.json(updateResult.rows[0]);
    } catch (err) {
        console.error('Error updating announcement:', err.message);
        res.status(500).json("Server error");
    }
});

// Delete announcement
router.delete("/:announcementId", authorization, async (req, res) => {
    try {
        const { announcementId } = req.params;
        const userId = req.user;
        
        // Debug logging
        console.log('DELETE announcement request received');
        console.log('AnnouncementId:', announcementId);

        // Extract user ID from token structure
        let userIdValue = userId;
        if (typeof userId === 'object' && userId !== null) {
            userIdValue = userId.id || userId.user_id;
        }
        
        // First check if the user is the author or a professor
        const authorCheckResult = await pool.query(
            `SELECT a.author_id, a.course_id, u.role 
             FROM announcement a
             JOIN users u ON u.user_id = $1
             WHERE a.announcement_id = $2`,
            [userIdValue, announcementId]
        );
        
        if (authorCheckResult.rows.length === 0) {
            return res.status(404).json({ message: "Announcement not found" });
        }
        
        const { author_id, role } = authorCheckResult.rows[0];
        
        // Only the author or a professor can delete
        if (author_id !== userIdValue && role !== 'professor') {
            return res.status(403).json({ message: "Not authorized to delete this announcement" });
        }
        
        // First get all attachments to delete the files
        const attachmentsResult = await pool.query(
            `SELECT file_name FROM announcement_attachment
             WHERE announcement_id = $1`,
            [announcementId]
        );
        
        // Delete the actual files from the uploads directory
        for (const attachment of attachmentsResult.rows) {
            try {
                const filePath = path.join(uploadDir, attachment.file_name);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted file: ${filePath}`);
                }
            } catch (fileErr) {
                console.error(`Error deleting file: ${fileErr.message}`);
                // Continue with deletion even if file removal fails
            }
        }
        
        // Delete the announcement (this will cascade delete attachments due to foreign key constraint)
        const deleteResult = await pool.query(
            `DELETE FROM announcement 
             WHERE announcement_id = $1
             RETURNING *`,
            [announcementId]
        );

        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ message: "Announcement not found" });
        }

        res.json({ success: true, message: "Announcement deleted", announcement: deleteResult.rows[0] });
    } catch (err) {
        console.error('Error deleting announcement:', err.message);
        res.status(500).json("Server error");
    }
});

// Upload attachment for an announcement
router.post("/:announcementId/attachments", authorization, upload.single('file'), async (req, res) => {
    try {
        const { announcementId } = req.params;
        
        // If there's no file
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }
        
        console.log('File uploaded:', req.file);
        
        // Get file information
        const fileName = req.body.fileName || req.file.originalname;
        const fileType = req.body.fileType || req.file.mimetype;
        const fileSize = req.file.size;
        
        // File URL to access it later
        const fileUrl = `http://localhost:5000/uploads/${req.file.filename}`;
        
        // Save attachment reference in database
        const attachmentResult = await pool.query(
            `INSERT INTO announcement_attachment 
             (announcement_id, file_name, file_url, file_type, file_size)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [announcementId, fileName, fileUrl, fileType, fileSize]
        );
        
        res.json({
            success: true,
            attachment: attachmentResult.rows[0]
        });
    } catch (err) {
        console.error('Error uploading attachment:', err.message);
        res.status(500).json("Server error");
    }
});

// Delete attachment
router.delete("/attachments/:attachmentId", authorization, async (req, res) => {
    try {
        const { attachmentId } = req.params;
        const userId = req.user;
        
        // Debug logging
        console.log('DELETE attachment request received');
        console.log('AttachmentId:', attachmentId);

        // Extract user ID from token structure
        let userIdValue = userId;
        if (typeof userId === 'object' && userId !== null) {
            userIdValue = userId.id || userId.user_id;
        }
        
        // First check if the user is the author of the announcement or a professor
        const authorCheckResult = await pool.query(
            `SELECT a.author_id, a.course_id, u.role 
             FROM announcement a
             JOIN announcement_attachment att ON a.announcement_id = att.announcement_id
             JOIN users u ON u.user_id = $1
             WHERE att.attachment_id = $2`,
            [userIdValue, attachmentId]
        );
        
        if (authorCheckResult.rows.length === 0) {
            return res.status(404).json({ message: "Attachment not found" });
        }
        
        const { author_id, role } = authorCheckResult.rows[0];
        
        // Only the author or a professor can delete
        if (author_id !== userIdValue && role !== 'professor') {
            return res.status(403).json({ message: "Not authorized to delete this attachment" });
        }
        
        // Get the file name to delete the actual file
        const fileResult = await pool.query(
            `SELECT file_name FROM announcement_attachment
             WHERE attachment_id = $1`,
            [attachmentId]
        );
        
        if (fileResult.rows.length === 0) {
            return res.status(404).json({ message: "Attachment not found" });
        }
        
        const { file_name } = fileResult.rows[0];
        
        // Delete the actual file from the uploads directory
        try {
            const filePath = path.join(uploadDir, file_name);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Deleted file: ${filePath}`);
            }
        } catch (fileErr) {
            console.error(`Error deleting file: ${fileErr.message}`);
            // Continue with deletion even if file removal fails
        }
        
        // Delete the attachment record from the database
        const deleteResult = await pool.query(
            `DELETE FROM announcement_attachment 
             WHERE attachment_id = $1
             RETURNING *`,
            [attachmentId]
        );

        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ message: "Attachment not found" });
        }

        res.json({ success: true, message: "Attachment deleted", attachment: deleteResult.rows[0] });
    } catch (err) {
        console.error('Error deleting attachment:', err.message);
        res.status(500).json("Server error");
    }
});

// Upload multiple attachments for an announcement
router.post("/:announcementId/attachments/multiple", authorization, upload.array('files', 10), async (req, res) => {
    try {
        const { announcementId } = req.params;
        
        // If there are no files
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No files uploaded" });
        }
        
        console.log('Files uploaded:', req.files.length);
        
        const attachments = [];
        
        // Save each file attachment to the database
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            
            // Get file information (use index to match multiple fileName entries)
            let fileName = req.body.fileName;
            if (Array.isArray(req.body.fileName)) {
                fileName = req.body.fileName[i] || file.originalname;
            } else {
                fileName = req.body.fileName || file.originalname;
            }
            
            // Get file type
            let fileType = req.body.fileType;
            if (Array.isArray(req.body.fileType)) {
                fileType = req.body.fileType[i] || file.mimetype;
            } else {
                fileType = req.body.fileType || file.mimetype;
            }
            
            const fileSize = file.size;
            const fileUrl = `http://localhost:5000/uploads/${file.filename}`;
            
            // Save attachment reference in database
            const attachmentResult = await pool.query(
                `INSERT INTO announcement_attachment 
                 (announcement_id, file_name, file_url, file_type, file_size)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [announcementId, fileName, fileUrl, fileType, fileSize]
            );
            
            attachments.push(attachmentResult.rows[0]);
        }
        
        res.json({
            success: true,
            attachments
        });
    } catch (err) {
        console.error('Error uploading attachments:', err.message);
        res.status(500).json("Server error");
    }
});

module.exports = router; 