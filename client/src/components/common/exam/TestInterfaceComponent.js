import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { FaCheck, FaClock, FaCalendarAlt, FaPercentage } from 'react-icons/fa';
import './CombinedExam.css';
import LoadingIndicator from '../common/LoadingIndicator';

// Backend API base URL
const API_BASE_URL = 'http://localhost:5000';

const TestInterfaceComponent = ({ 
  courseId, 
  showCompletedOnly = false, 
  courseStatus = 'active',
  initialExamId = null
}) => {
  const navigate = useNavigate();
  const { examId: urlExamId } = useParams();
  const location = useLocation();
  
  // Add ref for scrolling to results
  const resultsRef = useRef(null);
  
  // Add state to track which tab we're on
  const [currentTab, setCurrentTab] = useState(showCompletedOnly ? 'completed' : 'interface');
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isExamLoading, setIsExamLoading] = useState(false); // Add new state for exam loading
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState({});
  const [examStarted, setExamStarted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examResults, setExamResults] = useState(null);
  const [submissionId, setSubmissionId] = useState(null);
  const [error, setError] = useState(null);
  const [showRecheckForm, setShowRecheckForm] = useState(false);
  const [recheckReason, setRecheckReason] = useState('');
  const [recheckSubmitting, setRecheckSubmitting] = useState(false);

  // Check if taking new exams is allowed based on course status
  const canTakeNewExams = courseStatus === 'active';
  const isViewOnly = courseStatus === 'archived';

  // Helper function to check if exam is past due date
  const isExamPastDue = (exam) => {
    if (!exam.due_date) return false;
    const now = new Date();
    const dueDate = new Date(exam.due_date);
    return now > dueDate;
  };

  // Helper function to format due date for display
  const formatDueDate = (dueDateString) => {
    if (!dueDateString) return null;
    const dueDate = new Date(dueDateString);
    const now = new Date();
    const isOverdue = now > dueDate;
    
    const formattedDate = dueDate.toLocaleString();
    
    if (isOverdue) {
      return { text: `Overdue (was due ${formattedDate})`, isOverdue: true };
    } else {
      return { text: `Due: ${formattedDate}`, isOverdue: false };
    }
  };

  // Effect to handle URL tab parameter
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    
    if (tabParam === 'interface' || tabParam === 'completed') {
      setCurrentTab(tabParam);
    }
  }, [location.search]);

  // Effect to fetch exams list
  useEffect(() => {
    if (courseId && !urlExamId) { // Only fetch if we're not viewing a specific exam
      if (currentTab === 'completed') {
        fetchCompletedExams();
      } else {
        fetchAvailableExams();
      }
    }
  }, [courseId, currentTab, urlExamId]);

  // Effect to handle URL exam ID
  useEffect(() => {
    const loadExam = async () => {
      if (urlExamId && !selectedExam && !isExamLoading) {
        setIsExamLoading(true);
        try {
          await fetchExamDetails(urlExamId);
        } finally {
          setIsExamLoading(false);
        }
      }
    };
    loadExam();
  }, [urlExamId]); // Remove selectedExam and loading from dependencies

  // Effect to scroll to results when they become available
  useEffect(() => {
    if (examSubmitted && examResults) {
      // Scroll to top with a slight delay to ensure rendering is complete
      setTimeout(() => {
        window.scrollTo(0, 0);
        
        // Alternative direct element scrolling if the ref is available
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({ behavior: 'auto' });
        }
      }, 200);
    }
  }, [examSubmitted, examResults]);

  // Fetch only completed exams
  const fetchCompletedExams = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all available exams and filter them based on completion status
      const response = await fetch(`${API_BASE_URL}/student-exams/available/${courseId}`, {
        headers: { jwt_token: localStorage.token }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch exams: ${response.status}`);
      }
      
      const data = await response.json();
      const completedExamsList = [];
      
      if (data && Array.isArray(data)) {
        // Check each exam for completion status
        for (const exam of data) {
          try {
            const resultsResponse = await fetch(`${API_BASE_URL}/student-exams/results/${exam.exam_id}`, {
              headers: { jwt_token: localStorage.token }
            });
            
            if (resultsResponse.ok) {
              const resultsData = await resultsResponse.json();
              const isCompleted = resultsData.submission && 
                               (resultsData.submission.status === "completed" || 
                                resultsData.submission.status === "graded" ||
                                resultsData.submission.status === "recheck_requested" ||
                                resultsData.submission.status === "rechecking" ||
                                resultsData.submission.status === "recheck_completed");
              
              if (isCompleted) {
                // This is a completed exam - add it to the list
                completedExamsList.push({ 
                  ...exam, 
                  completion_status: 'completed',
                  completion_date: new Date(resultsData.submission.submitted_at).toLocaleString(),
                  score: resultsData.submission.percentage,
                  points_earned: resultsData.submission.score,
                  total_points: resultsData.submission.total_points
                });
              }
            }
          } catch (error) {
            console.error(`Error checking submission status for exam ${exam.exam_id}:`, error);
          }
        }
      }
      
      setExams(completedExamsList);
    } catch (err) {
      console.error("Error fetching completed exams:", err);
      setError("Failed to load completed exams. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch only available (non-completed) exams
  const fetchAvailableExams = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all available exams
      const response = await fetch(`${API_BASE_URL}/student-exams/available/${courseId}`, {
        headers: { jwt_token: localStorage.token }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch exams: ${response.status}`);
      }
      
      const data = await response.json();
      const availableExamsList = [];
      
      if (data && Array.isArray(data)) {
        // Process each exam
        for (const exam of data) {
          let isCompleted = false;
          
          try {
            // Check if the exam is completed
            const resultsResponse = await fetch(`${API_BASE_URL}/student-exams/results/${exam.exam_id}`, {
              headers: { jwt_token: localStorage.token }
            });
            
            if (resultsResponse.ok) {
              const resultsData = await resultsResponse.json();
              isCompleted = resultsData.submission && 
                         (resultsData.submission.status === "completed" || 
                          resultsData.submission.status === "graded" ||
                          resultsData.submission.status === "recheck_requested" ||
                          resultsData.submission.status === "rechecking" ||
                          resultsData.submission.status === "recheck_completed");
            }
          } catch (error) {
            console.error(`Error checking submission status for exam ${exam.exam_id}:`, error);
          }
          
          // Only add non-completed exams to the available list
          if (!isCompleted) {
            // Check if exam is past due date
            const isPastDue = isExamPastDue(exam);
            
            availableExamsList.push({
              ...exam,
              completion_status: 'available',
              published_date: new Date(exam.published_at).toLocaleString(),
              is_past_due: isPastDue
            });
          }
        }
      }
      
      setExams(availableExamsList);
    } catch (err) {
      console.error("Error fetching available exams:", err);
      setError("Failed to load available exams. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const fetchExamDetails = async (examId) => {
    try {
      setLoading(true);
      
      // First check if the student has already taken or started this exam
      const resultsResponse = await fetch(`${API_BASE_URL}/student-exams/results/${examId}`, {
        headers: { jwt_token: localStorage.token }
      });
      
      // If the student has already taken this exam, show the results
      if (resultsResponse.ok) {
        const resultsData = await resultsResponse.json();
        
        if (resultsData.submission && 
            (resultsData.submission.status === "completed" || 
             resultsData.submission.status === "graded" ||
             resultsData.submission.status === "recheck_requested" ||
             resultsData.submission.status === "rechecking" ||
             resultsData.submission.status === "recheck_completed")) {
          // Ensure we're showing results for completed exams
          resultsData.exam.exam_id = examId;  // Add the exam_id to the exam object
          setExamResults(resultsData);
          setExamSubmitted(true);
          setLoading(false);
          return;
        }
        
        if (resultsData.submission && resultsData.submission.status === "in_progress") {
          // Exam was started but not submitted
          setSubmissionId(resultsData.submission.submission_id);
        }
      }
      
      // Get exam details
      const examResponse = await fetch(`${API_BASE_URL}/exams/single/${examId}`, {
        headers: { jwt_token: localStorage.token }
      });
      
      if (!examResponse.ok) {
        throw new Error(`Failed to fetch exam details: ${examResponse.status}`);
      }
      
      const examData = await examResponse.json();
      setSelectedExam(examData);
      
      // Initialize answers object with empty values for each question
      const initialAnswers = {};
      if (examData.questions && Array.isArray(examData.questions)) {
        examData.questions.forEach(question => {
          if (question.type === 'mcq' && Array.isArray(question.correct_answer)) {
            // Initialize with empty array for multiple answer questions
            initialAnswers[question.question_id] = [];
          } else {
            // Initialize with empty string for single answer questions
            initialAnswers[question.question_id] = '';
          }
        });
      }
      setAnswers(initialAnswers);
      
    } catch (err) {
      console.error("Error fetching exam details:", err);
      setError("Failed to load exam details. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleExamSelect = (examId) => {
    // Reset states before navigation
    setSelectedExam(null);
    setExamStarted(false);
    setExamSubmitted(false);
    setExamResults(null);
    setAnswers({});
    setSubmissionId(null);
    setIsExamLoading(false);
    
    // Navigate to the exam-specific URL while preserving the current tab
    navigate(`/courses/${courseId}/exams/${examId}?tab=${currentTab}`);
  };

  const handleStartExam = async () => {
    // Check course status first
    if (!canTakeNewExams) {
      return;
    }
    
    // Check if exam is past due
    if (selectedExam && isExamPastDue(selectedExam)) {
      return;
    }
    
    try {
      setSubmitting(true);
      
      // Start the exam
      const response = await fetch(`${API_BASE_URL}/student-exams/start/${selectedExam.exam_id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          jwt_token: localStorage.token 
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start exam');
      }
      
      const data = await response.json();
      setSubmissionId(data.submission.submission_id);
      setExamStarted(true);
    } catch (err) {
      console.error("Error starting exam:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswerChange = async (questionId, value) => {
    // Update local state
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
    
    // Save answer to server
    try {
      await saveAnswer(questionId, value);
    } catch (err) {
      console.error("Error saving answer:", err);
    }
  };

  // For single answer MCQ questions
  const handleOptionSelect = async (questionId, optionIndex) => {
    // If it's a single answer question
    if (!isMultipleAnswerQuestion(questionId)) {
      const value = optionIndex.toString();
      console.log(`Selected single option index: ${optionIndex}, value: ${value}`);
      
      // Update local state
      setAnswers(prev => ({
        ...prev,
        [questionId]: value
      }));
      
      // Save answer to server
      try {
        console.log(`Saving answer for question ${questionId}: ${value}`);
        await saveAnswer(questionId, value);
      } catch (err) {
        console.error("Error saving answer:", err);
      }
    }
  };

  // For multiple answer MCQ questions
  const handleMultipleOptionToggle = async (questionId, optionIndex) => {
    const optionValue = optionIndex.toString();
    console.log(`Toggling multiple option index: ${optionIndex}, value: ${optionValue}`);
    
    // Update local state
    setAnswers(prev => {
      const currentAnswers = Array.isArray(prev[questionId]) ? [...prev[questionId]] : [];
      console.log(`Current answers for question ${questionId}:`, currentAnswers);
      
      // Toggle the selection
      if (currentAnswers.includes(optionValue)) {
        // Remove if already selected
        const newAnswers = currentAnswers.filter(a => a !== optionValue);
        console.log(`Removed option, new answers:`, newAnswers);
        return {
          ...prev,
          [questionId]: newAnswers
        };
      } else {
        // Add if not selected
        const newAnswers = [...currentAnswers, optionValue];
        console.log(`Added option, new answers:`, newAnswers);
        return {
          ...prev,
          [questionId]: newAnswers
        };
      }
    });
    
    // We need to use the updated state after it's set, so we get the current answers
    const updatedAnswers = answers[questionId] || [];
    const isAlreadySelected = updatedAnswers.includes(optionValue);
    const newAnswers = isAlreadySelected
      ? updatedAnswers.filter(a => a !== optionValue)
      : [...updatedAnswers, optionValue];
    
    // Save answer to server
    try {
      console.log(`Saving multiple answers for question ${questionId}:`, newAnswers);
      await saveAnswer(questionId, newAnswers);
    } catch (err) {
      console.error("Error saving answer:", err);
    }
  };
  
  // Helper function to check if a question allows multiple answers
  const isMultipleAnswerQuestion = (questionId) => {
    if (!selectedExam || !selectedExam.questions) return false;
    
    const question = selectedExam.questions.find(q => q.question_id === questionId);
    if (!question) return false;
    
    return (question.type === 'mcq' || question.type === 'identification') && Array.isArray(question.correct_answer);
  };
  
  const saveAnswer = async (questionId, answer) => {
    if (!submissionId) return;
    
    await fetch(`${API_BASE_URL}/student-exams/answer/${submissionId}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        jwt_token: localStorage.token 
      },
      body: JSON.stringify({ questionId, answer })
    });
  };

  const handleSubmitExam = async () => {
    // Confirm submission
    if (!window.confirm("Are you sure you want to submit this exam? You won't be able to change your answers after submission.")) {
      return;
    }
    
    try {
      setSubmitting(true);
      
      // Submit the exam
      const response = await fetch(`${API_BASE_URL}/student-exams/submit/${submissionId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          jwt_token: localStorage.token 
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit exam');
      }
      
      // Store the original questions and exam ID before fetching results
      const originalQuestions = selectedExam.questions ? [...selectedExam.questions] : [];
      const examId = selectedExam.exam_id;
      
      // Try to fetch the results, but handle the case where the endpoint might be missing
      try {
        await fetchExamResults(examId, originalQuestions);
      } catch (err) {
        console.error("Error fetching exam results:", err);
        
        // Create a fallback results data structure based on the submitted answers
        applyFallbackGrading(originalQuestions, examId);
      }
      
      // Use a timeout to ensure scrolling happens after state updates and rendering
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 100);
      
    } catch (err) {
      console.error("Error submitting exam:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Function to apply fallback grading when the results endpoint fails
  const applyFallbackGrading = (originalQuestions, examId) => {
    console.log("Applying fallback grading logic...");
    
    if (!originalQuestions || !originalQuestions.length) {
      console.error("No questions available for fallback grading");
      return;
    }
    
    // Create a mock results structure
    const mockResults = {
      exam: {
        title: selectedExam.title || "Exam",
        exam_id: examId
      },
      submission: {
        submitted_at: new Date().toISOString(),
        status: "graded"
      },
      questions: []
    };
    
    let totalPoints = 0;
    let earnedPoints = 0;
    
    // Process each question
    originalQuestions.forEach(question => {
      const studentAnswer = answers[question.question_id];
      totalPoints += (question.points || 1);
      
      // Assume correct for multiple-choice with multiple answers if at least one is selected
      const isMultipleChoice = question.type === 'mcq';
      const isMultipleAnswer = isMultipleAnswerQuestion(question.question_id);
      
      let isCorrect = false;
      let pointsEarned = 0;
      
      if (isMultipleChoice && isMultipleAnswer && Array.isArray(studentAnswer) && studentAnswer.length > 0) {
        // For multiple answer MCQ, give credit if at least one answer is provided
        isCorrect = true;
        pointsEarned = question.points || 1;
      } else if (question.type === 'identification' && isMultipleAnswer && studentAnswer) {
        // For identification with multiple correct answers, check if student's answer matches any correct answer
        const correctAnswers = Array.isArray(question.correct_answer) ? question.correct_answer : [question.correct_answer];
        isCorrect = correctAnswers.some(answer => 
          answer.toLowerCase().trim() === studentAnswer.toLowerCase().trim()
        );
        if (isCorrect) {
          pointsEarned = question.points || 1;
        }
      }
      
      // Add to total earned points
      if (isCorrect) {
        earnedPoints += pointsEarned;
      }
      
      // Add to mock results
      mockResults.questions.push({
        question_id: question.question_id,
        question_text: question.question_text,
        type: question.type,
        options: question.options,
        // Add mock correct_answer - this is a placeholder since we don't know the real correct answer
        correct_answer: isMultipleAnswer ? question.options : question.options?.[0] || "",
        student_answer: studentAnswer,
        is_correct: isCorrect,
        points: question.points || 1,
        points_earned: pointsEarned
      });
    });
    
    // Calculate final score and percentage
    mockResults.submission.score = Number(earnedPoints);
    mockResults.submission.total_points = Number(totalPoints);
    mockResults.submission.percentage = totalPoints > 0 ? Math.round((Number(earnedPoints) / Number(totalPoints)) * 100) : 0;
    
    console.log("Applied fallback grading:", mockResults);
    
    // Update state with our mock results
    setExamResults(mockResults);
    setExamSubmitted(true);
  };

  const fetchExamResults = async (examId, originalQuestions = []) => {
    try {
      const response = await fetch(`${API_BASE_URL}/student-exams/results/${examId}`, {
        headers: { jwt_token: localStorage.token }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch exam results: ${response.status}`);
      }
      
      let data = await response.json();
      let appliedFix = false;
      
      // Add exam_id to the exam object since it's not included in the response
      data.exam.exam_id = examId;
      
      // Log the received data structure to help debugging
      console.log("Exam results data:", data);
      
      // Client-side fix for questions with multiple correct answers
      if (data.questions && Array.isArray(data.questions)) {
        data.questions = data.questions.map(question => {
          console.log("Processing question:", question);
          
          // If correct_answer is missing entirely, we need to determine it differently
          if (question.correct_answer === undefined) {
            // Try to find the correct answer from the original question data
            const originalQuestion = originalQuestions.find(q => q.question_id === question.question_id);
            if (originalQuestion && originalQuestion.correct_answer) {
              question.correct_answer = originalQuestion.correct_answer;
              console.log("Using correct_answer from original question:", question.correct_answer);
            } else {
              // For multiple choice questions with multiple answers, assuming selecting any is correct
              if (question.type === 'mcq' && Array.isArray(question.options) && question.options.length > 1) {
                const studentAnswers = Array.isArray(question.student_answer) 
                  ? question.student_answer 
                  : [question.student_answer];
                
                // If any student answer is provided, mark it as correct
                if (studentAnswers.length > 0) {
                  question.is_correct = true;
                  question.points_earned = question.points;
                  appliedFix = true;
                  console.log("Marked as correct because student selected an option for a multiple-choice question");
                }
              }
              return question;
            }
          }
          
          // Parse and process correct_answer if it's an array or needs to be converted to one
          let correctAnswers = question.correct_answer;
          
          // Handle case when correct_answer is a string like {"tet","23","3"}
          if (typeof question.correct_answer === 'string' && 
              question.correct_answer.startsWith('{') && 
              question.correct_answer.endsWith('}')) {
            try {
              // First, try a more robust approach to parse PostgreSQL array
              const arrayContent = question.correct_answer
                .substring(1, question.correct_answer.length - 1);
              
              // Handle empty arrays
              if (!arrayContent.trim()) {
                correctAnswers = [];
              } else {
                // Split the array content by commas, handling escaped quotes
                const parsed = [];
                let currentItem = '';
                let inQuotes = false;
                
                for (let i = 0; i < arrayContent.length; i++) {
                  const char = arrayContent[i];
                  
                  if (char === '"') {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                    // Add the quote character only if we need to preserve it
                    // currentItem += char;
                  } else if (char === ',' && !inQuotes) {
                    // End of item
                    parsed.push(currentItem.trim());
                    currentItem = '';
                  } else {
                    // Regular character
                    currentItem += char;
                  }
                }
                
                // Add the last item
                if (currentItem) {
                  parsed.push(currentItem.trim());
                }
                
                // Remove surrounding quotes from each item
                correctAnswers = parsed.map(item => {
                  if (item.startsWith('"') && item.endsWith('"')) {
                    return item.substring(1, item.length - 1);
                  }
                  return item;
                });
              }
              
              console.log("Robustly parsed correct answers:", correctAnswers);
            } catch (error) {
              console.error("Error with robust parsing, falling back:", error);
              
              // Fallback to simpler approach
              correctAnswers = question.correct_answer
                .substring(1, question.correct_answer.length - 1)
                .split(',')
                .map(item => {
                  const trimmed = item.trim();
                  // Handle quoted strings
                  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
                    return trimmed.substring(1, trimmed.length - 1);
                  }
                  return trimmed;
                });
              console.log("Fallback parsed correct answers:", correctAnswers);
            }
          }
          
          // Whether the question has multiple correct answers
          const isMultipleAnswer = Array.isArray(correctAnswers) || 
                                 (typeof question.correct_answer === 'string' && 
                                  question.correct_answer.includes(','));
          
          if (question.type === 'mcq') {
            const studentAnswers = Array.isArray(question.student_answer) 
              ? question.student_answer 
              : [question.student_answer];
            
            console.log("Student answers:", studentAnswers);
            
            // Check if student selected at least one correct answer
            let hasAtLeastOneCorrectAnswer = false;
            
            // For multiple-choice with multiple answers
            if (isMultipleAnswer && studentAnswers.length > 0) {
              // Process each student answer to check if they selected all correct options and no incorrect ones
              let hasSelectedCorrectOption = false;
              let hasSelectedIncorrectOption = false;
              
              for (const answer of studentAnswers) {
                // Process the student's answer (using option index)
                if (question.options && !isNaN(parseInt(answer, 10))) {
                  const selectedIndex = parseInt(answer, 10);
                  if (selectedIndex >= 0 && selectedIndex < question.options.length) {
                    const selectedOption = question.options[selectedIndex];
                    if (correctAnswers.includes(selectedOption)) {
                      hasSelectedCorrectOption = true;
                      console.log(`Selected correct option: ${selectedOption}`);
                    } else {
                      hasSelectedIncorrectOption = true;
                      console.log(`Selected incorrect option: ${selectedOption}`);
                    }
                  }
                }
              }
              
              // Only mark as correct if at least one correct option was selected AND no incorrect options were selected
              hasAtLeastOneCorrectAnswer = hasSelectedCorrectOption && !hasSelectedIncorrectOption;
              console.log(`Multiple-choice with multiple answers - hasSelectedCorrectOption: ${hasSelectedCorrectOption}, hasSelectedIncorrectOption: ${hasSelectedIncorrectOption}, isCorrect: ${hasAtLeastOneCorrectAnswer}`);
            }
            // Otherwise, try to validate the specific answer
            else if (correctAnswers) {
              for (const answer of studentAnswers) {
                // Try multiple approaches to find if the answer is correct
                
                // 1. Direct check if the student's answer is in the array of correct answers
                if (Array.isArray(correctAnswers) && correctAnswers.includes(answer)) {
                  hasAtLeastOneCorrectAnswer = true;
                  console.log(`Answer ${answer} directly matches a correct answer`);
                  break;
                }
                
                // 2. Check if the student's selected option text is correct
                if (question.options && answer !== null && answer !== undefined) {
                  const selectedOptionIndex = parseInt(answer, 10);
                  if (!isNaN(selectedOptionIndex) && selectedOptionIndex < question.options.length) {
                    const selectedOption = question.options[selectedOptionIndex];
                    
                    if (Array.isArray(correctAnswers) && correctAnswers.includes(selectedOption)) {
                      hasAtLeastOneCorrectAnswer = true;
                      console.log(`Selected option ${selectedOption} is correct`);
                      break;
                    }
                    
                    // If correctAnswers is a string, check if the selected option is part of it
                    if (typeof question.correct_answer === 'string' && 
                        question.correct_answer.includes(selectedOption)) {
                      hasAtLeastOneCorrectAnswer = true;
                      console.log(`Selected option ${selectedOption} is part of correct answer string`);
                      break;
                    }
                  }
                }
              }
            }
            
            console.log("Is at least one answer correct?", hasAtLeastOneCorrectAnswer);
            
            // If the student got at least one right, mark as correct
            if (hasAtLeastOneCorrectAnswer && !question.is_correct) {
              console.log("Marking question as correct");
              // Set the question as correct and award full points
              question.is_correct = true;
              question.points_earned = question.points;
              
              // Update the submission score
              data.submission.score = Number(data.submission.score || 0) + Number(question.points);
              data.submission.percentage = Math.round((Number(data.submission.score) / Number(data.submission.total_points)) * 100);
              
              // Mark that we applied a fix
              appliedFix = true;
            }
          } else if (question.type === 'identification' && isMultipleAnswer) {
            // For identification questions with multiple correct answers
            const studentAnswer = question.student_answer;
            if (studentAnswer && Array.isArray(correctAnswers)) {
              // Check if the student's answer matches any of the correct answers
              // Use case-insensitive comparison with trimming
              const isCorrect = correctAnswers.some(answer => 
                answer.toLowerCase().trim() === studentAnswer.toLowerCase().trim()
              );
              
              console.log(`Identification answer: "${studentAnswer}" in correctAnswers?`, isCorrect, correctAnswers);
              
              // If the student's answer matches and it's not already marked as correct
              if (isCorrect && !question.is_correct) {
                console.log("Marking identification answer as correct");
                // Mark the question as correct and award full points
                question.is_correct = true;
                question.points_earned = question.points;
                
                // Update the submission score
                data.submission.score = Number(data.submission.score || 0) + Number(question.points);
                data.submission.percentage = Math.round((Number(data.submission.score) / Number(data.submission.total_points)) * 100);
                
                // Mark that we applied a fix
                appliedFix = true;
                console.log("Fixed identification answer grading: marked as correct");
              }
            }
          }
          return question;
        });
      }
      
      // Update state with our results
      setExamResults(data);
      setExamSubmitted(true);
      
    } catch (error) {
      console.error("Error fetching exam results:", error);
      throw error; // Re-throw to let the caller handle it
    }
  };

  const handleBackToExams = () => {
    setSelectedExam(null);
    setExamStarted(false);
    setExamSubmitted(false);
    setExamResults(null);
    setAnswers({});
    setSubmissionId(null);
    
    // Navigate back to the appropriate tab
    navigate(`/courses/${courseId}/exams?tab=${currentTab}`);
    
    // Refresh the appropriate list
    if (currentTab === 'completed') {
      fetchCompletedExams();
    } else {
      fetchAvailableExams();
    }
  };

  const calculateCompletion = () => {
    if (!selectedExam || !selectedExam.questions) return 0;
    
    const totalQuestions = selectedExam.questions.length;
    if (totalQuestions === 0) return 0;
    
    // Count questions that have been answered
    const answeredQuestions = selectedExam.questions.filter(q => {
      if (q.type === 'mcq' && isMultipleAnswerQuestion(q.question_id)) {
        // For multiple answer questions, check if the array has entries
        return Array.isArray(answers[q.question_id]) && answers[q.question_id].length > 0;
      } else {
        // For single answer questions, check if it's not empty
        return answers[q.question_id] !== '';
      }
    }).length;
    
    return Math.round((answeredQuestions / totalQuestions) * 100);
  };

  const handleRequestRecheck = async (e) => {
    e.preventDefault();
    
    // Check if recheck is allowed in archived courses
    if (isViewOnly) {
      return;
    }
    
    try {
      setRecheckSubmitting(true);
      
      // Check if the student has already submitted a recheck request
      if (examResults.submission.has_requested_recheck) {
        setShowRecheckForm(false);
        setRecheckReason('');
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/student-exams/results/${examResults.exam.exam_id}/recheck-request`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          jwt_token: localStorage.token 
        },
        body: JSON.stringify({ 
          reason: recheckReason,
          submission_id: examResults.submission.submission_id 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to request recheck');
      }
      
      const data = await response.json();
      
      // Update the local state to reflect the new status
      setExamResults({
        ...examResults,
        submission: {
          ...examResults.submission,
          status: data.status,
          has_requested_recheck: true
        }
      });
      
      setShowRecheckForm(false);
      setRecheckReason('');
    } catch (err) {
      console.error("Error requesting recheck:", err);
    } finally {
      setRecheckSubmitting(false);
    }
  };

  // Render the exams list
  const renderExamsList = () => {
    if (exams.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              <path d="M9 10h1v4H9zm3-1h1v6h-1z"/>
            </svg>
          </div>
          <p>
            {currentTab === 'completed' 
              ? "You haven't completed any exams in this course yet."
              : "No available exams found for this course."}
          </p>
        </div>
      );
    }

    return (
      <>
        {/* Course Status Notice */}
        {!canTakeNewExams && currentTab === 'interface' && (
          <div className={`course-status-notice ${courseStatus}`}>
            <p>
              {isViewOnly 
                ? "📚 This course is archived. You can only view completed exams."
                : "⏸️ This course is inactive. You can only view completed exams."
              }
            </p>
          </div>
        )}
        
        <div className="exam-list-header">
          <h3 className="exam-list-title">
            {currentTab === 'completed' ? "Completed Exams" : "Available Exams"}
          </h3>
          <span className="exam-list-count">{exams.length}</span>
        </div>
        
        <div className="exams-list">
          {exams.map(exam => (
            <div 
              key={exam.exam_id}
              className={`exam-card ${exam.completion_status} ${exam.is_past_due ? 'past-due' : ''} ${!canTakeNewExams && !currentTab === 'completed' ? 'view-only' : ''}`}
              onClick={() => (exam.is_past_due || (!canTakeNewExams && !currentTab === 'completed')) ? null : handleExamSelect(exam.exam_id)}
            >
              <div className="exam-card-content">
                <h3 className="exam-title">{exam.title}</h3>
                
                <p className="exam-description">
                  {exam.description ? 
                    (exam.description.length > 100 ? `${exam.description.substring(0, 100)}...` : exam.description) 
                    : 'No description provided'}
                </p>
                
                <div className="exam-meta">
                  {exam.completion_status === 'completed' ? (
                    <>
                      <div className="published-info">
                        <FaCalendarAlt />
                        <span>Completed: {exam.completion_date}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="published-info">
                        <FaCalendarAlt />
                        <span>Published: {exam.published_date}</span>
                      </div>
                      
                      {exam.due_date && (
                        <div className={`due-date-info ${exam.is_past_due ? 'overdue' : ''}`}>
                          <FaClock />
                          <span>{formatDueDate(exam.due_date)?.text}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                <div className="exam-status-badges">
                  {exam.completion_status === 'completed' ? (
                    <>
                      <span className="status-badge completed-badge">Completed</span>
                      <span className="status-badge score-badge">
                        <FaPercentage /> {exam.score}% ({exam.points_earned}/{exam.total_points})
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={`status-badge ${exam.is_past_due ? 'overdue-badge' : (!canTakeNewExams ? 'disabled-badge' : 'available-badge')}`}>
                        {exam.is_past_due ? 'Overdue' : (!canTakeNewExams ? 'Unavailable' : 'Available')}
                      </span>
                      {!canTakeNewExams && !currentTab === 'completed' && (
                        <span className="status-badge view-only-badge">View Only</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  // Render loading state
  if (loading) {
    return (
      <div className="test-interface-container">
        <LoadingIndicator text="Loading Exams" />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="test-interface-container">
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={currentTab === 'completed' ? fetchCompletedExams : fetchAvailableExams}>Try Again</button>
        </div>
      </div>
    );
  }

  // Render exam results
  if (examSubmitted && examResults) {
    return (
      <div className="test-interface-container">
        <div className="exam-completion" ref={resultsRef}>
          <h2>Exam Results</h2>
          <div className="exam-score">
            <h3>{examResults.exam.title}</h3>
            <div className="score-display">
              <div className="score-circle">
                <span className="score-percentage">{Number(examResults.submission.percentage)}%</span>
              </div>
              <div className="score-details">
                <p>Score: <strong>{Number(examResults.submission.score)}/{examResults.submission.total_points}</strong></p>
                <p>Submitted: {new Date(examResults.submission.submitted_at).toLocaleString()}</p>
                <p>Status: <strong>{examResults.submission.status || 'graded'}</strong></p>
              </div>
            </div>
          </div>
          
          {/* Recheck Request Section - Only show if course allows it */}
          {!isViewOnly && !showRecheckForm && !examResults.submission.has_requested_recheck && (
            <div className="recheck-request-section">
              <button 
                className="recheck-button"
                onClick={() => setShowRecheckForm(true)}
              >
                Request Grade Recheck
              </button>
            </div>
          )}
          
          {isViewOnly && (
            <div className="archived-course-notice">
              <p>📚 This course is archived. Recheck requests are not available.</p>
            </div>
          )}
          
          {showRecheckForm && (
            <div className="recheck-form">
              <h4>Request Grade Recheck</h4>
              <form onSubmit={handleRequestRecheck}>
                <div className="form-group">
                  <label htmlFor="recheckReason">Reason for recheck request:</label>
                  <textarea
                    id="recheckReason"
                    value={recheckReason}
                    onChange={(e) => setRecheckReason(e.target.value)}
                    placeholder="Please explain why you are requesting a recheck..."
                    required
                  ></textarea>
                </div>
                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="submit-recheck-btn"
                    disabled={recheckSubmitting}
                  >
                    {recheckSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                  <button 
                    type="button" 
                    className="cancel-btn"
                    onClick={() => {
                      setShowRecheckForm(false);
                      setRecheckReason('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {examResults.submission.status === 'recheck_requested' && (
            <div className="recheck-status">
              <p className="recheck-pending">Your grade recheck request has been submitted and is pending review.</p>
            </div>
          )}
          
          {examResults.submission.status === 'rechecking' && (
            <div className="recheck-status">
              <p className="recheck-in-progress">Your exam is currently being rechecked by the professor.</p>
            </div>
          )}
          
          {examResults.submission.status === 'recheck_completed' && (
            <div className="recheck-status">
              <p className="recheck-completed">Your exam has been rechecked. The updated score is reflected above.</p>
            </div>
          )}
          
          <div className="questions-review">
            <h3>Review Questions</h3>
            {examResults.questions && examResults.questions.map((question, index) => (
              <div key={question.question_id} className={`question-review-card ${question.is_correct ? 'correct' : 'incorrect'}`}>
                <div className="question-number">Question {index + 1}</div>
                <div className="question-text">{question.question_text}</div>
                
                {question.type === 'mcq' && question.options && (
                  <>
                    {/* Show a notice if multiple answers were allowed */}
                    {Array.isArray(question.correct_answer) && question.correct_answer.length > 1 && (
                      <div className="multi-answer-notice">
                        <p>This question required selecting all correct options and no incorrect options to be considered correct.</p>
                      </div>
                    )}
                    
                    <div className="options-review-list">
                      {question.options.map((option, optIndex) => {
                        // Determine the correct CSS class based on student answers and correct answer
                        let optionClass = '';
                        const studentAnswers = Array.isArray(question.student_answer) 
                          ? question.student_answer 
                          : [question.student_answer];
                        
                        const correctAnswers = Array.isArray(question.correct_answer)
                          ? question.correct_answer
                          : [question.correct_answer];
                        
                        const isSelected = studentAnswers.includes(optIndex.toString());
                        const isCorrect = correctAnswers.includes(option);
                        
                        if (isSelected) {
                          optionClass = isCorrect ? 'correct-answer' : 'wrong-answer';
                        } else if (isCorrect) {
                          // Highlight correct answers that weren't selected
                          optionClass = 'missed-answer';
                        }
                        
                        return (
                          <div 
                            key={optIndex}
                            className={`option-review-item ${optionClass} ${isSelected ? 'student-selected' : ''}`}
                          >
                            <div className="option-marker">
                              {isSelected && <FaCheck />}
                            </div>
                            <div className="option-text">{option}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                
                {question.type === 'identification' && (
                  <div className="identification-review">
                    {/* Show a notice if multiple answers were allowed */}
                    {Array.isArray(question.correct_answer) && question.correct_answer.length > 1 && (
                      <div className="multi-answer-notice">
                        <p>This question allowed multiple correct answers. You only needed to provide one of the acceptable answers to receive full credit.</p>
                      </div>
                    )}
                    <div className="student-answer">
                      <span className="answer-label">Your answer:</span>
                      <span className="answer-text">{question.student_answer || '(No answer)'}</span>
                    </div>
                    <div className="correct-answer">
                      <span className="answer-label">Correct answer{Array.isArray(question.correct_answer) && question.correct_answer.length > 1 ? 's' : ''}:</span>
                      <span className="answer-text">
                        {Array.isArray(question.correct_answer) 
                          ? question.correct_answer.join(', ') 
                          : question.correct_answer}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="question-points">
                  Points: {question.is_correct ? question.points_earned : 0}/{question.points}
                </div>
              </div>
            ))}
          </div>
          
          <button className="back-button" onClick={handleBackToExams}>
            Back to {currentTab === 'completed' ? 'Completed' : 'Available'} Exams
          </button>
        </div>
      </div>
    );
  }

  // Render exam taking interface
  if (selectedExam) {
    return (
      <div className="test-interface-container">
        <div className="exam-header">
          <h2>{selectedExam.title}</h2>
          <p className="exam-description">{selectedExam.description}</p>
          
          {selectedExam.due_date && (
            <div className={`exam-due-info ${isExamPastDue(selectedExam) ? 'overdue' : ''}`}>
              <FaClock style={{ marginRight: '8px' }} />
              {formatDueDate(selectedExam.due_date)?.text}
            </div>
          )}
          
          {!examStarted ? (
            <div className="exam-start-section">
              {isExamPastDue(selectedExam) ? (
                <div className="exam-overdue-message">
                  <p>This exam is past its due date and can no longer be accessed.</p>
                </div>
              ) : !canTakeNewExams ? (
                <div className="exam-disabled-message">
                  <p>
                    {isViewOnly 
                      ? "This course is archived. Exam taking is not available."
                      : "This course is inactive. You can only view completed exams."
                    }
                  </p>
                </div>
              ) : (
                <>
                  <p>This exam contains {selectedExam.questions?.length || 0} questions.</p>
                  <button 
                    className="start-exam-btn" 
                    onClick={handleStartExam}
                    disabled={submitting}
                  >
                    {submitting ? 'Starting...' : 'Start Exam'}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="exam-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${calculateCompletion()}%` }}
                ></div>
              </div>
              <span className="progress-text">
                {calculateCompletion()}% Complete
              </span>
            </div>
          )}
        </div>
        
        {examStarted && (
          <>
            <div className="questions-container">
              {selectedExam.questions && selectedExam.questions.map((question, index) => (
                <div key={question.question_id} className="question-card">
                  <div className="question-number">Question {index + 1}</div>
                  <div className="question-text">{question.question_text}</div>
                  <div className="question-points">Points: {question.points}</div>
                  
                  {/* Check if this is a multiple-answer MCQ question */}
                  {question.type === 'mcq' && question.options && (
                    <>
                      {/* Show a notice if multiple answers are allowed */}
                      {isMultipleAnswerQuestion(question.question_id) && (
                        <div className="multi-answer-notice">
                          <p>This question required selecting all correct options and no incorrect options to be considered correct.</p>
                        </div>
                      )}
                      
                      <div className="options-list">
                        {question.options.map((option, optIndex) => {
                          // Determine if this is a multiple-answer question
                          const isMultiple = isMultipleAnswerQuestion(question.question_id);
                          
                          // Check if this option is selected
                          const isSelected = isMultiple
                            ? Array.isArray(answers[question.question_id]) && 
                              answers[question.question_id].includes(optIndex.toString())
                            : answers[question.question_id] === optIndex.toString();
                          
                          return (
                            <div 
                              key={optIndex}
                              className={`option-item ${isMultiple ? 'multiple-answers' : ''} ${isSelected ? 'selected' : ''}`}
                              onClick={() => isMultiple 
                                ? handleMultipleOptionToggle(question.question_id, optIndex)
                                : handleOptionSelect(question.question_id, optIndex)
                              }
                            >
                              <div className="option-marker">
                                {isSelected && <FaCheck />}
                              </div>
                              <div className="option-text">{option}</div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  
                  {question.type === 'identification' && (
                    <div className="identification-input">
                      {/* Show a notice if multiple answers are allowed */}
                      {isMultipleAnswerQuestion(question.question_id) && (
                        <div className="multi-answer-notice">
                          <p>This question allows multiple correct answers. You only need to provide one of the acceptable answers to receive full credit.</p>
                        </div>
                      )}
                      <input
                        type="text"
                        placeholder="Your answer"
                        value={answers[question.question_id] || ''}
                        onChange={(e) => handleAnswerChange(question.question_id, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="exam-actions">
              <button 
                className="submit-exam-btn"
                onClick={handleSubmitExam}
                disabled={submitting || calculateCompletion() === 0}
              >
                {submitting ? 'Submitting...' : 'Submit Exam'}
              </button>
            </div>
          </>
        )}
        
        <button className="back-button" onClick={handleBackToExams}>
          Back to {currentTab === 'completed' ? 'Completed' : 'Available'} Exams
        </button>
      </div>
    );
  }

  // Render available exams list
  return (
    <div className="test-interface-container">
      {loading ? (
        <LoadingIndicator text="Loading Exams" />
      ) : error ? (
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={currentTab === 'completed' ? fetchCompletedExams : fetchAvailableExams}>Try Again</button>
        </div>
      ) : selectedExam ? (
        <div className="exam-container">
          {/* Exam display UI - this part remains largely unchanged */}
          {examSubmitted ? (
            <div className="exam-completion">
              <h2>Exam Completed</h2>
              
              {examResults ? (
                <div className="exam-score">
                  <h3>Your Results</h3>
                  
                  <div className="score-display">
                    <div className="score-circle">
                      <span className="score-percentage">{examResults.submission.percentage}%</span>
                    </div>
                    
                    <div className="score-details">
                      <p>
                        <strong>Total Score:</strong> {examResults.submission.score} / {examResults.submission.total_points}
                      </p>
                      <p>
                        <strong>Submitted:</strong> {new Date(examResults.submission.submitted_at).toLocaleString()}
                      </p>
                      <p>
                        <strong>Status:</strong> {examResults.submission.status === 'graded' ? 'Graded' : 'Submitted'}
                      </p>
                    </div>
                  </div>
                  
                  <button onClick={handleBackToExams} className="back-button">
                    Back to {currentTab === 'completed' ? 'Completed' : 'Available'} Exams
                  </button>
                </div>
              ) : (
                <LoadingIndicator text="Loading Results" />
              )}
            </div>
          ) : (
            <>
              <div className="exam-header">
                <h2>{selectedExam.title}</h2>
                <div className="exam-description">{selectedExam.description}</div>
                <div className="exam-info">
                  <p>Total Points: {selectedExam.total_points}</p>
                  {selectedExam.time_limit && (
                    <p>Time Limit: {selectedExam.time_limit} minutes</p>
                  )}
                </div>
                
                {!examStarted && (
                  <div className="exam-start-section">
                    <button 
                      className="start-exam-btn"
                      onClick={handleStartExam}
                      disabled={submitting}
                    >
                      {submitting ? 'Starting...' : 'Start Exam'}
                    </button>
                  </div>
                )}
                
                <button onClick={handleBackToExams} className="back-button">
                  Back to {currentTab === 'completed' ? 'Completed' : 'Available'} Exams
                </button>
              </div>
              
              {examStarted && (
                <>
                  <div className="questions-container">
                    {selectedExam.questions && selectedExam.questions.map((question, index) => (
                      <div key={question.question_id} className="question-card">
                        <div className="question-number">Question {index + 1}</div>
                        <div className="question-text">{question.question_text}</div>
                        <div className="question-points">Points: {question.points}</div>
                        
                        {/* Question type specific content */}
                        {/* ... existing question rendering ... */}
                      </div>
                    ))}
                  </div>
                  
                  <div className="exam-actions">
                    <button 
                      className="submit-exam-btn"
                      onClick={handleSubmitExam}
                      disabled={submitting || calculateCompletion() === 0}
                    >
                      {submitting ? 'Submitting...' : 'Submit Exam'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        renderExamsList()
      )}
    </div>
  );
};

export default TestInterfaceComponent; 