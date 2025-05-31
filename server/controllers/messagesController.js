const pool = require("../db");
const { v4: uuidv4 } = require("uuid");

// Get all conversations for a user
exports.getUserConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to get conversations with latest message and unread count
    const conversationsQuery = `
      WITH latest_messages AS (
        SELECT DISTINCT ON (m.conversation_id) 
          m.conversation_id,
          m.message_id,
          m.sender_id,
          u.first_name || ' ' || u.last_name AS sender_name,
          m.content,
          m.sent_at
        FROM message m
        JOIN users u ON m.sender_id = u.user_id
        WHERE m.is_deleted = false
        ORDER BY m.conversation_id, m.sent_at DESC
      ),
      unread_counts AS (
        SELECT 
          m.conversation_id, 
          COUNT(*) AS unread_count
        FROM message m
        LEFT JOIN message_read_status mrs ON m.message_id = mrs.message_id AND mrs.user_id = $1
        WHERE mrs.read_at IS NULL AND m.sender_id != $1 AND m.is_deleted = false
        GROUP BY m.conversation_id
      )
      SELECT 
        c.conversation_id,
        c.name,
        c.conversation_type,
        c.course_id,
        c.created_at,
        c.updated_at,
        c.profile_picture_url,
        COALESCE(uc.unread_count, 0) AS unread_count,
        lm.message_id AS latest_message_id,
        lm.sender_id AS latest_message_sender_id,
        lm.sender_name AS latest_message_sender_name,
        lm.content AS latest_message_content,
        lm.sent_at AS latest_message_sent_at,
        (
          SELECT json_agg(json_build_object(
            'user_id', u.user_id,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'profile_picture_url', up.profile_picture_url
          ))
          FROM conversation_participant cp
          JOIN users u ON cp.user_id = u.user_id
          LEFT JOIN user_profile up ON u.user_id = up.user_id
          WHERE cp.conversation_id = c.conversation_id
        ) AS participants
      FROM conversation c
      JOIN conversation_participant cp ON c.conversation_id = cp.conversation_id
      LEFT JOIN latest_messages lm ON c.conversation_id = lm.conversation_id
      LEFT JOIN unread_counts uc ON c.conversation_id = uc.conversation_id
      WHERE cp.user_id = $1
      ORDER BY c.updated_at DESC;
    `;

    const conversations = await pool.query(conversationsQuery, [userId]);
    
    return res.json(conversations.rows);
  } catch (err) {
    console.error("Error fetching conversations:", err);
    return res.status(500).json({ error: "Server error while fetching conversations" });
  }
};

// Get messages for a specific conversation
exports.getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Check if user is a participant in the conversation
    const participantCheck = await pool.query(
      "SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: "You are not a participant in this conversation" });
    }

    // Get messages
    const messagesQuery = `
      SELECT 
        m.message_id,
        m.conversation_id,
        m.sender_id,
        u.first_name || ' ' || u.last_name AS sender_name,
        up.profile_picture_url,
        m.content,
        m.sent_at,
        m.updated_at,
        m.is_deleted,
        mrs.read_at,
        (
          SELECT json_build_object(
            'file_id', mf.file_id,
            'file_name', mf.file_name,
            'file_path', mf.file_path,
            'file_url', mf.file_url,
            'file_size', mf.file_size,
            'mime_type', mf.mime_type,
            'is_image', mf.is_image,
            'created_at', mf.created_at
          )
          FROM message_file mf
          WHERE mf.message_id = m.message_id
        ) AS attachment
      FROM message m
      JOIN users u ON m.sender_id = u.user_id
      LEFT JOIN user_profile up ON u.user_id = up.user_id
      LEFT JOIN message_read_status mrs ON m.message_id = mrs.message_id AND mrs.user_id = $1
      WHERE m.conversation_id = $2
      ORDER BY m.sent_at ASC
    `;

    const messages = await pool.query(messagesQuery, [userId, conversationId]);

    // Mark all messages as read
    await pool.query(
      `UPDATE message_read_status
       SET read_at = NOW()
       WHERE message_id IN (
         SELECT m.message_id
         FROM message m
         JOIN message_read_status mrs ON m.message_id = mrs.message_id
         WHERE m.conversation_id = $1 AND mrs.user_id = $2 AND mrs.read_at IS NULL
       )`,
      [conversationId, userId]
    );

    return res.json(messages.rows);
  } catch (err) {
    console.error("Error fetching messages:", err);
    return res.status(500).json({ error: "Server error while fetching messages" });
  }
};

