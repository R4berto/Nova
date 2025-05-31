/**
 * This script cleans up duplicate course group chats in the database.
 * Run this once to fix existing data. Future duplicates will be prevented
 * by the updated createConversation function.
 */

const pool = require('../db');

async function cleanupDuplicateCourseChats() {
  const client = await pool.connect();
  
  try {
    console.log('Starting cleanup of duplicate course chats...');
    
    // First check if the procedure exists
    const checkProcedure = await client.query(`
      SELECT COUNT(*)
      FROM pg_proc
      WHERE proname = 'cleanup_duplicate_course_chats'
    `);
    
    if (parseInt(checkProcedure.rows[0].count) === 0) {
      console.log('Cleanup procedure not found. Creating it...');
      
      // Create the procedure
      await client.query(`
        CREATE OR REPLACE PROCEDURE cleanup_duplicate_course_chats()
        LANGUAGE plpgsql
        AS $$
        DECLARE
          course_id_var INTEGER;
          first_chat_id INTEGER;
          dup_chat_id INTEGER;
        BEGIN
          -- For each course_id that has more than one group chat
          FOR course_id_var IN 
            SELECT DISTINCT c.course_id 
            FROM conversation c
            WHERE c.conversation_type = 'group' AND c.course_id IS NOT NULL
            GROUP BY c.course_id
            HAVING COUNT(*) > 1
          LOOP
            -- Find the oldest chat for this course (to keep)
            SELECT conversation_id INTO first_chat_id
            FROM conversation
            WHERE conversation_type = 'group' AND course_id = course_id_var
            ORDER BY created_at ASC
            LIMIT 1;
            
            -- Find and process each duplicate chat
            FOR dup_chat_id IN
              SELECT conversation_id
              FROM conversation
              WHERE conversation_type = 'group' 
                AND course_id = course_id_var
                AND conversation_id != first_chat_id
            LOOP
              -- Check if there are any participants in the duplicate that aren't in the original
              INSERT INTO conversation_participant (conversation_id, user_id, joined_at)
              SELECT first_chat_id, cp.user_id, cp.joined_at
              FROM conversation_participant cp
              WHERE cp.conversation_id = dup_chat_id
                AND cp.user_id NOT IN (
                  SELECT user_id 
                  FROM conversation_participant 
                  WHERE conversation_id = first_chat_id
                );
                
              -- Delete the duplicate chat (cascade will remove participants, messages, etc.)
              DELETE FROM conversation WHERE conversation_id = dup_chat_id;
            END LOOP;
          END LOOP;
        END;
        $$;
      `);
      
      console.log('Procedure created successfully.');
    }
    
    // Count duplicate course chats before cleanup
    const beforeCount = await client.query(`
      SELECT COUNT(*) AS total, COUNT(DISTINCT course_id) AS unique_courses
      FROM conversation
      WHERE conversation_type = 'group' AND course_id IS NOT NULL
    `);
    
    console.log(`Before cleanup: ${beforeCount.rows[0].total} total course chats for ${beforeCount.rows[0].unique_courses} unique courses.`);
    
    // Call the cleanup procedure
    await client.query('CALL cleanup_duplicate_course_chats()');
    
    // Count after cleanup
    const afterCount = await client.query(`
      SELECT COUNT(*) AS total, COUNT(DISTINCT course_id) AS unique_courses
      FROM conversation
      WHERE conversation_type = 'group' AND course_id IS NOT NULL
    `);
    
    console.log(`After cleanup: ${afterCount.rows[0].total} total course chats for ${afterCount.rows[0].unique_courses} unique courses.`);
    console.log(`Removed ${beforeCount.rows[0].total - afterCount.rows[0].total} duplicate course chats.`);
    
    console.log('Cleanup completed successfully!');
  } catch (err) {
    console.error('Error cleaning up duplicate course chats:', err);
  } finally {
    client.release();
  }
  
  // Close the pool and exit
  await pool.end();
  process.exit(0);
}

cleanupDuplicateCourseChats(); 