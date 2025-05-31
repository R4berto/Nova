const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const { processMessageLinks, extractUrls } = require('./services/linkPreviewService');

let io;

const initializeWebSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      // Try multiple token locations
      let token = socket.handshake.auth.token;
      
      // Look for token in headers if not in auth
      if (!token) {
        const authHeader = socket.handshake.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        } else if (socket.handshake.headers.jwt_token) {
          token = socket.handshake.headers.jwt_token;
        } else if (socket.handshake.headers.token) {
          token = socket.handshake.headers.token;
        }
      }
      
      // Look for token in query params as last resort
      if (!token && socket.handshake.query && socket.handshake.query.token) {
        token = socket.handshake.query.token;
      }
      
      if (!token) {
        console.error('WebSocket: No token provided');
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Extract user ID from token, handling different token structures
      let userId;
      if (decoded.user && decoded.user.id) {
        userId = decoded.user.id;
      } else if (decoded.user && decoded.user.user_id) {
        userId = decoded.user.user_id;
      } else if (decoded.id) {
        userId = decoded.id;
      } else if (decoded.user_id) {
        userId = decoded.user_id;
      } else {
        console.error('WebSocket: Invalid token structure', decoded);
        return next(new Error('Authentication error: Invalid token structure'));
      }
      
      // Get user from database
      const result = await pool.query(
        'SELECT user_id, first_name, last_name, role FROM users WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        console.error(`WebSocket: User not found for ID ${userId}`);
        return next(new Error('User not found'));
      }

      socket.user = result.rows[0];
      console.log(`WebSocket: User authenticated: ${socket.user.user_id} (${socket.user.first_name} ${socket.user.last_name})`);
      next();
    } catch (err) {
      console.error('WebSocket authentication error:', err);
      return next(new Error('Authentication error: ' + (err.message || 'Unknown error')));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.user_id}`);

    // Join user's room for private messages
    const roomName = `user:${socket.user.user_id}`;
    socket.join(roomName);
    console.log(`User ${socket.user.user_id} joined room ${roomName}`);
    
    // Confirm room subscription to client
    socket.emit('room_joined', { room: roomName });

    // Handle join event explicitly
    socket.on('join', (room) => {
      console.log(`User ${socket.user.user_id} requested to join room: ${room}`);
      if (room === roomName || room === `user:${socket.user.user_id}`) {
        socket.join(room);
        console.log(`User ${socket.user.user_id} joined room ${room}`);
        socket.emit('room_joined', { room });
      } else {
        console.warn(`User ${socket.user.user_id} attempted to join unauthorized room: ${room}`);
      }
    });

    // Handle send_message event
    socket.on('send_message', async (data, callback) => {
      try {
        console.log(`User ${socket.user.user_id} sending message to conversation ${data.conversation_id}`);
        const { conversation_id, content } = data;
        const userId = socket.user.user_id;
        
        // Validate required fields
        if (!conversation_id || !content || content.trim() === '') {
          console.error('Invalid message data:', data);
          if (callback) callback({ error: "Message content and conversation ID are required" });
          return;
        }
        
        // Check if user is a participant in the conversation
        const participantCheck = await pool.query(
          "SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
          [conversation_id, userId]
        );
        
        if (participantCheck.rows.length === 0) {
          console.error(`User ${userId} is not a participant in conversation ${conversation_id}`);
          if (callback) callback({ error: "You are not a participant in this conversation" });
          return;
        }
        
        // Begin transaction
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          // Insert the message
          const messageResult = await client.query(
            `INSERT INTO message (conversation_id, sender_id, content, sent_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             RETURNING *`,
            [conversation_id, userId, content]
          );
          
          const messageId = messageResult.rows[0].message_id;
          
          // Update conversation's updated_at timestamp
          await client.query(
            `UPDATE conversation SET updated_at = NOW() WHERE conversation_id = $1`,
            [conversation_id]
          );
          
          // Insert read status records for all participants (marking as unread for everyone except sender)
          // Use ON CONFLICT DO NOTHING to prevent duplicate key errors with the database trigger
          const participantsResult = await client.query(
            "SELECT user_id FROM conversation_participant WHERE conversation_id = $1",
            [conversation_id]
          );
          
          for (const participant of participantsResult.rows) {
            await client.query(
              `INSERT INTO message_read_status (message_id, user_id, read_at)
               VALUES ($1, $2, $3)
               ON CONFLICT (message_id, user_id) DO NOTHING`,
              [messageId, participant.user_id, participant.user_id === userId ? 'NOW()' : null]
            );
          }
          
          // Commit transaction
          await client.query('COMMIT');
          
          // Get the complete message with sender info for broadcasting
          const messageQuery = `
            SELECT 
              m.*,
              u.first_name || ' ' || u.last_name AS sender_name,
              up.profile_picture_url
            FROM message m
            JOIN users u ON m.sender_id = u.user_id
            LEFT JOIN user_profile up ON u.user_id = up.user_id
            WHERE m.message_id = $1
          `;
          
          const message = await client.query(messageQuery, [messageId]);
          const completeMessage = message.rows[0];
          
          // Broadcast to all participants in the conversation
          for (const participant of participantsResult.rows) {
            io.to(`user:${participant.user_id}`).emit('new_message', completeMessage);
          }
          
          // Send acknowledgement back to sender
          if (callback) callback({ success: true, message: completeMessage });
          
          console.log(`Message sent successfully: ${messageId}`);
        } catch (err) {
          // Rollback in case of error
          await client.query('ROLLBACK');
          console.error("Error in send_message transaction:", err);
          if (callback) callback({ error: "Failed to send message: " + err.message });
        } finally {
          client.release();
        }
      } catch (err) {
        console.error("Error handling socket message:", err);
        if (callback) callback({ error: "Failed to send message: " + err.message });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', async (data) => {
      try {
        const { conversation_id } = data;
        const userId = socket.user.user_id;
        
        // Check if user is a participant in the conversation
        const participantCheck = await pool.query(
          "SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
          [conversation_id, userId]
        );
        
        if (participantCheck.rows.length === 0) {
          return; // Silently fail if not a participant
        }
        
        // Get user's name for the typing indicator
        const userName = `${socket.user.first_name} ${socket.user.last_name}`;
        
        // Broadcast typing indicator to all other participants
        const participantsResult = await pool.query(
          "SELECT user_id FROM conversation_participant WHERE conversation_id = $1 AND user_id != $2",
          [conversation_id, userId]
        );
        
        for (const participant of participantsResult.rows) {
          io.to(`user:${participant.user_id}`).emit('typing_indicator', {
            conversation_id,
            user_id: userId,
            user_name: userName,
            is_typing: true
          });
        }
      } catch (err) {
        console.error("Error handling typing indicator:", err);
      }
    });
    
    socket.on('typing_end', async (data) => {
      try {
        const { conversation_id } = data;
        const userId = socket.user.user_id;
        
        // Check if user is a participant in the conversation
        const participantCheck = await pool.query(
          "SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
          [conversation_id, userId]
        );
        
        if (participantCheck.rows.length === 0) {
          return; // Silently fail if not a participant
        }
        
        // Get user's name for the typing indicator
        const userName = `${socket.user.first_name} ${socket.user.last_name}`;
        
        // Broadcast typing end to all other participants
        const participantsResult = await pool.query(
          "SELECT user_id FROM conversation_participant WHERE conversation_id = $1 AND user_id != $2",
          [conversation_id, userId]
        );
        
        for (const participant of participantsResult.rows) {
          io.to(`user:${participant.user_id}`).emit('typing_indicator', {
            conversation_id,
            user_id: userId,
            user_name: userName,
            is_typing: false
          });
        }
      } catch (err) {
        console.error("Error handling typing end indicator:", err);
      }
    });
    
    // Handle mark_as_read event
    socket.on('mark_as_read', async (data) => {
      try {
        const { conversation_id } = data;
        const userId = socket.user.user_id;
        
        // Check if user is a participant in the conversation
        const participantCheck = await pool.query(
          "SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2",
          [conversation_id, userId]
        );
        
        if (participantCheck.rows.length === 0) {
          return; // Silently fail if not a participant
        }
        
        // Mark all unread messages as read
        await pool.query(
          `UPDATE message_read_status
           SET read_at = NOW()
           WHERE message_id IN (
             SELECT m.message_id
             FROM message m
             JOIN message_read_status mrs ON m.message_id = mrs.message_id
             WHERE m.conversation_id = $1 AND mrs.user_id = $2 AND mrs.read_at IS NULL
           )`,
          [conversation_id, userId]
        );
        
        // Notify other participants that messages have been read
        const participantsResult = await pool.query(
          "SELECT user_id FROM conversation_participant WHERE conversation_id = $1 AND user_id != $2",
          [conversation_id, userId]
        );
        
        for (const participant of participantsResult.rows) {
          io.to(`user:${participant.user_id}`).emit('messages_read', {
            conversation_id,
            user_id: userId,
            read_at: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error("Error marking messages as read:", err);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.user_id}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.user.user_id}:`, error);
    });

    // Handle private message sending
    socket.on('send_private_message', async (data, callback) => {
      const client = await pool.connect();
      try {
        const { conversation_id, content, forwarded_from, file_attachment } = data;
        const userId = socket.user.user_id;
        
        // Validate required fields - message can be empty if file is attached
        if (!conversation_id) {
          if (callback) callback({ error: "Conversation ID is required" });
          return;
        }
        
        if ((!content || content.trim() === '') && !file_attachment) {
          if (callback) callback({ error: "Message content or file attachment is required" });
          return;
        }
        
        // Check if user is a participant in the conversation
        const participantCheck = await client.query(
          `SELECT * FROM conversation_participant WHERE conversation_id = $1 AND user_id = $2`,
          [conversation_id, userId]
        );
        
        if (participantCheck.rows.length === 0) {
          if (callback) callback({ error: "You are not a participant in this conversation" });
          return;
        }
        
        // Begin transaction
        await client.query('BEGIN');
        
        // Insert the message
        const messageResult = await client.query(
          `INSERT INTO message (conversation_id, sender_id, content, sent_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           RETURNING *`,
          [conversation_id, userId, content || '']
        );
        
        const messageId = messageResult.rows[0].message_id;
        
        // Create automatic read status for sender
        await client.query(
          `INSERT INTO message_read_status (message_id, user_id, read_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (message_id, user_id) DO NOTHING`,
          [messageId, userId]
        );
        
        // Handle file attachment if provided
        let attachmentData = null;
        if (file_attachment) {
          console.log("Processing file attachment:", file_attachment);
          
          try {
            // Create or use the file_url from the attachment
            // Since we're in websocket context, we don't have access to req
            // We'll use the file_url if provided, or construct one from the base URL and file_path
            const baseUrl = process.env.SERVER_URL || 'http://localhost:5000';
            const fileUrl = file_attachment.file_url || 
                          (file_attachment.file_path ? `${baseUrl}${file_attachment.file_path}` : null);
            
            // Add file_url to the INSERT query
            const attachmentResult = await client.query(
              `INSERT INTO message_file (message_id, file_name, file_path, file_size, mime_type, is_image, file_url, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
               RETURNING *`,
              [
                messageId, 
                file_attachment.file_name, 
                file_attachment.file_path, 
                file_attachment.file_size, 
                file_attachment.mime_type, 
                file_attachment.is_image || file_attachment.mime_type.startsWith('image/'),
                fileUrl // Store the full URL in the database
              ]
            );
            
            attachmentData = {
              ...attachmentResult.rows[0],
              file_url: fileUrl
            };
            
            console.log("Attachment added to database:", attachmentData);
          } catch (err) {
            console.error("Error inserting file attachment:", err);
            throw err;
          }
        }
        
        // Handle forwarded message metadata
        if (forwarded_from) {
          await client.query(
            `UPDATE message 
             SET forwarded_from_message_id = $1, forwarded_from_sender_name = $2
             WHERE message_id = $3`,
            [forwarded_from.message_id, forwarded_from.sender_name, messageId]
          );
        }
        
        // Update conversation's last activity timestamp
        await client.query(
          `UPDATE conversation SET updated_at = NOW() WHERE conversation_id = $1`,
          [conversation_id]
        );
        
        // Commit transaction
        await client.query('COMMIT');
        
        // Get sender information
        const userInfo = await pool.query(
          `SELECT first_name || ' ' || last_name AS sender_name, user_profile.profile_picture_url
           FROM users
           LEFT JOIN user_profile ON users.user_id = user_profile.user_id 
           WHERE users.user_id = $1`,
          [userId]
        );
        
        const senderName = userInfo.rows[0].sender_name;
        const profilePictureUrl = userInfo.rows[0]?.profile_picture_url || null;
        
        // Create message object to broadcast
        const messageObject = {
          message_id: messageId,
          conversation_id,
          sender_id: userId,
          sender_name: senderName,
          content: content || '',
          sent_at: messageResult.rows[0].sent_at,
          profile_picture_url: profilePictureUrl,
          is_deleted: false
        };
        
        // Add attachment data if exists
        if (attachmentData) {
          messageObject.attachment = {
            file_id: attachmentData.file_id,
            file_name: attachmentData.file_name,
            file_path: attachmentData.file_path,
            file_size: attachmentData.file_size,
            mime_type: attachmentData.mime_type,
            is_image: attachmentData.is_image,
            created_at: attachmentData.created_at,
            file_url: attachmentData.file_url
          };
        }
        
        // Add forwarded data if exists
        if (forwarded_from) {
          messageObject.forwarded_from = {
            message_id: forwarded_from.message_id,
            sender_name: forwarded_from.sender_name
          };
        }
        
        // Get conversation participants
        const participants = await pool.query(
          `SELECT user_id FROM conversation_participant WHERE conversation_id = $1`,
          [conversation_id]
        );
        
        // Import notification service
        const notificationService = require('./services/notificationService');
        
        // Get conversation name for context in notification
        const conversationQuery = await pool.query(
          "SELECT name, conversation_type, course_id FROM conversation WHERE conversation_id = $1",
          [conversation_id]
        );
        const conversationName = conversationQuery.rows[0]?.name || 
                                (conversationQuery.rows[0]?.conversation_type === 'private' ? 'Private Message' : 'Group Chat');
        
        // Send message to all participants and create notifications for recipients
        for (const participant of participants.rows) {
          // Send the message via WebSocket
          io.to(`user:${participant.user_id}`).emit('new_message', messageObject);
          
          // Create notification for recipients (not for the sender)
          if (participant.user_id !== userId) {
            try {
              // Create notification message with context
              const notificationMessage = `New message from ${senderName} in ${conversationName}`;
              
              // Prepare notification metadata
              const notificationMetadata = {
                conversation_id: conversation_id,
                message_id: messageId,
                sender_id: userId,
                sender_name: senderName,
                preview: content ? content.substring(0, 50) + (content.length > 50 ? '...' : '') : 'File attachment'
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
              console.log(`Created notification for user ${participant.user_id} about new message ${messageId}`);
            } catch (notifErr) {
              console.error("Error creating notification:", notifErr);
              // Continue even if notification fails
            }
          }
        }
        
        // Return success with message data
        if (callback) callback({ success: true, message: messageObject });
        
      } catch (err) {
        // Rollback in case of error
        await client.query('ROLLBACK');
        console.error("Error sending message:", err);
        if (callback) callback({ error: "Failed to send message: " + err.message });
      } finally {
        client.release();
      }
    });

    // Handle private message read status
    socket.on('mark_private_message_read', async (data) => {
      try {
        const { conversation_id } = data;
        const userId = socket.user.id;

        // Mark all messages in the conversation as read for this user
        await pool.query(
          `INSERT INTO message_read_status (message_id, user_id, read_at)
           SELECT m.message_id, $1, NOW()
           FROM message m
           WHERE m.conversation_id = $2
           AND m.sender_id != $1
           AND NOT EXISTS (
             SELECT 1 
             FROM message_read_status mrs 
             WHERE mrs.message_id = m.message_id 
             AND mrs.user_id = $1
           )`,
          [userId, conversation_id]
        );

        // Get conversation participants
        const participants = await pool.query(
          `SELECT user_id 
           FROM conversation_participant 
           WHERE conversation_id = $1`,
          [conversation_id]
        );

        // Notify other participants that messages were read
        participants.rows.forEach(participant => {
          if (participant.user_id !== userId) {
            const participantSocket = userSockets.get(participant.user_id);
            if (participantSocket) {
              io.to(participantSocket).emit('private_messages_read', {
                conversation_id,
                read_by: userId
              });
            }
          }
        });

      } catch (err) {
        console.error('Error marking private messages as read:', err);
        socket.emit('error', { message: 'Error marking messages as read' });
      }
    });

    // Handle typing indicator for private messages
    socket.on('private_typing', async (data) => {
      try {
        const { conversation_id, is_typing } = data;
        const userId = socket.user.id;

        // Verify user is a participant in the conversation
        const participantCheck = await pool.query(
          `SELECT 1 
           FROM conversation_participant 
           WHERE conversation_id = $1 
           AND user_id = $2`,
          [conversation_id, userId]
        );

        if (participantCheck.rows.length === 0) {
          return;
        }

        // Get other participants
        const participants = await pool.query(
          `SELECT user_id 
           FROM conversation_participant 
           WHERE conversation_id = $1 
           AND user_id != $2`,
          [conversation_id, userId]
        );

        // Notify other participants about typing status
        participants.rows.forEach(participant => {
          const participantSocket = userSockets.get(participant.user_id);
          if (participantSocket) {
            io.to(participantSocket).emit('private_typing_status', {
              conversation_id,
              user_id: userId,
              is_typing
            });
          }
        });

      } catch (err) {
        console.error('Error handling typing indicator:', err);
      }
    });

    // Handle message reactions
    socket.on('add_reaction', async (data, callback) => {
      try {
        const { message_id, reaction } = data;
        const userId = socket.user.user_id;
        
        // Validate message_id and reaction
        if (!message_id || !reaction) {
          if (callback) callback({ error: "Message ID and reaction are required" });
          return;
        }
        
        // Check if user has permission to react to this message
        const messageCheck = await pool.query(
          `SELECT m.message_id, m.conversation_id 
           FROM message m
           JOIN conversation_participant cp ON m.conversation_id = cp.conversation_id
           WHERE m.message_id = $1 AND cp.user_id = $2`,
          [message_id, userId]
        );
        
        if (messageCheck.rows.length === 0) {
          if (callback) callback({ error: "Message not found or you don't have permission" });
          return;
        }
        
        const conversationId = messageCheck.rows[0].conversation_id;
        
        // Add reaction to database, if exists update
        await pool.query(
          `INSERT INTO message_reaction (message_id, user_id, reaction)
           VALUES ($1, $2, $3)
           ON CONFLICT (message_id, user_id, reaction) DO NOTHING`,
          [message_id, userId, reaction]
        );
        
        // Get user info for the response
        const userInfo = await pool.query(
          `SELECT first_name || ' ' || last_name AS user_name
           FROM users WHERE user_id = $1`,
          [userId]
        );
        
        const userName = userInfo.rows[0].user_name;
        
        // Get all participants of this conversation
        const participants = await pool.query(
          `SELECT user_id FROM conversation_participant WHERE conversation_id = $1`,
          [conversationId]
        );
        
        // Broadcast the reaction to all participants
        for (const participant of participants.rows) {
          io.to(`user:${participant.user_id}`).emit('message_reaction', {
            message_id,
            user_id: userId,
            user_name: userName,
            reaction
          });
        }
        
        if (callback) callback({ success: true });
        
      } catch (err) {
        console.error("Error adding reaction:", err);
        if (callback) callback({ error: "Failed to add reaction: " + err.message });
      }
    });
    
    // Handle removing message reactions
    socket.on('remove_reaction', async (data, callback) => {
      try {
        const { message_id, reaction } = data;
        const userId = socket.user.user_id;
        
        // Validate message_id and reaction
        if (!message_id || !reaction) {
          if (callback) callback({ error: "Message ID and reaction are required" });
          return;
        }
        
        // Check if the reaction exists
        const reactionCheck = await pool.query(
          `SELECT message_id, user_id, reaction FROM message_reaction
           WHERE message_id = $1 AND user_id = $2 AND reaction = $3`,
          [message_id, userId, reaction]
        );
        
        if (reactionCheck.rows.length === 0) {
          if (callback) callback({ error: "Reaction not found" });
          return;
        }
        
        // Get the conversation ID for this message
        const messageInfo = await pool.query(
          `SELECT conversation_id FROM message WHERE message_id = $1`,
          [message_id]
        );
        
        if (messageInfo.rows.length === 0) {
          if (callback) callback({ error: "Message not found" });
          return;
        }
        
        const conversationId = messageInfo.rows[0].conversation_id;
        
        // Remove the reaction
        await pool.query(
          `DELETE FROM message_reaction
           WHERE message_id = $1 AND user_id = $2 AND reaction = $3`,
          [message_id, userId, reaction]
        );
        
        // Get user info for the response
        const userInfo = await pool.query(
          `SELECT first_name || ' ' || last_name AS user_name
           FROM users WHERE user_id = $1`,
          [userId]
        );
        
        const userName = userInfo.rows[0].user_name;
        
        // Get all participants of this conversation
        const participants = await pool.query(
          `SELECT user_id FROM conversation_participant WHERE conversation_id = $1`,
          [conversationId]
        );
        
        // Broadcast the removal to all participants
        for (const participant of participants.rows) {
          io.to(`user:${participant.user_id}`).emit('message_reaction_removed', {
            message_id,
            user_id: userId,
            user_name: userName,
            reaction
          });
        }
        
        if (callback) callback({ success: true });
        
      } catch (err) {
        console.error("Error removing reaction:", err);
        if (callback) callback({ error: "Failed to remove reaction: " + err.message });
      }
    });
    
    // Handle message deletion
    socket.on('delete_message', async (data, callback) => {
      try {
        const { message_id } = data;
        const userId = socket.user.user_id;
        
        // Validate message_id
        if (!message_id) {
          if (callback) callback({ error: "Message ID is required" });
          return;
        }
        
        // Check if the user is the sender of the message
        const messageCheck = await pool.query(
          `SELECT m.message_id, m.conversation_id, m.sender_id 
           FROM message m 
           WHERE m.message_id = $1`,
          [message_id]
        );
        
        if (messageCheck.rows.length === 0) {
          if (callback) callback({ error: "Message not found" });
          return;
        }
        
        if (messageCheck.rows[0].sender_id !== userId) {
          if (callback) callback({ error: "You can only delete your own messages" });
          return;
        }
        
        const conversationId = messageCheck.rows[0].conversation_id;
        
        // Check if message has file attachments
        const attachmentCheck = await pool.query(
          `SELECT * FROM message_attachment WHERE message_id = $1`,
          [message_id]
        );
        
        // Mark the message as deleted
        await pool.query(
          `UPDATE message 
           SET is_deleted = true, content = 'This message was deleted', updated_at = NOW() 
           WHERE message_id = $1`,
          [message_id]
        );
        
        // Get all participants of this conversation
        const participants = await pool.query(
          `SELECT user_id FROM conversation_participant WHERE conversation_id = $1`,
          [conversationId]
        );
        
        // Broadcast the deletion to all participants
        for (const participant of participants.rows) {
          io.to(`user:${participant.user_id}`).emit('message_deleted', {
            message_id,
            conversation_id: conversationId,
            has_attachment: attachmentCheck.rows.length > 0
          });
        }
        
        if (callback) callback({ success: true, has_attachment: attachmentCheck.rows.length > 0 });
        
      } catch (err) {
        console.error("Error deleting message:", err);
        if (callback) callback({ error: "Failed to delete message: " + err.message });
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    console.warn('WebSocket not initialized yet');
    return null;
  }
  return io;
};

module.exports = {
  initializeWebSocket,
  getIO
};