// Create a new conversation
exports.createConversation = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { name, participants, conversationType, courseId } = req.body;
    const userId = req.user.id;
    
    // Add debugging logs
    console.log("Creating conversation with:", {
      userId: { value: userId, type: typeof userId },
      courseId: { value: courseId, type: typeof courseId },
      participants: participants,
      participantTypes: participants ? participants.map(p => typeof p) : []
    });
    
    // Validate participants
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: "Participants array is required" });
    }
    
    // For private conversations, ensure there are exactly 2 participants
    if (conversationType === 'private' && participants.length !== 1) {
      return res.status(400).json({ error: "Private conversations must have exactly 1 other participant" });
    }

    // Parse courseId to integer if it exists
    const courseIdInt = courseId ? parseInt(courseId, 10) : null;

    // If this is a course group chat, check if one already exists
    if (conversationType === 'group' && courseId) {
      console.log(`Checking for existing group chat for course ${courseId} (${typeof courseId})`);
      
      const courseIdStr = courseId.toString();
      
      const courseGroupChatQuery = `
        SELECT c.* 
        FROM conversation c
        WHERE c.conversation_type = 'group' 
        AND c.course_id::text = $1
        LIMIT 1
      `;
      
      const existingCourseChat = await client.query(courseGroupChatQuery, [courseIdStr]);
      console.log(`Found ${existingCourseChat.rows.length} existing chats for course ${courseIdStr}`);
      
      if (existingCourseChat.rows.length > 0) {
        // A course group chat already exists
        const existingChat = existingCourseChat.rows[0];
        console.log(`Using existing group chat: ${JSON.stringify(existingChat)}`);
        
        // Check if the current user is already a participant
        const participantCheck = await client.query(
          "SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
          [existingChat.conversation_id, userId.toString()]
        );
        
        // Only add the user if they're not already a participant
        if (participantCheck.rows.length === 0) {
          // Add the current user as a participant
          await client.query(
            `INSERT INTO conversation_participant (conversation_id, user_id, joined_at)
             VALUES ($1, $2, NOW())`,
            [existingChat.conversation_id, userId.toString()]
          );
          
          // Add system message about the new user
          const userInfo = await client.query(
            "SELECT first_name, last_name FROM users WHERE user_id = $1",
            [userId.toString()]
          );
          
          if (userInfo.rows.length > 0) {
            const userName = `${userInfo.rows[0].first_name} ${userInfo.rows[0].last_name}`;
            const systemMessage = `${userName} joined the conversation.`;
            
            await client.query(
              `INSERT INTO message (conversation_id, sender_id, content, sent_at, updated_at)
               VALUES ($1, $2, $3, NOW(), NOW())`,
              [existingChat.conversation_id, userId.toString(), systemMessage]
            );
          }
        }
        
        // Get the full conversation details with participants
        const conversationQuery = `
          SELECT 
            c.*,
            (
              SELECT json_agg(json_build_object(
                'user_id', u.user_id,
                'first_name', u.first_name,
                'last_name', u.last_name,
                'profile_picture_url', up.profile_picture_url
              ))
              FROM conversation_participant cp
              JOIN users u ON cp.user_id = u.user_id
              LEFT JOIN user_profile up ON u.user_id = up.user_id
              WHERE cp.conversation_id = c.conversation_id
            ) AS participants
          FROM conversation c
          WHERE c.conversation_id = $1
        `;
        
        const conversation = await pool.query(conversationQuery, [existingChat.conversation_id]);
        
        return res.json({
          message: "Joined existing course chat",
          conversation: conversation.rows[0]
        });
      }
    }

    // Check if private conversation already exists between these users
    if (conversationType === 'private') {
      // Make sure the participant ID is properly formatted for UUID comparison
      const safeParticipantId = participants[0].toString();
      
      const existingConversationQuery = `
        SELECT c.conversation_id 
        FROM conversation c
        JOIN conversation_participant cp1 ON c.conversation_id = cp1.conversation_id AND cp1.user_id = $1
        JOIN conversation_participant cp2 ON c.conversation_id = cp2.conversation_id AND cp2.user_id = $2
        WHERE c.conversation_type = 'private'
        AND (
          SELECT COUNT(*) 
          FROM conversation_participant 
          WHERE conversation_id = c.conversation_id
        ) = 2
      `;
      
      const existingConversation = await client.query(existingConversationQuery, [userId.toString(), safeParticipantId]);
      
      if (existingConversation.rows.length > 0) {
        // Return the existing conversation
        const conversationId = existingConversation.rows[0].conversation_id;
        
        // Get conversation details
        const conversationDetails = await client.query(
          `SELECT * FROM conversation WHERE conversation_id = $1`,
          [conversationId]
        );
        
        return res.json({ 
          message: "Conversation already exists", 
          conversation: conversationDetails.rows[0],
          conversation_id: conversationId
        });
      }
    }
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Create the conversation
    const conversationResult = await client.query(
      `INSERT INTO conversation (name, conversation_type, course_id, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [name, conversationType, courseIdInt]
    );
    
    const conversationId = conversationResult.rows[0].conversation_id;
    
    // Add the creator as a participant - ensure UUID format
    await client.query(
      `INSERT INTO conversation_participant (conversation_id, user_id, joined_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [conversationId, userId.toString()]
    );
    
    // Add other participants - ensure UUID format for each
    for (const participantId of participants) {
      console.log(`Adding participant ${participantId} (${typeof participantId}) to conversation ${conversationId}`);
      await client.query(
        `INSERT INTO conversation_participant (conversation_id, user_id, joined_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [conversationId, participantId.toString()]
      );
    }
    
    // If this is a course group chat, we need to send an initial system message
    if (conversationType === 'group' && courseId) {
      // Get the creator's name for personalized welcome message
      const userInfo = await client.query(
        "SELECT first_name, last_name FROM users WHERE user_id = $1",
        [userId.toString()]
      );
      
      let welcomeMessage = "Welcome to the course chat! Use this space to discuss course-related topics.";
      
      // Add the creator's name to the welcome message if available
      if (userInfo.rows.length > 0) {
        const userName = `${userInfo.rows[0].first_name} ${userInfo.rows[0].last_name}`;
        welcomeMessage = `Welcome to the course chat, ${userName}! This space is for course-related discussions. More participants will join as they enroll in the course.`;
      }
      
      await client.query(
        `INSERT INTO message (conversation_id, sender_id, content, sent_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [conversationId, userId.toString(), welcomeMessage]
      );
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Get the full conversation details with participants
    const conversationQuery = `
      SELECT 
        c.*,
        (
          SELECT json_agg(json_build_object(
            'user_id', u.user_id,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'profile_picture_url', up.profile_picture_url
          ))
          FROM conversation_participant cp
          JOIN users u ON cp.user_id = u.user_id
          LEFT JOIN user_profile up ON u.user_id = up.user_id
          WHERE cp.conversation_id = c.conversation_id
        ) AS participants
      FROM conversation c
      WHERE c.conversation_id = $1
    `;
    
    const conversation = await pool.query(conversationQuery, [conversationId]);
    
    return res.status(201).json(conversation.rows[0]);
  } catch (err) {
    // Rollback in case of error
    await client.query('ROLLBACK');
    console.error("Error creating conversation:", err);
    // Log more detailed error information
    console.error("Error details:", {
      message: err.message,
      stack: err.stack,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      position: err.position
    });
    return res.status(500).json({ error: "Server error while creating conversation", details: err.message });
  } finally {
    client.release();
  }
};

// Send a message
exports.sendMessage = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    
    // Validate required fields
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: "Message content is required" });
    }
    
    // Check if user is a participant in the conversation
    const participantCheck = await client.query(
      "SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );
    
    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: "You are not a participant in this conversation" });
    }
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Insert the message
    const messageResult = await client.query(
      `INSERT INTO message (conversation_id, sender_id, content, sent_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [conversationId, userId, content]
    );
    
    const messageId = messageResult.rows[0].message_id;
    
    // Handle file attachments if any
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await client.query(
          `INSERT INTO message_attachment (message_id, file_name, file_path, file_size, mime_type, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [messageId, file.originalname, file.path, file.size, file.mimetype]
        );
      }
    }
    
    // Get sender's name for notification
    const senderQuery = await client.query(
      "SELECT first_name, last_name FROM users WHERE user_id = $1",
      [userId]
    );
    const senderName = `${senderQuery.rows[0].first_name} ${senderQuery.rows[0].last_name}`;
    
    // Get other participants in the conversation to send notifications
    const participantsQuery = await client.query(
      "SELECT user_id FROM conversation_participant WHERE conversation_id = $1 AND user_id != $2",
      [conversationId, userId]
    );
    
    // Get conversation name for context in notification
    const conversationQuery = await client.query(
      "SELECT name, conversation_type, course_id FROM conversation WHERE conversation_id = $1",
      [conversationId]
    );
    const conversationName = conversationQuery.rows[0].name || 
                            (conversationQuery.rows[0].conversation_type === 'private' ? 'Private Message' : 'Group Chat');
    
    // Import notification service
    const notificationService = require('../services/notificationService');
    
    // Create notifications for all other participants
    for (const participant of participantsQuery.rows) {
      try {
        // Create notification message with context
        const notificationMessage = `New message from ${senderName} in ${conversationName}`;
        
        // Prepare notification metadata
        const notificationMetadata = {
          conversation_id: conversationId,
          message_id: messageId,
          sender_id: userId,
          sender_name: senderName,
          preview: content.substring(0, 50) + (content.length > 50 ? '...' : '')
        };
        
        // If this is a course chat, include the course_id in metadata
        if (conversationQuery.rows[0]?.course_id) {
          notificationMetadata.course_id = conversationQuery.rows[0].course_id;
        }
        
        // Create notification
        await notificationService.createNotification(
          participant.user_id,
          'message',
          notificationMessage,
          notificationMetadata
        );
      } catch (notifErr) {
        console.error("Error creating notification:", notifErr);
        // Continue even if notification fails
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Get the complete message with sender info
    const messageQuery = `
      SELECT 
        m.*,
        u.first_name || ' ' || u.last_name AS sender_name,
        up.profile_picture_url,
        (
          SELECT json_agg(json_build_object(
            'attachment_id', ma.attachment_id,
            'file_name', ma.file_name,
            'file_path', ma.file_path,
            'file_size', ma.file_size,
            'mime_type', ma.mime_type,
            'created_at', ma.created_at
          ))
          FROM message_attachment ma
          WHERE ma.message_id = m.message_id
        ) AS attachments
      FROM message m
      JOIN users u ON m.sender_id = u.user_id
      LEFT JOIN user_profile up ON u.user_id = up.user_id
      WHERE m.message_id = $1
    `;
    
    const message = await pool.query(messageQuery, [messageId]);
    
    return res.status(201).json(message.rows[0]);
  } catch (err) {
    // Rollback in case of error
    await client.query('ROLLBACK');
    console.error("Error sending message:", err);
    return res.status(500).json({ error: "Server error while sending message" });
  } finally {
    client.release();
  }
};

