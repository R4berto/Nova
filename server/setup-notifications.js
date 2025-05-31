const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_DATABASE || 'nova',
});

async function setupNotifications() {
  try {
    console.log('Setting up notification tables...');
    
    // Read the SQL file content
    const sqlPath = path.join(__dirname, 'db', 'notifications.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Connect to database
    const client = await pool.connect();
    try {
      // Execute the SQL script
      await client.query(sqlContent);
      console.log('Notification tables created successfully!');
      
      // Verify tables exist
      const tableCheck = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('notifications', 'notification_preferences', 'notification_delivery_log')
      `);
      
      console.log(`Created ${tableCheck.rows.length} notification tables:`);
      tableCheck.rows.forEach(row => {
        console.log(` - ${row.table_name}`);
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error setting up notification tables:', error);
  } finally {
    await pool.end();
  }
}

// Run the setup function
setupNotifications(); 