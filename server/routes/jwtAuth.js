const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const pool = require("../db");
const jwtGenerator = require("../utils/jwtGenerator");
const validInfo = require("../middleware/validInfo");
const authorize = require("../middleware/authorize");
const crypto = require("crypto");
const { sendPasswordResetEmail, sendEmailVerification } = require("../services/emailService");


//REGISTER ROUTE - Step 1: Send verification code
router.post("/register", validInfo, async (req, res) => {
  const { email, first_name, last_name, role, password } = req.body;

  try {
    // Check if user exists
    const user = await pool.query("SELECT user_id FROM users WHERE email = $1", [email]);
    if (user.rows.length > 0) {
      return res.status(400).json({ error: "User already exists!" });
    }

    // Generate a 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Calculate expiration time (5 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);
    
    // Begin transaction to ensure atomic operations
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // First invalidate any existing verification tokens for this email
      await client.query(
        `UPDATE email_verification_tokens 
         SET used = TRUE 
         WHERE email = $1 AND used = FALSE`,
        [email]
      );
      
      // Then create a new verification token
      await client.query(
        `INSERT INTO email_verification_tokens 
         (email, token, expires_at) 
         VALUES ($1, $2, $3)`,
        [email, verificationCode, expiresAt]
      );
      
      await client.query('COMMIT');
      
      // Send verification email
      await sendEmailVerification(email, verificationCode, first_name);
      
      return res.json({ 
        message: "Verification code sent to your email",
        email: email,
        first_name: first_name,
        last_name: last_name,
        role: role,
        password: password // We'll need this for the next step
      });
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Register Error:", err.message);
    res.status(500).json({ error: "Server error during registration" });
  }
});

//REGISTER ROUTE - Step 2: Verify code and create account
router.post("/verify-email", async (req, res) => {
  const { email, verificationCode, first_name, last_name, role, password } = req.body;

  if (!email || !verificationCode || !first_name || !last_name || !role || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Check if verification code exists and is valid
    const tokenCheck = await pool.query(
      `SELECT token_id, expires_at, used 
       FROM email_verification_tokens 
       WHERE email = $1 AND token = $2`,
      [email, verificationCode]
    );
    
    if (tokenCheck.rows.length === 0) {
      return res.status(400).json({ error: "Invalid verification code" });
    }
    
    const tokenInfo = tokenCheck.rows[0];
    
    // Check if token is expired or already used
    if (new Date(tokenInfo.expires_at) < new Date() || tokenInfo.used) {
      return res.status(400).json({ error: "Verification code is expired or has been used" });
    }
    
    // Begin transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Mark token as used
      await client.query(
        `UPDATE email_verification_tokens 
         SET used = true 
         WHERE token_id = $1`,
        [tokenInfo.token_id]
      );
      
      // Hash password
      const bcryptPassword = await bcrypt.hash(password, 10);

      // Create new user & get user ID
      const newUser = await client.query(
        `INSERT INTO users (first_name, last_name, role, email) 
         VALUES ($1, $2, $3, $4) RETURNING user_id, role`,
        [first_name, last_name, role, email]
      );

      const userId = newUser.rows[0].user_id;
      const userRole = newUser.rows[0].role;

      // Store hashed password
      await client.query(
        `INSERT INTO auth_credentials (user_id, password_hash) 
         VALUES ($1, $2)`,
        [userId, bcryptPassword]
      );
      
      await client.query('COMMIT');
      
      // Generate JWT token with role
      const jwtToken = jwtGenerator(userId, userRole);
      return res.json({ jwtToken, role: userRole });
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Email Verification Error:", err.message);
    res.status(500).json({ error: "Server error during email verification" });
  }
});

//RESEND VERIFICATION CODE ROUTE
router.post("/resend-verification", async (req, res) => {
  const { email, first_name } = req.body;
  
  if (!email || !first_name) {
    return res.status(400).json({ error: "Email and first name are required" });
  }

  try {
    // Check if user already exists
    const user = await pool.query("SELECT user_id FROM users WHERE email = $1", [email]);
    if (user.rows.length > 0) {
      return res.status(400).json({ error: "User already exists!" });
    }

    // Generate a new 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Calculate expiration time (5 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);
    
    // Begin transaction to ensure atomic operations
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // First invalidate any existing verification tokens for this email
      await client.query(
        `UPDATE email_verification_tokens 
         SET used = TRUE 
         WHERE email = $1 AND used = FALSE`,
        [email]
      );
      
      // Then create a new verification token
      await client.query(
        `INSERT INTO email_verification_tokens 
         (email, token, expires_at) 
         VALUES ($1, $2, $3)`,
        [email, verificationCode, expiresAt]
      );
      
      await client.query('COMMIT');
      
      // Send verification email
      await sendEmailVerification(email, verificationCode, first_name);
      
      return res.json({ 
        message: "New verification code sent to your email"
      });
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Resend verification error:", err.message);
    res.status(500).json({ error: "Server error during resend verification" });
  }
});

