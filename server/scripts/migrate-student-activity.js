const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const pool = require('../db');

/**
 * Migrate the database to add the student_activity table for DSS
 */
async function migrateStudentActivity() {
  let client;
  
  try {
    console.log("Starting student_activity table migration...");
    
    // Get the SQL file content
    const migrationPath = path.join(__dirname, "../database/student_activity.sql");
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the SQL script
    client = await pool.connect();
    await client.query(migrationSql);
    
    console.log("✅ Student activity table migration completed successfully!");
    console.log("   - Added student_activity table");
    console.log("   - Created necessary indexes");
    
    // Verify the table was created
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'student_activity'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("✓ Verified student_activity table exists");
    } else {
      console.error("❌ ERROR: student_activity table was not created properly");
    }
    
    return true;
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    return false;
  } finally {
    if (client) client.release();
  }
}

// Execute the migration if run directly
if (require.main === module) {
  migrateStudentActivity()
    .then(() => {
      console.log("Migration script completed.");
      process.exit(0);
    })
    .catch(err => {
      console.error("Migration script failed:", err);
      process.exit(1);
    });
}

module.exports = migrateStudentActivity; 