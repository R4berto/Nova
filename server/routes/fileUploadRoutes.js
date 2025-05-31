const express = require('express');
const router = express.Router();
const authorization = require('../middleware/authorization');
const fileUploadController = require('../controllers/fileUploadController');

// Middleware to check if user is logged in
router.use(authorization);

/**
 * @route   POST /api/uploads/message
 * @desc    Upload file for message attachment
 * @access  Private
 */
router.post('/message', fileUploadController.messageFileUpload, fileUploadController.uploadMessageFile);

/**
 * @route   DELETE /api/uploads/file
 * @desc    Delete an uploaded file
 * @access  Private
 */
router.delete('/file', fileUploadController.deleteFile);

/**
 * @route   POST /api/uploads/delete-message-file
 * @desc    Delete a file associated with a message
 * @access  Private
 */
router.post('/delete-message-file', fileUploadController.deleteFile);

module.exports = router; 