// 🔹 LOGIN ROUTE
router.post("/login", validInfo, async (req, res) => {
  const { email, password } = req.body;
  console.log("Login attempt for email:", email);

  try {
    // Check if user exists and get role
    const user = await pool.query(
      `SELECT u.user_id, u.role, a.password_hash 
       FROM users u 
       JOIN auth_credentials a 
       ON u.user_id = a.user_id 
       WHERE u.email = $1`, 
      [email]
    );

    console.log("Database query result:", user.rows.length > 0 ? "User found" : "User not found");

    if (user.rows.length === 0) {
      console.log("Login failed: User not found");
      return res.status(401).json({ error: "Invalid credentials (user not found)" });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    console.log("Password validation:", validPassword ? "Valid" : "Invalid");

    if (!validPassword) {
      console.log("Login failed: Invalid password");
      return res.status(401).json({ error: "Invalid credentials (wrong password)" });
    }

    // Generate JWT token with role
    const jwtToken = jwtGenerator(user.rows[0].user_id, user.rows[0].role);
    console.log("Login successful for user:", user.rows[0].user_id);
    return res.json({ jwtToken, role: user.rows[0].role });
  } catch (err) {
    console.error("Login Error:", err.message);
    console.error("Error stack:", err.stack);
    res.status(500).json({ error: "Server error during login" });
  }
});

// Verify token
router.get("/is-verify", authorize, (req, res) => {
  try {
    res.json(true);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// get user-role
router.get("/user-role", authorize, (req, res) => {
  try {
    res.json({ role: req.user.role });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// 🔹 FORGOT PASSWORD ROUTE
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // Check if user exists
    const user = await pool.query(
      "SELECT user_id FROM users WHERE email = $1", 
      [email]
    );

    // Even if user not found, return success (security best practice)
    if (user.rows.length === 0) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return res.json({ 
        message: "If your email is registered, you will receive password reset instructions shortly" 
      });
    }

    const userId = user.rows[0].user_id;
    
    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Calculate expiration time (1 hour from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    // Begin transaction to ensure atomic operations
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // First invalidate any existing tokens for this user
      await client.query(
        `UPDATE password_reset_tokens 
         SET used = TRUE 
         WHERE user_id = $1 AND used = FALSE`,
        [userId]
      );
      
      // Then create a new token
      await client.query(
        `INSERT INTO password_reset_tokens 
         (user_id, token, expires_at) 
         VALUES ($1, $2, $3)`,
        [userId, resetToken, expiresAt]
      );
      
      await client.query('COMMIT');
      
      // Send password reset email
      const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password`;
      await sendPasswordResetEmail(email, resetToken, resetUrl);
      
      return res.json({ 
        message: "If your email is registered, you will receive password reset instructions shortly" 
      });
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).json({ error: "Server error during password reset request" });
  }
});

// 🔹 VERIFY RESET TOKEN ROUTE
router.get("/verify-reset-token/:token", async (req, res) => {
  const { token } = req.params;
  
  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }
  
  try {
    // Check if token exists and is valid
    const tokenCheck = await pool.query(
      `SELECT user_id, expires_at, used 
       FROM password_reset_tokens 
       WHERE token = $1`,
      [token]
    );
    
    if (tokenCheck.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }
    
    const tokenInfo = tokenCheck.rows[0];
    
    // Check if token is expired
    if (new Date(tokenInfo.expires_at) < new Date() || tokenInfo.used) {
      return res.status(400).json({ error: "Token is expired or has been used" });
    }
    
    // Token is valid
    return res.json({ valid: true });
  } catch (err) {
    console.error("Verify reset token error:", err.message);
    res.status(500).json({ error: "Server error during token verification" });
  }
});

// 🔹 RESET PASSWORD ROUTE
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  
  if (!token || !password) {
    return res.status(400).json({ error: "Token and password are required" });
  }
  
  // Validate password strength
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long" });
  }
  
  try {
    // Begin transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if token exists and is valid
      const tokenCheck = await client.query(
        `SELECT user_id, expires_at, used 
         FROM password_reset_tokens 
         WHERE token = $1`,
        [token]
      );
      
      if (tokenCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "Invalid or expired token" });
      }
      
      const tokenInfo = tokenCheck.rows[0];
      
      // Check if token is expired or already used
      if (new Date(tokenInfo.expires_at) < new Date() || tokenInfo.used) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "Token is expired or has been used" });
      }
      
      // Mark token as used
      await client.query(
        `UPDATE password_reset_tokens 
         SET used = true 
         WHERE token = $1`,
        [token]
      );
      
      // Hash the new password
      const bcryptPassword = await bcrypt.hash(password, 10);
      
      // Update the user's password
      await client.query(
        `UPDATE auth_credentials 
         SET password_hash = $1 
         WHERE user_id = $2`,
        [bcryptPassword, tokenInfo.user_id]
      );
      
      // Commit transaction
      await client.query('COMMIT');
      
      return res.json({ message: "Password has been reset successfully" });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(500).json({ error: "Server error during password reset" });
  }
});

module.exports = router;
