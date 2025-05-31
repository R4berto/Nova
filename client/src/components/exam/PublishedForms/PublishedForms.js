import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FaClock, FaCalendarAlt, FaExclamationTriangle, FaEdit } from 'react-icons/fa';
import { BsTrash } from 'react-icons/bs';
import { useNavigate, useLocation } from 'react-router-dom';
import './PublishedForms.css';
import LoadingIndicator from '../../common/LoadingIndicator';

// Backend API base URL
const API_BASE_URL = 'http://localhost:5000';

// Due date utility functions
const isExamPastDue = (exam) => {
  if (!exam.due_date) {
    return false; // No due date means never expires
  }
  const now = new Date();
  const dueDate = new Date(exam.due_date);
  return now > dueDate;
};

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

const PublishedForms = ({ courseId, onSwitchTab, userRole = "professor", courseStatus = 'active' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Check if modifications are allowed based on course status
  const isModificationAllowed = courseStatus === 'active';
  const isViewOnly = courseStatus === 'archived';
  
  // Redirect if not a professor
  useEffect(() => {
    if (userRole !== "professor" && onSwitchTab) {
      toast.error("Access denied: Professor access only");
      onSwitchTab('interface');
    }
  }, [userRole, onSwitchTab]);

  // Fetch existing exams for this course
  useEffect(() => {
    if (courseId && userRole === "professor") {
      fetchExams();
    } else if (!courseId) {
      setApiError('No course ID provided. Please select a course first.');
    }
  }, [courseId, userRole]);

  const fetchExams = async () => {
    if (!courseId) {
      setApiError('No course ID provided. Please select a course first.');
      return;
    }
    
    try {
      setLoading(true);
      setApiError(null);
      
      const response = await fetch(`${API_BASE_URL}/exams/${courseId}`, {
        headers: { jwt_token: localStorage.token }
      });
      
      if (response.status === 404) {
        console.warn('Exams API endpoint not found. This feature may not be fully implemented on the server.');
        setExams([]);
        return;
      }
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch exams');
        } else {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format from server');
      }
      
      const data = await response.json();
      setExams(data);
    } catch (error) {
      console.error('Error fetching exams:', error);
      setApiError(`Failed to load exams: ${error.message}`);
      toast.error(`Failed to load exams: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewExam = () => {
    // Check if exam creation is allowed
    if (!isModificationAllowed) {
      toast.error(isViewOnly 
        ? "This course is archived. Exam creation is not available."
        : "This course is inactive. Exam creation is not available.");
      return;
    }
    
    // Tell the parent component to switch to the builder tab with no exam ID
    if (onSwitchTab) {
      onSwitchTab('builder', null);
    } else {
      toast.error("Navigation function not available");
    }
  };

  const handleEditExam = (examId) => {
    // Update URL with exam ID parameter
    const newPath = `${location.pathname}?examId=${examId}`;
    navigate(newPath, { replace: true });
    
    // Tell the parent component to switch to the builder tab with the selected exam ID
    if (onSwitchTab) {
      onSwitchTab('builder', examId);
    } else {
      toast.error("Navigation function not available");
    }
  };

  const handleExamClick = (examId) => {
    // Update URL with exam ID parameter
    const newPath = `${location.pathname}?examId=${examId}`;
    navigate(newPath, { replace: true });
    
    // Make the entire exam item clickable for viewing
    handleEditExam(examId);
  };

  const handleDeleteExam = async (examId, examTitle) => {
    // Check if exam deletion is allowed
    if (!isModificationAllowed) {
      toast.error(isViewOnly 
        ? "This course is archived. Exam deletion is not available."
        : "This course is inactive. Exam deletion is not available.");
      return;
    }
    
    // Confirm before deleting
    if (!window.confirm(`Are you sure you want to delete the exam "${examTitle}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      setDeleting(true);
      
      const response = await fetch(`${API_BASE_URL}/exams/${examId}`, {
        method: 'DELETE',
        headers: { jwt_token: localStorage.token }
      });
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete exam');
        } else {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }
      
      // Remove the deleted exam from state
      setExams(exams.filter(exam => exam.exam_id !== examId));
      toast.success(`Exam "${examTitle}" deleted successfully`);
    } catch (error) {
      console.error('Error deleting exam:', error);
      toast.error(`Failed to delete exam: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // If not a professor, don't render anything
  if (userRole !== "professor") {
    return null;
  }

  return (
    <div className="published-forms-container">
      <h2 className="exams-management-title">Exams Management</h2>
      
      {/* Course Status Warning */}
      {!isModificationAllowed && (
        <div className={`course-status-warning ${courseStatus}`}>
          <p>
            {isViewOnly 
              ? "⚠️ This course is archived. You can only view exam details."
              : "⚠️ This course is inactive. Exam modifications are not allowed."
            }
          </p>
        </div>
      )}
      
      {/* API Error Message */}
      {apiError && (
        <div className="api-error-message">
          <p>{apiError}</p>
          <p>The exams API endpoint may not be fully implemented on the server yet.</p>
        </div>
      )}
      
      {/* Exam Management Controls */}
      <div className="exam-controls">
        <button 
          className={`control-btn ${!isModificationAllowed ? 'disabled' : ''}`}
          onClick={handleCreateNewExam}
          disabled={deleting || !isModificationAllowed}
          title={!isModificationAllowed ? `Exam creation is disabled in ${courseStatus} courses` : ''}
        >
          {isModificationAllowed ? 'Create New Exam' : 'View Only Mode'}
        </button>
      </div>
      
      {/* Exams List */}
      <div className="exam-list-header">
        <h3 className="exam-list-title">Your Exams</h3>
        <span className="exam-list-count">{exams.length}</span>
      </div>
      
      {loading ? (
        <LoadingIndicator text="Loading Exams" />
      ) : exams.length > 0 ? (
        <div className="exams-list">
          {exams.map(exam => {
            const isPastDue = isExamPastDue(exam);
            const dueDateInfo = formatDueDate(exam.due_date);
            const timeRemaining = getTimeRemaining(exam.due_date);
            
            return (
              <div 
                key={exam.exam_id} 
                className={`exam-card ${exam.is_published ? 'published' : 'draft'} ${isPastDue ? 'past-due' : ''} ${!isModificationAllowed ? 'view-only' : ''}`}
                onClick={() => handleExamClick(exam.exam_id)}
              >
                <div className="exam-card-content">
                  <h3 className="exam-title">{exam.title}</h3>
                  
                  <p className="exam-description">
                    {exam.description ? 
                      (exam.description.length > 100 ? `${exam.description.substring(0, 100)}...` : exam.description) 
                      : 'No description provided'}
                  </p>
                  
                  <div className="exam-meta">
                    {exam.published_at && (
                      <div className="published-info">
                        <FaCalendarAlt />
                        <span>Published: {new Date(exam.published_at).toLocaleDateString()}, {new Date(exam.published_at).toLocaleTimeString()}</span>
                      </div>
                    )}
                    
                    {exam.due_date && (
                      <div className={`due-date-info ${isPastDue ? 'overdue' : ''}`}>
                        {isPastDue ? (
                          <FaExclamationTriangle />
                        ) : (
                          <FaClock />
                        )}
                        <span>{dueDateInfo?.text}</span>
                      </div>
                    )}
                    
                    {timeRemaining && !timeRemaining.isOverdue && (
                      <div className="time-remaining">
                        <FaClock />
                        <span>{timeRemaining.message}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="exam-status-badges">
                    <span className={`status-badge ${exam.is_published ? 'published-badge' : 'draft-badge'}`}>
                      {exam.is_published ? 'Published' : 'Draft'}
                    </span>
                    {isPastDue && exam.is_published && (
                      <span className="status-badge overdue-badge">
                        Overdue
                      </span>
                    )}
                    {!isModificationAllowed && (
                      <span className="status-badge view-only-badge">
                        View Only
                      </span>
                    )}
                  </div>
                  
                  <div className="exam-actions">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExamClick(exam.exam_id);
                      }}
                      className="action-btn"
                      disabled={deleting}
                    >
                      <FaEdit />
                      <span>{isModificationAllowed ? 'Edit' : 'View'}</span>
                    </button>
                    {isModificationAllowed && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteExam(exam.exam_id, exam.title);
                        }}
                        className="action-btn"
                        disabled={deleting}
                      >
                        <BsTrash />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p>{isModificationAllowed ? 'No exams found. Create your first exam!' : 'No exams found in this course.'}</p>
      )}
    </div>
  );
};

export default PublishedForms; 