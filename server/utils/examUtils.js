// Utility functions for exam operations

/**
 * Check if an exam is past its due date
 * @param {Object} exam - Exam object with due_date property
 * @returns {boolean} - True if exam is past due, false otherwise
 */
const isExamPastDue = (exam) => {
  if (!exam.due_date) {
    return false; // No due date means never expires
  }
  
  const now = new Date();
  const dueDate = new Date(exam.due_date);
  return now > dueDate;
};

/**
 * Check if a due date is valid (in the future)
 * @param {string|Date} dueDate - Due date to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const isValidDueDate = (dueDate) => {
  if (!dueDate) {
    return true; // No due date is valid
  }
  
  const date = new Date(dueDate);
  const now = new Date();
  
  // Check if it's a valid date and in the future
  return !isNaN(date.getTime()) && date > now;
};

/**
 * Format a due date for display
 * @param {string|Date} dueDate - Due date to format
 * @returns {Object} - Object with formatted text and overdue status
 */
const formatDueDate = (dueDate) => {
  if (!dueDate) {
    return null;
  }
  
  const date = new Date(dueDate);
  const now = new Date();
  const isOverdue = now > date;
  
  const formattedDate = date.toLocaleString();
  
  return {
    text: isOverdue ? `Overdue (was due ${formattedDate})` : `Due: ${formattedDate}`,
    isOverdue,
    dueDate: date
  };
};

/**
 * Get time remaining until due date
 * @param {string|Date} dueDate - Due date
 * @returns {Object} - Object with time remaining info
 */
const getTimeRemaining = (dueDate) => {
  if (!dueDate) {
    return null;
  }
  
  const now = new Date();
  const due = new Date(dueDate);
  const diff = due.getTime() - now.getTime();
  
  if (diff <= 0) {
    return { isOverdue: true, message: "Overdue" };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return { isOverdue: false, message: `${days} day${days !== 1 ? 's' : ''} remaining` };
  } else if (hours > 0) {
    return { isOverdue: false, message: `${hours} hour${hours !== 1 ? 's' : ''} remaining` };
  } else {
    return { isOverdue: false, message: `${minutes} minute${minutes !== 1 ? 's' : ''} remaining` };
  }
};

module.exports = {
  isExamPastDue,
  isValidDueDate,
  formatDueDate,
  getTimeRemaining
}; 