const router = require("express").Router();
const authorize = require("../middleware/authorize");
const pool = require("../db");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

// File filter to only allow image files
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.get("/", authorize, async (req, res) => {
  try {
    // Get user information and profile data
    const userQuery = await pool.query(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, u.role, 
              p.profile_picture_url, p.last_login
       FROM users u
       LEFT JOIN user_profile p ON u.user_id = p.user_id
       WHERE u.user_id = $1`,
      [req.user.id] 
    ); 
    
    // If no profile exists, create one
    if (userQuery.rows.length > 0 && userQuery.rows[0].profile_picture_url === null) {
      try {
        // Check if profile exists
        const profileCheck = await pool.query(
          "SELECT profile_id FROM user_profile WHERE user_id = $1",
          [req.user.id]
        );
        
        // If no profile exists, create one
        if (profileCheck.rows.length === 0) {
          await pool.query(
            "INSERT INTO user_profile (user_id, last_login) VALUES ($1, NOW())",
            [req.user.id]
          );
        } else {
          // Update last login time
          await pool.query(
            "UPDATE user_profile SET last_login = NOW() WHERE user_id = $1",
            [req.user.id]
          );
        }
      } catch (profileErr) {
        console.error("Error creating/updating profile:", profileErr.message);
        // Continue execution even if profile creation fails
      }
    }
    
    res.json(userQuery.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

router.put("/update-profile", authorize, async (req, res) => {
  try {
    const { first_name, last_name, email } = req.body;
    const user_id = req.user.id;

    // Input validation
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if email already exists (for a different user)
    const emailCheck = await pool.query(
      "SELECT user_id FROM users WHERE email = $1 AND user_id != $2",
      [email, user_id]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: "Email already in use by another account" });
    }

    // Update user profile in a transaction
    await pool.query('BEGIN');
    
    try {
      // Update basic user information
      const updatedUser = await pool.query(
        "UPDATE users SET first_name = $1, last_name = $2, email = $3 WHERE user_id = $4 RETURNING *",
        [first_name, last_name, email, user_id]
      );
      
      // Ensure user_profile record exists
      const profileCheck = await pool.query(
        "SELECT profile_id FROM user_profile WHERE user_id = $1",
        [user_id]
      );
      
      if (profileCheck.rows.length === 0) {
        await pool.query(
          "INSERT INTO user_profile (user_id, last_login) VALUES ($1, NOW())",
          [user_id]
        );
      }
      
      await pool.query('COMMIT');
      
      // Return updated user data
      res.json({
        success: true,
        user: {
          first_name: updatedUser.rows[0].first_name,
          last_name: updatedUser.rows[0].last_name,
          email: updatedUser.rows[0].email,
          role: updatedUser.rows[0].role
        }
      });
    } catch (txError) {
      await pool.query('ROLLBACK');
      throw txError;
    }
  } catch (err) {
    console.error("Error updating profile:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Upload profile picture endpoint - updated to handle file uploads
router.post("/upload-profile-picture", authorize, async (req, res) => {
  try {
    console.log('Received profile picture upload request');
    
    // Create multer instance with error handling
    const uploadMiddleware = upload.single('profile_picture');
    
    uploadMiddleware(req, res, async function(err) {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message });
      }
      
      try {
        if (!req.file) {
          console.error('No file found in request');
          return res.status(400).json({ error: "No file uploaded" });
        }
        
        console.log('File details:', req.file);
        
        const user_id = req.user.id;
        console.log(`Updating profile picture for user ${user_id}`);
        
        // Create the URL for the uploaded file
        const serverUrl = 'http://localhost:5000';
        const relativePath = `/uploads/${path.basename(req.file.path)}`;
        const pictureUrl = `${serverUrl}${relativePath}`;
        
        console.log(`File saved at: ${req.file.path}`);
        console.log(`Generated URL: ${pictureUrl}`);
        
        // Check if profile exists
        const profileCheck = await pool.query(
          "SELECT profile_id FROM user_profile WHERE user_id = $1",
          [user_id]
        );
        
        let result;
        if (profileCheck.rows.length === 0) {
          // Create a new profile with the picture URL
          console.log('Creating new profile with picture URL');
          result = await pool.query(
            "INSERT INTO user_profile (user_id, profile_picture_url, last_login) VALUES ($1, $2, NOW()) RETURNING profile_picture_url",
            [user_id, pictureUrl]
          );
        } else {
          // Update existing profile
          console.log('Updating existing profile with picture URL');
          result = await pool.query(
            "UPDATE user_profile SET profile_picture_url = $1 WHERE user_id = $2 RETURNING profile_picture_url",
            [pictureUrl, user_id]
          );
        }
        
        const updatedPictureUrl = result.rows[0].profile_picture_url;
        console.log('Profile picture updated successfully:', updatedPictureUrl);
        
        res.json({ 
          success: true, 
          profile_picture_url: updatedPictureUrl,
          message: "Profile picture updated successfully" 
        });
      } catch (innerErr) {
        console.error("Error in profile picture processing:", innerErr);
        res.status(500).json({ error: innerErr.message || "Server error" });
      }
    });
  } catch (err) {
    console.error("Error uploading profile picture:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/change-password", authorize, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user_id = req.user.id;

    // Input validation
    if (!current_password || !new_password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,16}$/;
    if (!passwordRegex.test(new_password)) {
      return res.status(400).json({ error: "Password must be 8-16 characters and include uppercase, lowercase, number, and special character" });
    }

    // Get current password hash
    const currentPasswordQuery = await pool.query(
      "SELECT password_hash FROM auth_credentials WHERE user_id = $1",
      [user_id]
    );

    if (currentPasswordQuery.rows.length === 0) {
      return res.status(400).json({ error: "User credentials not found" });
    }

    const storedPasswordHash = currentPasswordQuery.rows[0].password_hash;

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(current_password, storedPasswordHash);

    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

    // Update password
    await pool.query(
      "UPDATE auth_credentials SET password_hash = $1 WHERE user_id = $2",
      [newPasswordHash, user_id]
    );

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("Error changing password:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
