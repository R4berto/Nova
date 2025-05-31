import { toast } from 'react-hot-toast';

/**
 * Creates or joins a course chat for a given course
 * 
 * @param {string|number} courseId - The ID of the course
 * @param {object} userProfile - The user profile object with user_id, first_name, last_name
 * @param {string} [courseName] - Optional course name for better error messages
 * @returns {Promise<object>} - The created or joined chat object
 */
export const createCourseChat = async (courseId, userProfile, courseName = 'Course') => {
  if (!courseId || !userProfile || !userProfile.user_id) {
    console.error('Missing required parameters for creating course chat');
    return null;
  }

  try {
    const token = localStorage.getItem("token");
    if (!token) return null;

    // Convert courseId to a number to ensure proper comparison
    const courseIdNum = parseInt(courseId, 10);
    if (isNaN(courseIdNum)) {
      console.error(`Invalid course ID: ${courseId}`);
      return null;
    }

    console.log(`Looking for existing chat for course ${courseIdNum}`);

    // First, check if a course chat already exists for THIS SPECIFIC COURSE
    const response = await fetch(`http://localhost:5000/api/messages/conversations`, {
      method: "GET",
      headers: { jwt_token: token }
    });
    
    if (response.ok) {
      const conversations = await response.json();
      
      // Look for an existing course chat for this course
      const existingCourseChat = conversations.find(c => 
        c.conversation_type === 'group' && 
        String(c.course_id) === String(courseIdNum)
      );
      
      // If a course chat already exists, return it
      if (existingCourseChat) {
        console.log(`Found existing chat for course ${courseIdNum}:`, existingCourseChat.conversation_id);
        return existingCourseChat;
      }
    }
    
    // If no course chat exists for this course, create one
    console.log(`Creating new chat for course ${courseIdNum}`);

    // Fetch course participants
    const participantsResponse = await fetch(`http://localhost:5000/api/messages/conversations/courses/${courseIdNum}/participants`, {
      method: "GET",
      headers: { jwt_token: token }
    });
    
    if (!participantsResponse.ok) {
      console.error(`Failed to fetch course participants: ${participantsResponse.status}`);
      throw new Error('Could not fetch course participants');
    }
    
    const courseParticipants = await participantsResponse.json();
    console.log(`Found ${courseParticipants.length} participants for course ${courseIdNum}`);
    
    // Filter out the current user and extract participant IDs
    const participantIds = courseParticipants
      .filter(participant => participant.user_id !== userProfile.user_id)
      .map(participant => participant.user_id);
    
    console.log(`Filtered to ${participantIds.length} participants (excluding current user)`);
    
    // Ensure we have at least one participant (even if it's just for the schema)
    if (participantIds.length === 0) {
      // This is a special case where the user might be the only one in the course
      console.log("No other participants found, creating self-only chat");
      // Don't add any participant IDs - the server will handle the creator automatically
    }
    
    // Create the course chat
    const chatName = courseName ? `${courseName} Chat` : `Course ${courseIdNum} Chat`;
    
    const createResponse = await fetch(`http://localhost:5000/api/messages/conversations`, {
      method: "POST",
      headers: { 
        jwt_token: token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: chatName,
        participants: participantIds,
        conversationType: 'group',
        courseId: courseIdNum
      })
    });
    
    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      console.error("Failed to create course chat:", errorData);
      throw new Error(errorData.error || errorData.details || 'Failed to create course chat');
    }
    
    const newChat = await createResponse.json();
    console.log(`Successfully created chat for course ${courseIdNum}:`, newChat.conversation_id);
    return newChat;
    
  } catch (err) {
    console.error("Error creating/joining course chat:", err);
    // Background operation, so don't show toast to user
    return null;
  }
}; 