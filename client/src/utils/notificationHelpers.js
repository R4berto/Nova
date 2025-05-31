import toast from 'react-hot-toast';

// Helper function to format notification message
const formatNotificationMessage = (type, data) => {
  switch (type) {
    case 'assignment':
      return `New assignment: ${data.title}`;
    case 'quiz':
      return `New quiz available: ${data.title}`;
    case 'grade':
      return `Grade posted for ${data.assignmentTitle}: ${data.grade}`;
    case 'message':
      return `New message from ${data.senderName}`;
    case 'due_date':
      return `Reminder: ${data.title} is due ${data.dueDate}`;
    case 'new_content':
      return `New ${data.contentType} added to ${data.courseName}`;
    default:
      return 'New notification';
  }
};

// Helper function to trigger a notification
export const triggerNotification = async (type, data) => {
  try {
    const response = await fetch('http://localhost:5000/notifications/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        jwt_token: localStorage.getItem('token')
      },
      body: JSON.stringify({
        type,
        message: formatNotificationMessage(type, data),
        metadata: data
      })
    });

    if (!response.ok) {
      throw new Error('Failed to trigger notification');
    }

    return await response.json();
  } catch (error) {
    console.error('Error triggering notification:', error);
    toast.error('Failed to send notification');
    return null;
  }
};

// Helper functions for specific notification types
export const notifyNewAssignment = (courseId, assignmentData) => {
  return triggerNotification('assignment', {
    courseId,
    title: assignmentData.title,
    dueDate: assignmentData.dueDate
  });
};

export const notifyNewQuiz = (courseId, quizData) => {
  return triggerNotification('quiz', {
    courseId,
    title: quizData.title,
    dueDate: quizData.dueDate
  });
};

export const notifyGradePosted = (assignmentId, gradeData) => {
  return triggerNotification('grade', {
    assignmentId,
    assignmentTitle: gradeData.title,
    grade: gradeData.grade
  });
};

export const notifyNewMessage = (senderId, messageData) => {
  return triggerNotification('message', {
    senderId,
    senderName: messageData.senderName,
    message: messageData.message
  });
};

export const notifyDueDateReminder = (assignmentId, reminderData) => {
  return triggerNotification('due_date', {
    assignmentId,
    title: reminderData.title,
    dueDate: reminderData.dueDate
  });
};

export const notifyNewContent = (courseId, contentData) => {
  return triggerNotification('new_content', {
    courseId,
    courseName: contentData.courseName,
    contentType: contentData.contentType,
    contentTitle: contentData.title
  });
}; 