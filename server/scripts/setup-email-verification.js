/**
 * Setup Email Verification Table
 * This script creates the email_verification_tokens table and related indexes
 */
const fs = require('fs');
const path = require('path');
const pool = require('../db');

const setupEmailVerification = async () => {
  try {
    console.log('Setting up email verification table...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../database/email_verification_tokens.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    await pool.query(sqlContent);
    
    console.log('✅ Email verification table setup completed successfully!');
    console.log('📧 Users will now need to verify their email during registration');
    
  } catch (error) {
    console.error('❌ Error setting up email verification table:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Run the setup
setupEmailVerification(); 