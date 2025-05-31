const notificationService = require('./services/notificationService');
const pool = require('./db');
require('dotenv').config();

// Function to get a user ID for testing
async function getTestUserId() {
  try {
    const result = await pool.query(
      'SELECT user_id FROM users LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      throw new Error('No users found in the database');
    }
    
    return result.rows[0].user_id;
  } catch (error) {
    console.error('Error getting test user:', error);
    throw error;
  }
}

// Function to test notification creation
async function testCreateNotification() {
  try {
    // Get a real user ID from the database
    const userId = await getTestUserId();
    console.log(`Using test user ID: ${userId}`);
    
    // Create a test notification
    const notification = await notificationService.createNotification(
      userId,
      'message',
      'This is a test notification from the test script',
      {
        test: true,
        timestamp: new Date().toISOString()
      }
    );
    
    console.log('Test notification created successfully:', notification);
    
    // Get user's notifications to verify
    const userNotifications = await notificationService.getUserNotifications(userId, 5, 0);
    console.log(`User has ${userNotifications.unread_count} unread notifications`);
    console.log('Latest notifications:', userNotifications.notifications.slice(0, 3));
    
    return notification;
  } catch (error) {
    console.error('Error creating test notification:', error);
    throw error;
  }
}

// Main function
async function runTest() {
  try {
    console.log('Running notification system test...');
    
    // Test creating a notification
    const notification = await testCreateNotification();
    
    console.log('Notification system test completed successfully!');
  } catch (error) {
    console.error('Notification system test failed:', error);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the test
runTest(); 