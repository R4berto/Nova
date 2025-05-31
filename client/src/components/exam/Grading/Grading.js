import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import './Grading.css';
import LoadingIndicator from '../../common/LoadingIndicator';
import { toast } from 'react-hot-toast';

// Match the API base URL used in TestInterface.js
const API_BASE_URL = 'http://localhost:5000';

// Box Loader Component
const BoxLoader = () => (
  <div className="loader-container">
    <div className="box-loader-container">
      <div className="box-item"></div>
      <div className="box-item"></div>
      <div className="box-item"></div>
      <div className="box-item"></div>
      <div className="box-item"></div>
    </div>
    <div className="loader-text">Loading</div>
  </div>
);

const Grading = ({ courseStatus = 'active', initialExamId = null, initialSubmissionId = null }) => {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [gradeHistory, setGradeHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentView, setCurrentView] = useState('exams'); // 'exams', 'submissions', 'details'
  const [recheckReason, setRecheckReason] = useState('');
  const { courseId } = useParams();
  const navigate = useNavigate();

  // Check if grading operations are allowed based on course status
  const isGradingAllowed = courseStatus !== 'archived';
  const isViewOnly = courseStatus === 'archived';

  // Fetch exams and handle initial parameters
  useEffect(() => {
    const fetchExamsAndInitialize = async () => {
      try {
        setLoading(true);
        const token = localStorage.token;
        
        // Fetch exams
        const response = await axios.get(`${API_BASE_URL}/exams/${courseId}`, {
          headers: { jwt_token: token }
        });
        
        // Filter to only show published exams
        const publishedExams = response.data.filter(exam => exam.is_published);
        setExams(publishedExams);

        // If we have an initialExamId, find and select that exam
        if (initialExamId) {
          const exam = publishedExams.find(e => e.exam_id === parseInt(initialExamId));
          if (exam) {
            setSelectedExam(exam);
            setCurrentView('submissions');
            
            // Fetch submissions for the selected exam
            try {
              const submissionsResponse = await axios.get(
                `${API_BASE_URL}/exams/${exam.exam_id}/submissions`,
                { headers: { jwt_token: token } }
              );
              
              setSubmissions(submissionsResponse.data);
              
              // If we have an initialSubmissionId, find and select that submission
              if (initialSubmissionId) {
                const submission = submissionsResponse.data.find(
                  s => s.submission_id === parseInt(initialSubmissionId)
                );
                if (submission) {
                  // Fetch submission details
                  const submissionResponse = await axios.get(
                    `${API_BASE_URL}/exams/${exam.exam_id}/submissions/${submission.submission_id}`,
                    { headers: { jwt_token: token } }
                  );
                  
                  setAnswers(submissionResponse.data.answers.map(answer => ({
                    ...answer,
                    isEditing: false,
                    newPointsEarned: answer.points_earned
                  })));
                  
                  setSelectedSubmission(submission);
                  setCurrentView('details');
                  
                  // Fetch recheck reason if needed
                  if (submission.status === 'recheck_requested' || 
                      submission.status === 'rechecking' || 
                      submission.status === 'recheck_completed') {
                    try {
                      const recheckResponse = await axios.get(
                        `${API_BASE_URL}/exams/${exam.exam_id}/submissions/${submission.submission_id}/recheck-reason`,
                        { headers: { jwt_token: token } }
                      );
                      
                      if (recheckResponse.data && recheckResponse.data.reason) {
                        setRecheckReason(recheckResponse.data.reason);
                      }
                    } catch (err) {
                      console.error("Error fetching recheck reason:", err);
                    }
                  }
                }
              }
            } catch (err) {
              console.error("Error fetching submissions:", err);
              setError('Failed to load submissions');
            }
          }
        }
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load exams');
        setLoading(false);
        console.error(err);
      }
    };

    if (courseId) {
      fetchExamsAndInitialize();
    }
  }, [courseId, initialExamId, initialSubmissionId]);

  // Update URL when view changes
  useEffect(() => {
    if (selectedExam) {
      const searchParams = new URLSearchParams(window.location.search);
      searchParams.set('view', 'grading');
      searchParams.set('examId', selectedExam.exam_id);
      
      if (selectedSubmission) {
        searchParams.set('submissionId', selectedSubmission.submission_id);
      } else {
        searchParams.delete('submissionId');
      }
      
      navigate(`?${searchParams.toString()}`, { replace: true });
    }
  }, [selectedExam, selectedSubmission, navigate]);

  // Handler functions for user interactions
  const handleExamSelect = async (exam) => {
    try {
      setLoading(true);
      setSelectedExam(exam);
      setSelectedSubmission(null);
      setAnswers([]);
      setShowHistory(false);
      setCurrentView('submissions');

      const token = localStorage.token;
      const response = await axios.get(`${API_BASE_URL}/exams/${exam.exam_id}/submissions`, {
        headers: { jwt_token: token }
      });
      
      setSubmissions(response.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load submissions');
      setLoading(false);
      console.error(err);
    }
  };

  const handleSubmissionSelect = async (submission) => {
    try {
      setLoading(true);
      setSelectedSubmission(submission);
      setShowHistory(false);
      setCurrentView('details');

      const token = localStorage.token;
      const response = await axios.get(`${API_BASE_URL}/exams/${selectedExam.exam_id}/submissions/${submission.submission_id}`, {
        headers: { jwt_token: token }
      });
      
      setAnswers(response.data.answers.map(answer => ({
        ...answer,
        isEditing: false,
        newPointsEarned: answer.points_earned
      })));
      
      // Fetch recheck reason if needed
      if (submission.status === 'recheck_requested' || 
          submission.status === 'rechecking' || 
          submission.status === 'recheck_completed') {
        try {
          const recheckResponse = await axios.get(
            `${API_BASE_URL}/exams/${selectedExam.exam_id}/submissions/${submission.submission_id}/recheck-reason`,
            { headers: { jwt_token: token } }
          );
          
          if (recheckResponse.data && recheckResponse.data.reason) {
            setRecheckReason(recheckResponse.data.reason);
          } else {
            setRecheckReason('No reason provided');
          }
        } catch (err) {
          console.error("Error fetching recheck reason:", err);
          setRecheckReason('Unable to load recheck reason');
        }
      } else {
        setRecheckReason('');
      }
      
      setLoading(false);
    } catch (err) {
      setError('Failed to load submission details');
      setLoading(false);
      console.error(err);
    }
  };

  // Go back to exams list
  const handleBackToExams = () => {
    setCurrentView('exams');
    setSelectedExam(null);
  };

  // Go back to submissions list
  const handleBackToSubmissions = () => {
    setCurrentView('submissions');
    setSelectedSubmission(null);
  };

  // Toggle edit mode for an answer
  const toggleEditMode = (answerId) => {
    setAnswers(answers.map(answer => {
      if (answer.answer_id === answerId) {
        // If we're exiting edit mode, update the points_earned with the new value
        if (answer.isEditing) {
          return {
            ...answer,
            isEditing: false,
            points_earned: answer.newPointsEarned
          };
        } else {
          // Entering edit mode
          return {
            ...answer,
            isEditing: true
          };
        }
      }
      return answer;
    }));
  };

  // Handle points change
  const handlePointsChange = (answerId, value) => {
    // Convert to number and handle decimal values
    const numValue = value === '' ? 0 : parseFloat(value);
    
    setAnswers(answers.map(answer => 
      answer.answer_id === answerId 
        ? { 
            ...answer, 
            newPointsEarned: Math.min(Math.max(0, numValue), answer.points) 
          } 
        : answer
    ));
  };

  // Save updated grades
  const saveGradeChanges = async () => {
    try {
      setLoading(true);
      
      const updatedAnswers = answers.map(answer => ({
        answer_id: answer.answer_id,
        is_correct: answer.newPointsEarned >= answer.points,
        points_earned: answer.newPointsEarned
      }));
      
      // Use the same token format and API_BASE_URL
      const token = localStorage.token;
      await axios.put(
        `${API_BASE_URL}/exams/${selectedExam.exam_id}/submissions/${selectedSubmission.submission_id}/recheck`, 
        { answers: updatedAnswers },
        { headers: { jwt_token: token } }
      );
      
      // Refresh the submissions data
      const submissionsResponse = await axios.get(
        `${API_BASE_URL}/exams/${selectedExam.exam_id}/submissions`, 
        { headers: { jwt_token: token } }
      );
      
      setSubmissions(submissionsResponse.data);
      setLoading(false);
      
      // Navigate back to submissions list
      setSelectedSubmission(null);
      setCurrentView('submissions');
    } catch (err) {
      setError('Failed to update grades');
      setLoading(false);
      console.error(err);
    }
  };

  // Fetch grade change history
  const fetchGradeHistory = async () => {
    try {
      setLoading(true);
      
      // Use the same token format and API_BASE_URL
      const token = localStorage.token;
      const response = await axios.get(
        `${API_BASE_URL}/exams/${selectedExam.exam_id}/submissions/${selectedSubmission.submission_id}/history`, 
        { headers: { jwt_token: token } }
      );
      
      setGradeHistory(response.data);
      setShowHistory(true);
      setLoading(false);
    } catch (err) {
      setError('Failed to load grade history');
      setLoading(false);
      console.error(err);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Calculate percentage score
  const calculatePercentage = (score, totalPoints) => {
    if (!score || !totalPoints) return 0;
    return Math.round((score / totalPoints) * 100);
  };

  // Update submission status
  const updateSubmissionStatus = async (status) => {
    try {
      setLoading(true);
      
      // Use the same token format and API_BASE_URL
      const token = localStorage.token;
      await axios.put(
        `${API_BASE_URL}/exams/${selectedExam.exam_id}/submissions/${selectedSubmission.submission_id}/status`, 
        { status },
        { headers: { jwt_token: token } }
      );
      
      // Update the local state
      setSelectedSubmission({
        ...selectedSubmission,
        status: status
      });
      
      // Refresh the submissions list by fetching the latest data
      const submissionsResponse = await axios.get(
        `${API_BASE_URL}/exams/${selectedExam.exam_id}/submissions`, 
        { headers: { jwt_token: token } }
      );
      
      setSubmissions(submissionsResponse.data);
      
      setLoading(false);
    } catch (err) {
      setError('Failed to update status');
      setLoading(false);
      console.error(err);
    }
  };

  // Render view based on current state
  const renderView = () => {
    if (loading) {
      return <LoadingIndicator text="Loading Data" />;
    }

    if (currentView === 'exams') {
      return (
        <div className="exams-view">
          <div className="exams-list">
            <h3>Exams</h3>
            {exams.length === 0 ? (
              <p>No exams available</p>
            ) : (
              <ul>
                {exams.map(exam => (
                  <li 
                    key={exam.exam_id} 
                    className={selectedExam?.exam_id === exam.exam_id ? 'selected' : 'unselected'}
                    onClick={() => handleExamSelect(exam)}
                  >
                    <div className="exam-title">{exam.title}</div>
                    <div className="exam-info">
                      <span>Questions: {exam.question_count || 0}</span>
                      <span>Total Points: {exam.total_points || 0}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      );
    }

    if (currentView === 'submissions') {
      return (
        <div className="submissions-view">
          <div className="submissions-list">
            <div className="submissions-header">
              <button 
                className="back-button"
                onClick={handleBackToExams}
              >
                Back
              </button>
              <h3>Submissions for {selectedExam.title}</h3>
            </div>
            {submissions.length === 0 ? (
              <p>No submissions yet</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Score</th>
                    <th>Percentage</th>
                    <th>Submitted</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(sub => (
                    <tr 
                      key={sub.submission_id}
                      className={selectedSubmission?.submission_id === sub.submission_id ? 'selected' : ''}
                      onClick={() => handleSubmissionSelect(sub)}
                    >
                      <td>{sub.first_name} {sub.last_name}</td>
                      <td>{sub.score || 0}/{sub.total_points || 0}</td>
                      <td>{calculatePercentage(sub.score, sub.total_points)}%</td>
                      <td>{formatDate(sub.submitted_at)}</td>
                      <td>{sub.status || 'graded'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      );
    }

    if (currentView === 'details') {
      if (showHistory) {
        return (
          <div className="grade-history">
            <h3>
              <button 
                className="back-button"
                onClick={() => {
                  setShowHistory(false);
                }}
              >
                Back to Submission
              </button>
              Grade Change History
            </h3>
            
            {gradeHistory.length === 0 ? (
              <p>No grade changes recorded</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Changed By</th>
                    <th>Previous Score</th>
                    <th>New Score</th>
                    <th>Changed At</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeHistory.map(change => (
                    <tr key={change.log_id}>
                      <td>{change.first_name} {change.last_name}</td>
                      <td>{change.previous_score}</td>
                      <td>{change.new_score}</td>
                      <td>{formatDate(change.changed_at)}</td>
                      <td>{change.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      }

      return (
        <div className="submission-details">
          <h3>
            <button 
              className="back-button"
              onClick={handleBackToSubmissions}
            >
              Back
            </button>
            Exam Reviewer: {selectedSubmission.first_name} {selectedSubmission.last_name}
            <button 
              className="history-button"
              onClick={fetchGradeHistory}
            >
              View Grade History
            </button>
          </h3>
          
          <div className="submission-header">
            <p><strong>Email:</strong> {selectedSubmission.email}</p>
            <p><strong>Submitted:</strong> {formatDate(selectedSubmission.submitted_at)}</p>
            <p><strong>Score:</strong> {selectedSubmission.score} / {selectedSubmission.total_points} ({calculatePercentage(selectedSubmission.score, selectedSubmission.total_points)}%)</p>
            <p><strong>Status:</strong> {selectedSubmission.status || 'graded'}</p>
          </div>
          
          {/* Status Update Controls - Now separate from header */}
          {selectedSubmission.status === 'recheck_requested' && (
            <div className="status-controls">
              <div className="status-controls-header">
                <h4>Recheck Request</h4>
                <span className="status-badge recheck-requested">Pending Review</span>
              </div>
              <p className="status-note">This submission has a recheck request that requires your attention.</p>
              {recheckReason && (
                <div className="recheck-reason">
                  <h5>Student's Recheck Reason:</h5>
                  <div className="reason-text">{recheckReason}</div>
                </div>
              )}
              <div className="status-actions">
                <button 
                  className="status-button primary"
                  onClick={() => updateSubmissionStatus('rechecking')}
                  disabled={loading || isViewOnly}
                >
                  {isViewOnly ? 'Rechecking Unavailable (Archived Course)' : 'Start Rechecking'}
                </button>
              </div>
            </div>
          )}
          
          {selectedSubmission.status === 'rechecking' && (
            <div className="status-controls">
              <div className="status-controls-header">
                <h4>Rechecking in Progress</h4>
                <span className="status-badge rechecking">In Progress</span>
              </div>
              <p className="status-note">You are currently reviewing this exam submission.</p>
              {recheckReason && (
                <div className="recheck-reason">
                  <h5>Student's Recheck Reason:</h5>
                  <div className="reason-text">{recheckReason}</div>
                </div>
              )}
              <div className="status-actions">
                <button 
                  className="status-button success"
                  onClick={() => updateSubmissionStatus('recheck_completed')}
                  disabled={loading || isViewOnly}
                >
                  {isViewOnly ? 'Cannot Complete (Archived Course)' : 'Mark Recheck as Completed'}
                </button>
              </div>
            </div>
          )}
          
          {selectedSubmission.status === 'recheck_completed' && (
            <div className="status-controls">
              <div className="status-controls-header">
                <h4>Recheck Completed</h4>
                <span className="status-badge completed">Completed</span>
              </div>
              <p className="status-note">This exam has been successfully rechecked.</p>
              {recheckReason && (
                <div className="recheck-reason">
                  <h5>Original Recheck Reason:</h5>
                  <div className="reason-text">{recheckReason}</div>
                </div>
              )}
            </div>
          )}
          
          <div className="answers-list">
            <h4>Answers</h4>
            <div className="grading-note">
              <p>Note: For multiple-choice questions with multiple correct answers, students must select all correct options and no incorrect options to receive full credit.</p>
            </div>
            {answers.map((answer, index) => (
              <div 
                key={answer.answer_id || index} 
                className={`answer-item ${answer.is_correct ? 'correct' : 'incorrect'}`}
              >
                <div className="question-text">
                  <strong>Q{index + 1}:</strong> {answer.question_text}
                </div>
                
                <div className="answer-content">
                  <div className="answer-column">
                    <div>
                      <strong>Correct Answer:</strong> {answer.correct_answer}
                    </div>
                  </div>
                  
                  <div className="answer-column">
                    <div>
                      <strong>Student's Answer:</strong> {
                        answer.type === 'mcq' && Array.isArray(answer.options) 
                          ? answer.options[parseInt(answer.student_answer)] 
                          : answer.student_answer
                      }
                    </div>
                  </div>
                </div>
                
                <div className="answer-details">
                  <div className="points">
                    <div>
                      <strong>Points:</strong> 
                      {answer.isEditing ? (
                        <input 
                          type="number" 
                          min="0" 
                          max={answer.points} 
                          value={answer.newPointsEarned} 
                          onChange={(e) => handlePointsChange(answer.answer_id, e.target.value)}
                        />
                      ) : (
                        <span>{answer.points_earned || 0} / {answer.points}</span>
                      )}
                    </div>
                    <button 
                      className="edit-button"
                      onClick={() => toggleEditMode(answer.answer_id)}
                      disabled={isViewOnly}
                    >
                      {isViewOnly ? 'View Only' : answer.isEditing ? 'Done' : 'Edit'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="actions">
            <button 
              className="save-button"
              onClick={saveGradeChanges}
              disabled={loading || isViewOnly}
            >
              {isViewOnly ? 'Changes Unavailable (Archived Course)' : 'Save Changes'}
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="grading-container">
      <h2>Grading Dashboard</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="view-container">
        {renderView()}
      </div>
    </div>
  );
};

export default Grading; 