// Mark messages as read
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    
    // Check if user is a participant in the conversation
    const participantCheck = await pool.query(
      "SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );
    
    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: "You are not a participant in this conversation" });
    }
    
    // Mark all unread messages as read
    const updateResult = await pool.query(
      `UPDATE message_read_status
       SET read_at = NOW()
       WHERE message_id IN (
         SELECT m.message_id
         FROM message m
         JOIN message_read_status mrs ON m.message_id = mrs.message_id
         WHERE m.conversation_id = $1 AND mrs.user_id = $2 AND mrs.read_at IS NULL
       )
       RETURNING *`,
      [conversationId, userId]
    );
    
    return res.json({ 
      message: "Messages marked as read", 
      count: updateResult.rowCount 
    });
  } catch (err) {
    console.error("Error marking messages as read:", err);
    return res.status(500).json({ error: "Server error while marking messages as read" });
  }
};

// Get course participants for creating new conversations
exports.getCourseParticipants = async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Log request information
    console.log("Getting course participants for course ID:", courseId);
    
    // Convert courseId to an integer
    const courseIdInt = parseInt(courseId, 10);
    
    if (isNaN(courseIdInt)) {
      console.error("Invalid course ID format:", courseId);
      return res.status(400).json({ error: "Invalid course ID format" });
    }
    
    // Get all course participants (students and professor)
    const participantsQuery = `
      SELECT 
        u.user_id,
        u.first_name,
        u.last_name,
        u.role,
        up.profile_picture_url
      FROM users u
      LEFT JOIN user_profile up ON u.user_id = up.user_id
      WHERE u.user_id IN (
        -- Students enrolled in the course
        SELECT e.student_id
        FROM enrollment e
        WHERE e.course_id = $1
        UNION
        -- Professor of the course
        SELECT c.professor_id
        FROM course c
        WHERE c.course_id = $1
      )
      ORDER BY u.role DESC, u.last_name, u.first_name
    `;
    
    const participants = await pool.query(participantsQuery, [courseIdInt]);
    
    console.log(`Found ${participants.rows.length} participants for course ${courseId}`);
    
    return res.json(participants.rows);
  } catch (err) {
    console.error("Error fetching course participants:", err);
    return res.status(500).json({ error: "Server error while fetching course participants", details: err.message });
  }
};

