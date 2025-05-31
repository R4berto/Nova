const Pool = require("pg").Pool;
require("dotenv").config();

// Log connection parameters (excluding password for security)
console.log("Database connection parameters:", {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  // Don't log the password
});

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME
});

// Add error event handler to detect connection issues
pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
  console.error('This error may indicate connection problems or incorrect credentials');
});

// Test the connection and log result
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection test failed:', err);
  } else {
    console.log('Database connection successful:', res.rows[0]);
  }
});

module.exports = pool;
