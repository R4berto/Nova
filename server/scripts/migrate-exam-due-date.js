const pool = require("../db");
const fs = require("fs");
const path = require("path");

async function migrateExamDueDate() {
  try {
    console.log("Starting exam due date migration...");
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, "../database/add_exam_due_date.sql");
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log("✅ Exam due date migration completed successfully!");
    console.log("   - Added due_date column to exam table");
    console.log("   - Created index for due_date queries");
    console.log("   - Added column documentation");
    
    // Check if the column was added successfully
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'exam' AND column_name = 'due_date'
    `);
    
    if (result.rows.length > 0) {
      console.log("✅ Verification: due_date column exists");
      console.log(`   - Data type: ${result.rows[0].data_type}`);
      console.log(`   - Nullable: ${result.rows[0].is_nullable}`);
    } else {
      console.log("❌ Warning: due_date column not found after migration");
    }
    
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the migration if this script is called directly
if (require.main === module) {
  migrateExamDueDate();
}

module.exports = migrateExamDueDate; 