// Delete a message (mark as deleted)
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    
    // Check if user is the sender of the message
    const messageCheck = await pool.query(
      "SELECT * FROM message WHERE message_id = $1 AND sender_id = $2",
      [messageId, userId]
    );
    
    if (messageCheck.rows.length === 0) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }
    
    // Mark the message as deleted
    await pool.query(
      "UPDATE message SET is_deleted = true, content = 'This message was deleted', updated_at = NOW() WHERE message_id = $1",
      [messageId]
    );
    
    return res.json({ message: "Message deleted successfully" });
  } catch (err) {
    console.error("Error deleting message:", err);
    return res.status(500).json({ error: "Server error while deleting message" });
  }
};

// Leave a conversation
exports.leaveConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    
    // Check if the conversation exists
    const conversationCheck = await pool.query(
      "SELECT * FROM conversation WHERE conversation_id = $1",
      [conversationId]
    );
    
    if (conversationCheck.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    
    // Check if user is a participant
    const participantCheck = await pool.query(
      "SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );
    
    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: "You are not a participant in this conversation" });
    }
    
    // If it's a private conversation, delete it
    if (conversationCheck.rows[0].conversation_type === 'private') {
      // Count participants
      const participantCount = await pool.query(
        "SELECT COUNT(*) FROM conversation_participant WHERE conversation_id = $1",
        [conversationId]
      );
      
      if (parseInt(participantCount.rows[0].count) <= 2) {
        // For private chats, just remove the user
        await pool.query(
          "DELETE FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
          [conversationId, userId]
        );
        
        return res.json({ message: "You have left the conversation" });
      }
    }
    
    // For group conversations, just remove the participant
    await pool.query(
      "DELETE FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );
    
    // Add a system message that the user left
    const userInfo = await pool.query(
      "SELECT first_name, last_name FROM users WHERE user_id = $1",
      [userId]
    );
    
    const userName = `${userInfo.rows[0].first_name} ${userInfo.rows[0].last_name}`;
    const systemMessage = `${userName} has left the conversation.`;
    
    await pool.query(
      `INSERT INTO message (conversation_id, sender_id, content, sent_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [conversationId, userId, systemMessage]
    );
    
    return res.json({ message: "You have left the conversation" });
  } catch (err) {
    console.error("Error leaving conversation:", err);
    return res.status(500).json({ error: "Server error while leaving conversation" });
  }
};

// Update conversation details (name, etc.)
exports.updateConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { name } = req.body;
    const userId = req.user.id;
    
    // Validate required fields
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: "Conversation name is required" });
    }
    
    // Check if conversation exists
    const conversationCheck = await pool.query(
      "SELECT * FROM conversation WHERE conversation_id = $1",
      [conversationId]
    );
    
    if (conversationCheck.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    
    // Check if user is a participant in the conversation
    const participantCheck = await pool.query(
      "SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );
    
    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: "You are not a participant in this conversation" });
    }
    
    // Update conversation name
    const updateResult = await pool.query(
      "UPDATE conversation SET name = $1, updated_at = NOW() WHERE conversation_id = $2 RETURNING *",
      [name.trim(), conversationId]
    );
    
    // Add a system message about the name change
    const userInfo = await pool.query(
      "SELECT first_name, last_name FROM users WHERE user_id = $1",
      [userId]
    );
    
    const userName = `${userInfo.rows[0].first_name} ${userInfo.rows[0].last_name}`;
    const systemMessage = `${userName} changed the conversation name to "${name.trim()}".`;
    
    await pool.query(
      `INSERT INTO message (conversation_id, sender_id, content, sent_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [conversationId, userId, systemMessage]
    );
    
    return res.json({
      message: "Conversation updated successfully",
      conversation: updateResult.rows[0]
    });
  } catch (err) {
    console.error("Error updating conversation:", err);
    return res.status(500).json({ error: "Server error while updating conversation" });
  }
};

