const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const pool = require("../db");
const jwtGenerator = require("../utils/jwtGenerator");
const validInfo = require("../middleware/validInfo");
const authorize = require("../middleware/authorize");


//REGISTER ROUTE
router.post("/register", validInfo, async (req, res) => {
  const { email, first_name, last_name, role, password } = req.body;

  try {
    // Check if user exists
    const user = await pool.query("SELECT user_id FROM users WHERE email = $1", [email]);
    if (user.rows.length > 0) {
      return res.status(400).json({ error: "User already exists!" });
    }

    // Hash password
    const bcryptPassword = await bcrypt.hash(password, 10);

    // Create new user & get user ID
    const newUser = await pool.query(
      `INSERT INTO users (first_name, last_name, role, email) 
       VALUES ($1, $2, $3, $4) RETURNING user_id, role`,
      [first_name, last_name, role, email]
    );

    const userId = newUser.rows[0].user_id;
    const userRole = newUser.rows[0].role;

    // Store hashed password
    await pool.query(
      `INSERT INTO auth_credentials (user_id, password_hash) 
       VALUES ($1, $2)`,
      [userId, bcryptPassword]
    );

    // Generate JWT token with role
    const jwtToken = jwtGenerator(userId, userRole);
    return res.json({ jwtToken, role: userRole });
  } catch (err) {
    console.error("Register Error:", err.message);
    res.status(500).json({ error: "Server error during registration" });
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

module.exports = router;
