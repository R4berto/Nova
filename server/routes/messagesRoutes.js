const express = require("express");
const router = express.Router();
const messagesController = require("../controllers/messagesController");
const authorize = require("../middleware/authorize");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Setup multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "../uploads/messages");
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Create a unique filename with original extension
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  }
});

// Apply authentication middleware to all routes
router.use(authorize);

// Get all conversations for the authenticated user
router.get("/conversations", messagesController.getUserConversations);

// Get messages for a specific conversation
router.get("/conversations/:conversationId/messages", messagesController.getConversationMessages);

// Get reactions for a specific conversation
router.get("/conversations/:conversationId/reactions", messagesController.getConversationReactions);

// Create a new conversation
router.post("/conversations", messagesController.createConversation);

// Update a conversation's details (name, etc.)
router.patch("/conversations/:conversationId", messagesController.updateConversation);

// Update a conversation's profile picture
router.put("/conversations/:conversationId/image", upload.single("image"), messagesController.updateConversationImage);

// Send a message (with optional file attachments)
router.post("/conversations/:conversationId/messages", upload.array("attachments", 5), messagesController.sendMessage);

// Mark all messages in a conversation as read
router.put("/conversations/:conversationId/read", messagesController.markMessagesAsRead);

// Get course participants for creating conversations
router.get("/courses/:courseId/participants", messagesController.getCourseParticipants);

// Also add the route with the new path pattern that the client is using
router.get("/conversations/courses/:courseId/participants", messagesController.getCourseParticipants);

// Delete a message
router.delete("/messages/:messageId", messagesController.deleteMessage);

// Leave a conversation
router.delete("/conversations/:conversationId/leave", messagesController.leaveConversation);

// Private messaging specific routes
router.get("/private-conversations", messagesController.getPrivateConversations);
router.get("/private-conversations/:conversationId", messagesController.getConversation);
router.post("/private-conversations", messagesController.createPrivateConversation);

// Get all users for private messaging
router.get("/users", messagesController.getAllUsers);

module.exports = router; 