// Get a specific conversation
exports.getConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Check if user is a participant in the conversation
    const participantCheck = await pool.query(
      "SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: "You are not a participant in this conversation" });
    }

    // Get conversation details
    const conversationQuery = `
      SELECT 
        c.*,
        (
          SELECT json_agg(json_build_object(
            'user_id', u.user_id,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'profile_picture_url', up.profile_picture_url
          ))
          FROM conversation_participant cp
          JOIN users u ON cp.user_id = u.user_id
          LEFT JOIN user_profile up ON u.user_id = up.user_id
          WHERE cp.conversation_id = c.conversation_id
        ) AS participants
      FROM conversation c
      WHERE c.conversation_id = $1
    `;

    const conversation = await pool.query(conversationQuery, [conversationId]);

    return res.json(conversation.rows[0]);
  } catch (err) {
    console.error("Error fetching conversation:", err);
    return res.status(500).json({ error: "Server error while fetching conversation" });
  }
};

// Get reactions for a specific conversation
exports.getConversationReactions = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Check if user is a participant in the conversation
    const participantCheck = await pool.query(
      "SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: "You are not a participant in this conversation" });
    }

    // Get all message reactions for this conversation
    const reactionsQuery = `
      SELECT 
        mr.message_id,
        mr.user_id,
        u.first_name || ' ' || u.last_name AS user_name,
        mr.reaction
      FROM message_reaction mr
      JOIN message m ON mr.message_id = m.message_id
      JOIN users u ON mr.user_id = u.user_id
      WHERE m.conversation_id = $1
      ORDER BY mr.created_at ASC
    `;

    const reactions = await pool.query(reactionsQuery, [conversationId]);
    
    // Format the reactions into a structured object for the frontend
    const formattedReactions = {};
    
    reactions.rows.forEach(reaction => {
      const { message_id, user_id, user_name, reaction: emoji } = reaction;
      
      if (!formattedReactions[message_id]) {
        formattedReactions[message_id] = {};
      }
      
      if (!formattedReactions[message_id][emoji]) {
        formattedReactions[message_id][emoji] = [];
      }
      
      formattedReactions[message_id][emoji].push({ user_id, user_name });
    });
    
    return res.json(formattedReactions);
  } catch (err) {
    console.error("Error fetching message reactions:", err);
    return res.status(500).json({ error: "Server error while fetching message reactions" });
  }
};

