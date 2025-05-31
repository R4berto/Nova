const pool = require('../db');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Define directory based on file type
    let uploadDir = 'uploads/messages';
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(path.join(__dirname, '..', uploadDir))) {
      fs.mkdirSync(path.join(__dirname, '..', uploadDir), { recursive: true });
    }
    
    cb(null, path.join(__dirname, '..', uploadDir));
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniquePrefix = `${Date.now()}-${uuidv4()}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniquePrefix}${ext}`);
  }
});

// Create multer upload instance
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now, can restrict later
    cb(null, true);
  }
});

// Upload middleware for messages
const messageFileUpload = upload.single('file');

// Handle file upload for messages
const uploadMessageFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const isImage = req.file.mimetype.startsWith('image/');
    
    // Format server URL
    const serverUrl = `${req.protocol}://${req.get('host')}`;
    const relativePath = `/uploads/messages/${req.file.filename}`;
    const fileUrl = `${serverUrl}${relativePath}`;
    
    // Return a consistent structure with all needed fields
    return res.json({
      success: true,
      file_name: req.file.originalname || 'unnamed_file',
      file_path: relativePath,
      file_url: fileUrl,
      file_size: req.file.size || 0,
      mime_type: req.file.mimetype || 'application/octet-stream',
      is_image: isImage
    });
  } catch (err) {
    console.error('Error uploading file:', err);
    return res.status(500).json({ error: 'Server error while uploading file' });
  }
};

// Delete file from storage
const deleteFile = async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    // Make sure the path is from uploads/messages for security
    if (!filePath.startsWith('/uploads/messages/')) {
      return res.status(403).json({ error: 'Invalid file path' });
    }
    
    const fullPath = path.join(__dirname, '..', filePath);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Delete the file
    fs.unlinkSync(fullPath);
    
    return res.json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error('Error deleting file:', err);
    return res.status(500).json({ error: 'Server error while deleting file' });
  }
};

module.exports = {
  messageFileUpload,
  uploadMessageFile,
  deleteFile
}; 