// Update conversation profile picture
exports.updateConversationImage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }
    
    // Check if conversation exists
    const conversationCheck = await pool.query(
      "SELECT * FROM conversation WHERE conversation_id = $1",
      [conversationId]
    );
    
    if (conversationCheck.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    
    // Check if user is a participant in the conversation
    const participantCheck = await pool.query(
      "SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );
    
    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: "You are not a participant in this conversation" });
    }
    
    // Create relative path for the image
    const relativeImagePath = `/uploads/messages/${req.file.filename}`;
    
    // Update the conversation table directly
    const updateResult = await pool.query(
      `UPDATE conversation 
       SET profile_picture_url = $1, updated_at = NOW() 
       WHERE conversation_id = $2
       RETURNING *`,
      [relativeImagePath, conversationId]
    );
    
    if (updateResult.rowCount === 0) {
      return res.status(500).json({ error: "Failed to update conversation image" });
    }
    
    // Add a system message about the image change
    const userInfo = await pool.query(
      "SELECT first_name, last_name FROM users WHERE user_id = $1",
      [userId]
    );
    
    const userName = `${userInfo.rows[0].first_name} ${userInfo.rows[0].last_name}`;
    const systemMessage = `${userName} updated the conversation image.`;
    
    await pool.query(
      `INSERT INTO message (conversation_id, sender_id, content, sent_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [conversationId, userId, systemMessage]
    );
    
    // Get the full updated conversation details with participants
    const conversationQuery = `
      SELECT 
        c.*,
        (
          SELECT json_agg(json_build_object(
            'user_id', u.user_id,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'profile_picture_url', up.profile_picture_url
          ))
          FROM conversation_participant cp
          JOIN users u ON cp.user_id = u.user_id
          LEFT JOIN user_profile up ON u.user_id = up.user_id
          WHERE cp.conversation_id = c.conversation_id
        ) AS participants
      FROM conversation c
      WHERE c.conversation_id = $1
    `;
    
    const conversation = await pool.query(conversationQuery, [conversationId]);
    
    // Make sure the path for the image is properly formed for client-side use
    const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
    const fullImageUrl = `${serverUrl}${relativeImagePath}`;
    
    return res.json({
      message: "Conversation image updated successfully",
      profile_picture_url: relativeImagePath,
      fullImageUrl: fullImageUrl,
      conversation: conversation.rows[0]
    });
  } catch (err) {
    console.error("Error updating conversation image:", err);
    return res.status(500).json({ error: "Server error while updating conversation image" });
  }
};

// Helper function to verify UUID format - add this at the end of the file
function isValidUUID(uuid) {
  // UUID v4 regex pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(uuid);
} 

// Get all users for private messaging
exports.getAllUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all users except the current user
    const usersQuery = `
      SELECT 
        u.user_id,
        u.first_name,
        u.last_name,
        u.role,
        up.profile_picture_url
      FROM users u
      LEFT JOIN user_profile up ON u.user_id = up.user_id
      WHERE u.user_id != $1
      ORDER BY u.role DESC, u.last_name, u.first_name
    `;
    
    const users = await pool.query(usersQuery, [userId]);
    return res.json(users.rows);
  } catch (err) {
    console.error("Error fetching users:", err);
    return res.status(500).json({ error: "Server error while fetching users" });
  }
};

// Get private conversations for a user
exports.getPrivateConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    // Query to get private conversations with latest message and unread count
    const conversationsQuery = `
      WITH latest_messages AS (
        SELECT DISTINCT ON (m.conversation_id) 
          m.conversation_id,
          m.message_id,
          m.sender_id,
          u.first_name || ' ' || u.last_name AS sender_name,
          m.content,
          m.sent_at
        FROM message m
        JOIN users u ON m.sender_id = u.user_id
        ORDER BY m.conversation_id, m.sent_at DESC
      ),
      unread_counts AS (
        SELECT 
          m.conversation_id, 
          COUNT(*) AS unread_count
        FROM message m
        LEFT JOIN message_read_status mrs ON m.message_id = mrs.message_id AND mrs.user_id = $1
        WHERE mrs.read_at IS NULL AND m.sender_id != $1 AND m.is_deleted = false
        GROUP BY m.conversation_id
      ),
      conversation_messages AS (
        SELECT 
          m.conversation_id,
          json_agg(
            json_build_object(
              'message_id', m.message_id,
              'sender_id', m.sender_id,
              'sender_name', u.first_name || ' ' || u.last_name,
              'content', m.content,
              'sent_at', m.sent_at,
              'profile_picture_url', up.profile_picture_url,
              'is_deleted', m.is_deleted,
              'attachment', (
                SELECT json_build_object(
                  'file_id', mf.file_id,
                  'file_name', mf.file_name,
                  'file_path', mf.file_path,
                  'file_url', mf.file_url,
                  'file_size', mf.file_size,
                  'mime_type', mf.mime_type,
                  'is_image', mf.is_image,
                  'created_at', mf.created_at
                )
                FROM message_file mf
                WHERE mf.message_id = m.message_id
              )
            ) ORDER BY m.sent_at ASC
          ) as messages
        FROM message m
        JOIN users u ON m.sender_id = u.user_id
        LEFT JOIN user_profile up ON u.user_id = up.user_id
        GROUP BY m.conversation_id
      )
      SELECT 
        c.conversation_id,
        c.name,
        c.conversation_type,
        c.created_at,
        c.updated_at,
        c.profile_picture_url,
        COALESCE(uc.unread_count, 0) AS unread_count,
        lm.message_id AS latest_message_id,
        lm.sender_id AS latest_message_sender_id,
        lm.sender_name AS latest_message_sender_name,
        lm.content AS latest_message_content,
        lm.sent_at AS latest_message_sent_at,
        (
          SELECT json_agg(json_build_object(
            'user_id', u.user_id,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'profile_picture_url', up.profile_picture_url,
            'role', u.role
          ))
          FROM conversation_participant cp
          JOIN users u ON cp.user_id = u.user_id
          LEFT JOIN user_profile up ON u.user_id = up.user_id
          WHERE cp.conversation_id = c.conversation_id
        ) AS participants,
        COALESCE(cm.messages, '[]'::json) as messages
      FROM conversation c
      JOIN conversation_participant cp ON c.conversation_id = cp.conversation_id
      LEFT JOIN latest_messages lm ON c.conversation_id = lm.conversation_id
      LEFT JOIN unread_counts uc ON c.conversation_id = uc.conversation_id
      LEFT JOIN conversation_messages cm ON c.conversation_id = cm.conversation_id
      WHERE cp.user_id = $1
      AND c.conversation_type = 'private'
      ORDER BY c.updated_at DESC
    `;

    const conversations = await pool.query(conversationsQuery, [userId]);
    
    // Process the results to match the frontend expectations
    const processedConversations = conversations.rows.map(conv => ({
      ...conv,
      last_message: conv.latest_message_content,
      last_message_time: conv.latest_message_sent_at,
      messages: conv.messages ? conv.messages.reverse() : [] // Reverse to get chronological order
    }));

    return res.json(processedConversations);
  } catch (err) {
    console.error("Error fetching private conversations:", err);
    return res.status(500).json({ error: "Server error while fetching conversations" });
  }
};

// Create a new private conversation
exports.createPrivateConversation = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { participant_id } = req.body;
    const userId = req.user.id;
    
    if (!participant_id) {
      return res.status(400).json({ error: "Participant ID is required" });
    }

    // Check if a private conversation already exists between these users
    const existingConversationQuery = `
      SELECT c.conversation_id 
      FROM conversation c
      JOIN conversation_participant cp1 ON c.conversation_id = cp1.conversation_id AND cp1.user_id = $1
      JOIN conversation_participant cp2 ON c.conversation_id = cp2.conversation_id AND cp2.user_id = $2
      WHERE c.conversation_type = 'private'
      AND (
        SELECT COUNT(*) 
        FROM conversation_participant 
        WHERE conversation_id = c.conversation_id
      ) = 2
    `;
    
    const existingConversation = await client.query(existingConversationQuery, [userId, participant_id]);
    
    if (existingConversation.rows.length > 0) {
      // Return the existing conversation with full details
      const conversationId = existingConversation.rows[0].conversation_id;
      const conversationDetails = await client.query(
        `SELECT 
          c.*,
          (
            SELECT json_agg(json_build_object(
              'user_id', u.user_id,
              'first_name', u.first_name,
              'last_name', u.last_name,
              'profile_picture_url', up.profile_picture_url,
              'role', u.role
            ))
            FROM conversation_participant cp
            JOIN users u ON cp.user_id = u.user_id
            LEFT JOIN user_profile up ON u.user_id = up.user_id
            WHERE cp.conversation_id = c.conversation_id
          ) AS participants
        FROM conversation c
        WHERE c.conversation_id = $1`,
        [conversationId]
      );
      
      return res.json(conversationDetails.rows[0]);
    }
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Create new private conversation
    const conversationResult = await client.query(
      `INSERT INTO conversation (conversation_type, created_at, updated_at)
       VALUES ('private', NOW(), NOW())
       RETURNING *`
    );
    
    const conversationId = conversationResult.rows[0].conversation_id;
    
    // Add both users as participants
    await client.query(
      `INSERT INTO conversation_participant (conversation_id, user_id, joined_at)
       VALUES ($1, $2, NOW()), ($1, $3, NOW())`,
      [conversationId, userId, participant_id]
    );
    
    // Get the full conversation details with participants
    const conversationQuery = `
      SELECT 
        c.*,
        (
          SELECT json_agg(json_build_object(
            'user_id', u.user_id,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'profile_picture_url', up.profile_picture_url,
            'role', u.role
          ))
          FROM conversation_participant cp
          JOIN users u ON cp.user_id = u.user_id
          LEFT JOIN user_profile up ON u.user_id = up.user_id
          WHERE cp.conversation_id = c.conversation_id
        ) AS participants
      FROM conversation c
      WHERE c.conversation_id = $1
    `;
    
    const newConversation = await client.query(conversationQuery, [conversationId]);
    
    await client.query('COMMIT');
    
    return res.json(newConversation.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error creating private conversation:", err);
    return res.status(500).json({ error: "Server error while creating conversation" });
  } finally {
    client.release();
  }
};

// Get a specific conversation
exports.getConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Check if user is a participant in the conversation
    const participantCheck = await pool.query(
      "SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: "You are not a participant in this conversation" });
    }

    // Get conversation details
    const conversationQuery = `
      SELECT 
        c.conversation_id,
        c.name,
        c.conversation_type,
        c.created_at,
        c.updated_at,
        c.profile_picture_url,
        (
          SELECT json_agg(json_build_object(
            'user_id', u.user_id,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'profile_picture_url', up.profile_picture_url,
            'role', u.role
          ))
          FROM conversation_participant cp
          JOIN users u ON cp.user_id = u.user_id
          LEFT JOIN user_profile up ON u.user_id = up.user_id
          WHERE cp.conversation_id = c.conversation_id
        ) AS participants,
        (
          SELECT json_agg(json_build_object(
            'message_id', m.message_id,
            'sender_id', m.sender_id,
            'sender_name', u.first_name || ' ' || u.last_name,
            'content', m.content,
            'sent_at', m.sent_at,
            'profile_picture_url', up.profile_picture_url,
            'is_deleted', m.is_deleted,
            'attachment', (
              SELECT json_build_object(
                'file_id', mf.file_id,
                'file_name', mf.file_name,
                'file_path', mf.file_path,
                'file_url', mf.file_url,
                'file_size', mf.file_size,
                'mime_type', mf.mime_type,
                'is_image', mf.is_image,
                'created_at', mf.created_at
              )
              FROM message_file mf
              WHERE mf.message_id = m.message_id
            )
          ) ORDER BY m.sent_at DESC)
          FROM message m
          JOIN users u ON m.sender_id = u.user_id
          LEFT JOIN user_profile up ON u.user_id = up.user_id
          WHERE m.conversation_id = c.conversation_id
        ) AS messages
      FROM conversation c
      WHERE c.conversation_id = $1
    `;

    const conversation = await pool.query(conversationQuery, [conversationId]);

    if (conversation.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Mark all messages as read
    await pool.query(`
      INSERT INTO message_read_status (message_id, user_id, read_at)
      SELECT m.message_id, $1, NOW()
      FROM message m
      LEFT JOIN message_read_status mrs 
        ON m.message_id = mrs.message_id AND mrs.user_id = $1
      WHERE m.conversation_id = $2
        AND m.sender_id != $1
        AND mrs.read_at IS NULL
    `, [userId, conversationId]);

    return res.json(conversation.rows[0]);
  } catch (err) {
    console.error("Error fetching conversation:", err);
    return res.status(500).json({ error: "Server error while fetching conversation" });
  }
};

// Get reactions for a specific conversation
exports.getConversationReactions = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Check if user is a participant in the conversation
    const participantCheck = await pool.query(
      "SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: "You are not a participant in this conversation" });
    }

    // Get all message reactions for this conversation
    const reactionsQuery = `
      SELECT 
        mr.message_id,
        mr.user_id,
        u.first_name || ' ' || u.last_name AS user_name,
        mr.reaction
      FROM message_reaction mr
      JOIN message m ON mr.message_id = m.message_id
      JOIN users u ON mr.user_id = u.user_id
      WHERE m.conversation_id = $1
      ORDER BY mr.created_at ASC
    `;

    const reactions = await pool.query(reactionsQuery, [conversationId]);
    
    // Format the reactions into a structured object for the frontend
    const formattedReactions = {};
    
    reactions.rows.forEach(reaction => {
      const { message_id, user_id, user_name, reaction: emoji } = reaction;
      
      if (!formattedReactions[message_id]) {
        formattedReactions[message_id] = {};
      }
      
      if (!formattedReactions[message_id][emoji]) {
        formattedReactions[message_id][emoji] = [];
      }
      
      formattedReactions[message_id][emoji].push({ user_id, user_name });
    });
    
    return res.json(formattedReactions);
  } catch (err) {
    console.error("Error fetching message reactions:", err);
    return res.status(500).json({ error: "Server error while fetching message reactions" });
  }
};