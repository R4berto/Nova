import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { FaTrash, FaDownload, FaUpload, FaFileDownload } from 'react-icons/fa';
import { useLocation, useNavigate } from 'react-router-dom';
import './CombinedExam.css';

// Backend API base URL
const API_BASE_URL = 'http://localhost:5000';

const ExamBuilderComponent = ({ courseId, examId: propExamId, courseStatus = 'active' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  // State for exam details
  const [examTitle, setExamTitle] = useState('');
  const [examDescription, setExamDescription] = useState('');
  const [examDueDate, setExamDueDate] = useState('');
  const [loadedExamId, setLoadedExamId] = useState(null);
  const [isPublished, setIsPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exams, setExams] = useState([]);
  const [showExamsList, setShowExamsList] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [importError, setImportError] = useState(null);
  const [resetKey, setResetKey] = useState(0); // Add a reset key to force re-renders

  // State for questions
  const [questions, setQuestions] = useState([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState({
    type: 'mcq',
    question: '',
    options: ['', '', '', ''],
    correctAnswerIndex: null,
    allowMultipleAnswers: false,
    correctAnswerIndices: [],
    correctAnswerList: [],
    points: 1
  });

  // Check if modifications are allowed based on course status
  const isModificationAllowed = courseStatus === 'active';
  const isViewOnly = courseStatus === 'archived';

  // Get examId from URL parameters or props
  const getExamIdFromUrl = useCallback(() => {
    const params = new URLSearchParams(location.search);
    return params.get('examId');
  }, [location.search]);

  // Helper function for API requests
  const apiRequest = useCallback(async (url, method = 'GET', body = null) => {
    try {
      const options = {
        method,
        headers: {
          jwt_token: localStorage.token
        }
      };
      
      if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
      
      console.log(`Making ${method} request to ${url}`);
      if (body) console.log('Request body:', body);
      
      const response = await fetch(url, options);
      console.log('Response status:', response.status);
      
      // Get response text first
      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      // Try to parse as JSON if not empty
      let data = null;
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Error parsing response as JSON:', parseError);
          // Don't throw an error here if it's a successful response
          // Some endpoints might return empty responses on success
          if (response.ok) {
            console.log('Empty or non-JSON response received with successful status code');
            return { data: null, response };
          }
          throw new Error('Invalid response format from server');
        }
      }
      
      if (!response.ok) {
        const errorMessage = data?.error || `Server error: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      return { data, response };
    } catch (error) {
      console.error(`API request error for ${url}:`, error);
      throw error;
    }
  }, []);

  // Load an existing exam
  const loadExam = useCallback(async (id) => {
    try {
      setLoading(true);
      console.log(`Loading exam with ID: ${id}`);
      
      const { data } = await apiRequest(`${API_BASE_URL}/exams/single/${id}`);
      console.log('Loaded exam data:', data);
      
      // Set exam details
      setLoadedExamId(id);
      setExamTitle(data.title || '');
      setExamDescription(data.description || '');
      setExamDueDate(formatDateForLocalInput(data.due_date));
      setIsPublished(!!data.is_published);
      
      // Set questions
      if (data.questions && Array.isArray(data.questions)) {
        console.log(`Loaded ${data.questions.length} questions:`, data.questions);
        
        // Transform backend questions to frontend format
        const formattedQuestions = data.questions.map(q => {
          // Parse correct_answer - it might be stored as JSON string for arrays
          let correctAnswer = q.correct_answer || '';
          
          // Try to parse as JSON if it looks like an array or object
          if (typeof correctAnswer === 'string' && (correctAnswer.startsWith('[') || correctAnswer.startsWith('{'))) {
            try {
              correctAnswer = JSON.parse(correctAnswer);
            } catch (parseError) {
              console.warn('Failed to parse correct_answer as JSON:', correctAnswer, parseError);
              // Keep as string if parsing fails
            }
          }
          // Handle comma-separated strings that might represent arrays (e.g., "test","tes","sadasd")
          else if (typeof correctAnswer === 'string' && correctAnswer.includes(',') && correctAnswer.includes('"')) {
            try {
              // Try to parse as a comma-separated list of quoted strings
              // Convert "test","tes","sadasd" to ["test","tes","sadasd"]
              const arrayString = '[' + correctAnswer + ']';
              correctAnswer = JSON.parse(arrayString);
            } catch (parseError) {
              console.warn('Failed to parse correct_answer as comma-separated array:', correctAnswer, parseError);
              // Keep as string if parsing fails
            }
          }
          
          // Make sure correctAnswer is an array if allowMultipleAnswers is true
          if (q.allow_multiple_answers && !Array.isArray(correctAnswer)) {
            if (typeof correctAnswer === 'string' && correctAnswer.includes(',')) {
              // Try simple comma splitting as a last resort
              correctAnswer = correctAnswer.split(',').map(s => s.trim());
            } else {
              // Wrap single value in array
              correctAnswer = [correctAnswer];
            }
          }
          
          // Get correct answer indices from the database or calculate them
          let correctAnswerIndices = [];
          
          // Use the stored correct_answer_indices if available
          if (q.correct_answer_indices && Array.isArray(q.correct_answer_indices)) {
            correctAnswerIndices = q.correct_answer_indices;
            console.log(`Question ${q.question_id} - Using stored correct_answer_indices:`, correctAnswerIndices);
          } 
          // Otherwise, calculate them based on options and correctAnswer
          else if (q.type === 'mcq' && q.options && q.options.length > 0) {
            if (q.allow_multiple_answers && Array.isArray(correctAnswer)) {
              // For multiple correct answers, find each option in the correctAnswer array
              q.options.forEach((option, index) => {
                if (correctAnswer.includes(option)) {
                  correctAnswerIndices.push(index);
                }
              });
            } else {
              // For single correct answer, find its index in options
              const index = q.options.indexOf(
                Array.isArray(correctAnswer) ? correctAnswer[0] : correctAnswer
              );
              if (index !== -1) {
                correctAnswerIndices = [index];
              }
            }
            console.log(`Question ${q.question_id} - Calculated correctAnswerIndices:`, correctAnswerIndices);
          }
          
          console.log(`Question ${q.question_id} - allow_multiple_answers:`, q.allow_multiple_answers);
          console.log(`Question ${q.question_id} - correctAnswer after processing:`, correctAnswer);
          
          return {
            id: q.question_id,
            type: q.type || 'mcq',
            question: q.question_text || '',
            options: q.options || [],
            correctAnswer: correctAnswer,
            correctAnswerIndices: correctAnswerIndices,
            points: q.points || 1,
            allowMultipleAnswers: q.allow_multiple_answers || false
          };
        });
        
        setQuestions(formattedQuestions);
        console.log('Formatted questions:', formattedQuestions);
        
        // Select the first question if available
        if (formattedQuestions.length > 0) {
          setSelectedQuestionId(formattedQuestions[0].id);
        }
      } else {
        console.log('No questions found in the loaded exam');
        setQuestions([]);
        setSelectedQuestionId(null);
      }
      
      // Close the exams list
      setShowExamsList(false);
      
      return true;
    } catch (error) {
      console.error('Error loading exam:', error);
      toast.error(`Failed to load exam: ${error.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // Effect to handle URL parameters and prop changes - MOVED AFTER loadExam definition
  useEffect(() => {
    const urlExamId = getExamIdFromUrl();
    const examIdToLoad = propExamId || urlExamId;

    if (examIdToLoad && examIdToLoad !== loadedExamId) {
      loadExam(examIdToLoad);
    }
  }, [propExamId, getExamIdFromUrl, loadedExamId, loadExam]);

  // Update URL when exam is loaded
  useEffect(() => {
    if (loadedExamId) {
      const params = new URLSearchParams(location.search);
      params.set('examId', loadedExamId);
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    }
  }, [loadedExamId, location.pathname, location.search, navigate]);

  // Fetch existing exams for this course
  useEffect(() => {
    if (courseId) {
      fetchExams();
    } else {
      setApiError('No course ID provided. Please select a course first.');
    }
  }, [courseId]);

  const fetchExams = useCallback(async () => {
    if (!courseId) {
      setApiError('No course ID provided. Please select a course first.');
      return;
    }
    
    try {
      setLoading(true);
      setApiError(null);
      
      const { data } = await apiRequest(`${API_BASE_URL}/exams/${courseId}`);
      setExams(data || []);
    } catch (error) {
      console.error('Error fetching exams:', error);
      setApiError(`Failed to load exams: ${error.message}`);
      toast.error(`Failed to load exams: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [courseId, apiRequest]);

  // Helper function to convert UTC date to local datetime-local format
  const formatDateForLocalInput = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    
    // Create a new date object that represents the same moment in local time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Create a new exam
  const createExam = useCallback(async () => {
    if (!examTitle.trim()) {
      toast.error('Please enter an exam title');
      return null;
    }

    if (!courseId) {
      toast.error('No course selected. Please select a course first.');
      return null;
    }

    console.log('Creating exam with title:', examTitle, 'for course:', courseId);

    try {
      setSaving(true);
      
      // Store local questions before creating exam
      const localQuestions = [...questions];
      console.log(`Creating exam with ${localQuestions.length} local questions:`, localQuestions);
      
      const { data } = await apiRequest(
        `${API_BASE_URL}/exams/${courseId}`,
        'POST',
        {
          title: examTitle,
          description: examDescription,
          due_date: examDueDate ? new Date(examDueDate).toISOString() : null
        }
      );
      
      if (!data || !data.exam_id) {
        throw new Error('Server did not return a valid exam ID');
      }
      
      const newExamId = data.exam_id;
      console.log(`Exam created successfully with ID: ${newExamId}`);
      
      // Update URL with new exam ID
      const params = new URLSearchParams(location.search);
      params.set('examId', newExamId);
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
      
      // Explicitly set the loadedExamId state
      setLoadedExamId(newExamId);
      toast.success('Exam created successfully');
      
      // Save any questions that were added before creating the exam
      if (localQuestions.length > 0) {
        await saveQuestionsToExam(localQuestions, newExamId);
      }
      
      // Reload the exam to get the updated questions with proper IDs
      await loadExam(newExamId);
      
      // Refresh exams list
      await fetchExams();
      
      return newExamId;
    } catch (error) {
      console.error('Error creating exam:', error);
      toast.error(error.message || 'Failed to create exam');
      return null;
    } finally {
      setSaving(false);
    }
  }, [courseId, examTitle, examDescription, examDueDate, questions, apiRequest, loadExam, fetchExams, location.pathname, location.search, navigate]);

  // Update exam details
  const updateExam = useCallback(async () => {
    if (!loadedExamId) {
      return createExam();
    }

    if (!examTitle.trim()) {
      toast.error('Please enter an exam title');
      return false;
    }

    try {
      setSaving(true);
      
      await apiRequest(
        `${API_BASE_URL}/exams/${loadedExamId}`,
        'PUT',
        {
          title: examTitle,
          description: examDescription,
          due_date: examDueDate ? new Date(examDueDate).toISOString() : null
        }
      );
      
      toast.success('Exam updated successfully');
      
      // Refresh exams list
      await fetchExams();
      return true;
    } catch (error) {
      console.error('Error updating exam:', error);
      toast.error(error.message || 'Failed to update exam');
      return false;
    } finally {
      setSaving(false);
    }
  }, [loadedExamId, examTitle, examDescription, examDueDate, createExam, apiRequest, fetchExams]);

  // Publish or unpublish an exam
  const togglePublishStatus = useCallback(async () => {
    if (!loadedExamId) {
      toast.error('Please save the exam first');
      return false;
    }

    try {
      setSaving(true);
      
      // First, check if there are any questions in the database for this exam
      const { data: examData } = await apiRequest(`${API_BASE_URL}/exams/single/${loadedExamId}`);
      const questionsInDb = examData.questions || [];
      
      if (questionsInDb.length === 0 && questions.length === 0) {
        toast.error('Cannot publish an exam with no questions');
        return false;
      }
      
      // If we have local questions that aren't saved to the database yet, save them first
      const unsavedQuestions = questions.filter(q => !q.id || isNaN(q.id));
      if (unsavedQuestions.length > 0) {
        toast.loading('Saving questions before publishing...');
        const success = await saveQuestionsToExam(unsavedQuestions, loadedExamId);
        toast.dismiss();
        
        if (!success) {
          toast.error('Failed to save all questions. Please try again.');
          return false;
        }
        
        // Reload the exam to get the updated questions
        await loadExam(loadedExamId);
      }

      // Now proceed with publishing/unpublishing
      const endpoint = isPublished ? 'unpublish' : 'publish';
      
      const { data } = await apiRequest(
        `${API_BASE_URL}/exams/${loadedExamId}/${endpoint}`,
        'PUT'
      );
      
      // Update the published status
      setIsPublished(data.exam.is_published);
      
      // Add published_at timestamp if it's being published
      if (!isPublished && data.exam.is_published) {
        // Add the current time as the publish time
        data.exam.published_at = new Date().toISOString();
        
        // Update the database with the published timestamp if needed
        try {
          await apiRequest(
            `${API_BASE_URL}/exams/${loadedExamId}`,
            'PUT',
            {
              published_at: data.exam.published_at
            }
          );
        } catch (error) {
          console.error("Failed to update published timestamp:", error);
          // Non-critical error, continue anyway
        }
      }
      
      toast.success(`Exam ${isPublished ? 'unpublished' : 'published'} successfully`);
      
      // Reload the exam to get the latest data including questions
      await loadExam(loadedExamId);
      
      // Refresh exams list
      await fetchExams();
      return true;
    } catch (error) {
      console.error(`Error publishing/unpublishing exam:`, error);
      toast.error(error.message || `Failed to publish/unpublish exam`);
      return false;
    } finally {
      setSaving(false);
    }
  }, [loadedExamId, isPublished, questions, apiRequest, loadExam, fetchExams]);

  // Helper function to save multiple questions to an exam
  const saveQuestionsToExam = useCallback(async (questionsToSave, examId) => {
    if (!examId || !questionsToSave || !questionsToSave.length) {
      return false;
    }
    
    toast.loading(`Saving ${questionsToSave.length} questions...`);
    let savedCount = 0;
    let failedQuestions = [];
    
    console.log(`Attempting to save ${questionsToSave.length} questions to exam ${examId}`);
    
    // Save each question to the exam
    for (const question of questionsToSave) {
      console.log('Processing question:', question);
      
      const questionToSave = {
        type: question.type,
        question_text: question.question || question.question_text,
        options: question.type === 'mcq' ? question.options : null,
        correct_answer: question.correctAnswer || question.correct_answer,
        points: question.points || 1,
        allow_multiple_answers: question.allowMultipleAnswers || false
      };
      
      console.log('Formatted question to save:', questionToSave);
      
      try {
        const { data: savedQuestion } = await apiRequest(
          `${API_BASE_URL}/exams/${examId}/questions`,
          'POST',
          questionToSave
        );
        
        console.log('Question saved successfully:', savedQuestion);
        savedCount++;
      } catch (error) {
        console.error('Failed to save question:', questionToSave, error);
        failedQuestions.push(question);
      }
    }
    
    toast.dismiss();
    console.log(`Saved ${savedCount}/${questionsToSave.length} questions. Failed: ${failedQuestions.length}`);
    
    if (savedCount === questionsToSave.length) {
      toast.success(`All ${savedCount} questions saved successfully`);
      return true;
    } else {
      toast(`Saved ${savedCount} out of ${questionsToSave.length} questions`, {
        icon: '⚠️',
        style: {
          borderRadius: '10px',
          background: '#FFF3CD',
          color: '#856404',
        },
      });
      
      // Log details about failed questions
      if (failedQuestions.length > 0) {
        console.error('Failed to save these questions:', failedQuestions);
      }
      return savedCount > 0; // Return true if at least some questions were saved
    }
  }, [apiRequest]);

  // Save a single question to the backend
  const saveQuestion = useCallback(async (questionData, specificExamId = null) => {
    const examId = specificExamId || loadedExamId;
    console.log('saveQuestion called with examId:', examId, 'and data:', questionData);
    
    if (!examId) {
      console.error('Cannot save question: No exam ID available');
      toast.error('Cannot save question: No exam ID available. Please create an exam first.');
      return null;
    }

    try {
      // Format the data for the backend
      const requestBody = {
        type: questionData.type,
        question_text: questionData.question || questionData.question_text,
        options: questionData.type === 'mcq' ? questionData.options : null,
        correct_answer: questionData.allowMultipleAnswers
          ? Array.isArray(questionData.correctAnswer) 
              ? questionData.correctAnswer 
              : [questionData.correctAnswer]
          : questionData.correctAnswer,
        points: questionData.points || 1,
        allow_multiple_answers: questionData.allowMultipleAnswers
      };
      
      const { data } = await apiRequest(
        `${API_BASE_URL}/exams/${examId}/questions`,
        'POST',
        requestBody
      );
      
      console.log('Question saved successfully:', data);
      return data;
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error(error.message || 'Failed to save question');
      return null;
    }
  }, [loadedExamId, apiRequest]);

  // Delete a question from the backend
  const deleteQuestionFromBackend = useCallback(async (questionId) => {
    if (!loadedExamId) return false;

    try {
      console.log(`Attempting to delete question ${questionId} from exam ${loadedExamId}`);
      
      await apiRequest(
        `${API_BASE_URL}/exams/${loadedExamId}/questions/${questionId}`,
        'DELETE'
      );
      
      console.log(`Question ${questionId} deleted successfully`);
      return true;
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error(error.message || 'Failed to delete question');
      return false;
    }
  }, [loadedExamId, apiRequest]);

  // Handle question type change
  const handleQuestionTypeChange = useCallback((type) => {
    setCurrentQuestion({
      ...currentQuestion,
      type,
      options: type === 'mcq' ? ['', '', '', ''] : [],
      correctAnswerIndex: null,
      allowMultipleAnswers: false,
      correctAnswerIndices: [],
      correctAnswerList: [],
      correctAnswer: type === 'identification' ? '' : undefined
    });
  }, [currentQuestion]);

  // Handle option change for MCQ
  const handleOptionChange = useCallback((index, value) => {
    setCurrentQuestion(prev => {
      const newOptions = [...prev.options];
      
      // Check if this value already exists in other options (ignore empty values)
      const isDuplicate = value.trim() !== '' && 
        prev.options.some((option, i) => i !== index && option.trim() === value.trim());
      
      if (isDuplicate) {
        toast.error('Duplicate options are not allowed');
        return prev; // Don't update if duplicate
      }
      
      newOptions[index] = value;
      return { ...prev, options: newOptions };
    });
  }, []);

  // Add a new option for MCQ
  const handleAddOption = useCallback(() => {
    // Just add an empty option - validation will happen when user enters text
    setCurrentQuestion(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  }, []);

  // Remove an option from MCQ
  const handleRemoveOption = useCallback((indexToRemove) => {
    setCurrentQuestion(prev => {
      const newOptions = prev.options.filter((_, index) => index !== indexToRemove);
      let newCorrectAnswerIndex = prev.correctAnswerIndex;
      let newCorrectAnswerIndices = [...prev.correctAnswerIndices];
      
      // Handle single correct answer mode
      if (prev.correctAnswerIndex === indexToRemove) {
        newCorrectAnswerIndex = null;
      } else if (
        prev.correctAnswerIndex !== null &&
        prev.correctAnswerIndex > indexToRemove
      ) {
        newCorrectAnswerIndex = prev.correctAnswerIndex - 1;
      }
      
      // Handle multiple correct answers mode
      if (prev.correctAnswerIndices.includes(indexToRemove)) {
        // Remove the index
        newCorrectAnswerIndices = prev.correctAnswerIndices.filter(i => i !== indexToRemove);
      }
      
      // Adjust all indices that are greater than the removed index
      newCorrectAnswerIndices = newCorrectAnswerIndices.map(i => 
        i > indexToRemove ? i - 1 : i
      );
      
      return {
        ...prev,
        options: newOptions,
        correctAnswerIndex: newCorrectAnswerIndex,
        correctAnswerIndices: newCorrectAnswerIndices
      };
    });
  }, []);

  // Handle question selection
  const handleSelectQuestion = useCallback((questionId) => {
    setSelectedQuestionId(questionId);
    
    // Find the selected question
    const selectedQuestion = questions.find(q => q.id === questionId);
    
    if (selectedQuestion) {
      // Use the allowMultipleAnswers field directly from the question data
      const hasMultipleAnswers = selectedQuestion.allowMultipleAnswers || false;
      
      // Make sure correctAnswers is always an array
      let correctAnswers = [];
      if (hasMultipleAnswers) {
        // Handle different possible formats of selectedQuestion.correctAnswer
        if (Array.isArray(selectedQuestion.correctAnswer)) {
          correctAnswers = selectedQuestion.correctAnswer;
        } else if (typeof selectedQuestion.correctAnswer === 'string') {
          try {
            // Try to parse as JSON if it looks like an array
            if (selectedQuestion.correctAnswer.startsWith('[')) {
              correctAnswers = JSON.parse(selectedQuestion.correctAnswer);
            } else if (selectedQuestion.correctAnswer.includes(',')) {
              // Handle comma-separated values
              correctAnswers = selectedQuestion.correctAnswer.split(',').map(s => s.trim());
            } else {
              // Single value
              correctAnswers = [selectedQuestion.correctAnswer];
            }
          } catch (e) {
            console.error('Failed to parse correctAnswer:', e);
            correctAnswers = [selectedQuestion.correctAnswer];
          }
        } else {
          // Fallback
          correctAnswers = [selectedQuestion.correctAnswer];
        }
        
        // Clean up the answers to remove any extra quotes and syntax
        correctAnswers = correctAnswers.map(answer => {
          if (typeof answer === 'string') {
            // Remove any surrounding quotes and escape characters
            return answer.replace(/^["'{]+|[}"']+$/g, '').trim();
          }
          return answer;
        });
      } else {
        correctAnswers = [selectedQuestion.correctAnswer];
      }
      
      console.log('Question correctAnswer:', selectedQuestion.correctAnswer);
      console.log('Parsed correctAnswers:', correctAnswers);
      
      // Find the indices of correct answers
      let correctAnswerIndices = [];
      let correctAnswerIndex = null;
      let correctAnswerList = [];
      
      if (selectedQuestion.type === 'mcq' && selectedQuestion.options && selectedQuestion.options.length > 0) {
        // First check if we have stored correctAnswerIndices
        if (selectedQuestion.correctAnswerIndices && selectedQuestion.correctAnswerIndices.length > 0) {
          correctAnswerIndices = [...selectedQuestion.correctAnswerIndices];
          console.log('Using stored correctAnswerIndices:', correctAnswerIndices);
          
          // If it's single answer mode, use the first index
          if (!hasMultipleAnswers && correctAnswerIndices.length > 0) {
            correctAnswerIndex = correctAnswerIndices[0];
          }
        } else {
          // For multiple answers, calculate indices by comparing options with correctAnswers
          if (hasMultipleAnswers) {
            // Using exact string comparison to find correct answers
            correctAnswerIndices = [];
            
            // Clean up correct answers for comparison
            const cleanedCorrectAnswers = correctAnswers.map(answer => 
              typeof answer === 'string' ? answer.replace(/^["'{]+|[}"']+$/g, '').trim() : answer
            );
            
            // For each option, check if it's in the correctAnswers array
            selectedQuestion.options.forEach((option, index) => {
              // Clean up the option for comparison
              const cleanedOption = typeof option === 'string' ? option.toLowerCase().trim() : option;
              
              // Check if any of the clean correct answers match this option (case-insensitive)
              const isMatch = cleanedCorrectAnswers.some(answer => 
                typeof answer === 'string' && typeof option === 'string'
                  ? answer.toLowerCase().trim() === cleanedOption
                  : answer === option
              );
              
              if (isMatch) {
                correctAnswerIndices.push(index);
              }
            });
            
            console.log('Options:', selectedQuestion.options);
            console.log('Correct answers:', correctAnswers);
            console.log('Calculated correctAnswerIndices:', correctAnswerIndices);
          } else {
            // For single answer
            correctAnswerIndex = selectedQuestion.options.findIndex(
              option => option === correctAnswers[0]
            );
          }
        }
      } else if (selectedQuestion.type === 'identification') {
        // For identification type, if it has multiple answers
        if (hasMultipleAnswers) {
          correctAnswerList = [...correctAnswers];
        }
      }
      
      // Populate the form with the selected question data
      setCurrentQuestion({
        ...selectedQuestion,
        correctAnswerIndex,
        allowMultipleAnswers: hasMultipleAnswers,
        correctAnswerIndices,
        correctAnswerList,
        // Make sure we use the field names consistently
        question: selectedQuestion.question || '',
        correctAnswer: selectedQuestion.type === 'identification' && !hasMultipleAnswers ? selectedQuestion.correctAnswer : '',
        // Ensure we have options array for MCQ
        options: selectedQuestion.type === 'mcq' && selectedQuestion.options 
          ? [...selectedQuestion.options] 
          : ['', '', '', '']
      });
    }
  }, [questions]);

  // Add or update a question in the exam
  const handleAddQuestion = useCallback(async () => {
    // Validate question
    if (!currentQuestion.question.trim()) {
      toast.error('Please enter a question');
      return;
    }

    if (currentQuestion.type === 'mcq') {
      if (currentQuestion.options.length < 2) {
        toast.error('Please add at least 2 options for MCQ');
        return;
      }
      
      // Validate correct answers based on mode (single or multiple)
      if (currentQuestion.allowMultipleAnswers) {
        if (currentQuestion.correctAnswerIndices.length === 0) {
          toast.error('Please select at least one correct answer');
          return;
        }
      } else {
        if (
          currentQuestion.correctAnswerIndex === null ||
          currentQuestion.correctAnswerIndex < 0 ||
          currentQuestion.correctAnswerIndex >= currentQuestion.options.length
        ) {
          toast.error('Please select a correct answer for MCQ');
          return;
        }
      }
      
          if (currentQuestion.options.some(option => !option.trim())) {
      toast.error('Please fill in all MCQ options');
      return;
    }

    // Check for duplicate options
    const uniqueOptions = new Set(currentQuestion.options.map(opt => opt.trim()));
    if (uniqueOptions.size !== currentQuestion.options.length) {
      toast.error('Duplicate options are not allowed');
      return;
    }
    }

    if (currentQuestion.type === 'identification' && !currentQuestion.allowMultipleAnswers && !currentQuestion.correctAnswer?.trim()) {
      toast.error('Please enter the correct answer for Identification');
      return;
    }

    if (currentQuestion.type === 'identification' && currentQuestion.allowMultipleAnswers) {
      // Check if we have at least one answer for multiple identification
      const correctAnswerList = Array.isArray(currentQuestion.correctAnswerList) 
        ? currentQuestion.correctAnswerList 
        : [currentQuestion.correctAnswerList].filter(Boolean);
      
      if (correctAnswerList.length === 0 || correctAnswerList.every(answer => !answer?.trim())) {
        toast.error('Please enter at least one correct answer for Identification');
        return;
      }
      
      // Check for empty answers
      if (correctAnswerList.some(answer => !answer?.trim())) {
        toast.error('Blank answers are not allowed. Please fill in or remove empty answers.');
        return;
      }
      
      // Check for duplicate answers in correctAnswerList
      const uniqueAnswers = new Set(correctAnswerList.map(answer => answer.trim()));
      if (uniqueAnswers.size !== correctAnswerList.length) {
        toast.error('Duplicate answers are not allowed');
        return;
      }
    }

    // Check if we have a course ID
    if (!courseId) {
      toast.error('No course selected. Please select a course first.');
      return;
    }

    // Check if exam title is provided if we need to create an exam
    if (!loadedExamId && !examTitle.trim()) {
      toast.error('Please enter an exam title before adding questions');
      return;
    }

    // Prepare question data for saving
    const questionToSave = {
      ...currentQuestion,
      correctAnswer: currentQuestion.type === 'mcq'
        ? currentQuestion.allowMultipleAnswers
          ? currentQuestion.correctAnswerIndices.map(index => currentQuestion.options[index])
          : currentQuestion.options[currentQuestion.correctAnswerIndex]
        : currentQuestion.allowMultipleAnswers
          ? Array.isArray(currentQuestion.correctAnswerList) 
              ? currentQuestion.correctAnswerList 
              : [currentQuestion.correctAnswerList].filter(Boolean)
          : currentQuestion.correctAnswer,
      // Store the actual allowMultipleAnswers value
      allowMultipleAnswers: currentQuestion.allowMultipleAnswers,
      // These are UI-specific properties we don't need to save
      correctAnswerIndex: undefined,
      correctAnswerIndices: undefined,
      correctAnswerList: undefined
    };
    
    // Debug the created questionToSave object
    console.log('Prepared questionToSave:', {
      type: questionToSave.type,
      allowMultipleAnswers: questionToSave.allowMultipleAnswers,
      correctAnswer: questionToSave.correctAnswer
    });

    try {
      setSaving(true);
      
      // If no exam exists yet, create it first
      let examId = loadedExamId;
      if (!examId) {
        toast.loading('Creating exam first...');
        examId = await createExam();
        
        if (!examId) {
          toast.dismiss();
          toast.error('Failed to create exam. Please try again.');
          return;
        }
      }
      
      // Check if we're updating an existing question or adding a new one
      const isUpdating = selectedQuestionId && questions.some(q => q.id === selectedQuestionId);
      
      if (isUpdating) {
        // Update existing question
        toast.loading('Updating question...');
        
        try {
          // Format data for the backend
          const requestBody = {
            type: questionToSave.type,
            question_text: questionToSave.question,
            options: questionToSave.type === 'mcq' ? questionToSave.options : null,
            correct_answer: currentQuestion.allowMultipleAnswers
              ? Array.isArray(questionToSave.correctAnswer)
                  ? questionToSave.correctAnswer
                  : [questionToSave.correctAnswer]
              : questionToSave.correctAnswer,
            points: questionToSave.points || 1,
            allow_multiple_answers: currentQuestion.allowMultipleAnswers
          };
          
          // Debug logging
          console.log('Updating question with allow_multiple_answers:', currentQuestion.allowMultipleAnswers);
          console.log('Request body:', requestBody);
          
          // Make API call to update the question
          const result = await apiRequest(
            `${API_BASE_URL}/exams/${examId}/questions/${selectedQuestionId}`,
            'PUT',
            requestBody
          );
          
          // If we got here, the update was successful (even if data is null)
          console.log('Question update successful', result);
          
          // Update the question in local state
          setQuestions(prevQuestions => 
            prevQuestions.map(q => 
              q.id === selectedQuestionId ? { 
                ...questionToSave, 
                id: selectedQuestionId,
                allowMultipleAnswers: currentQuestion.allowMultipleAnswers 
              } : q
            )
          );
          
          toast.dismiss();
          toast.success('Question updated successfully');
          
          // Clear the form and selection
          setCurrentQuestion({
            type: 'mcq',
            question: '',
            options: ['', '', '', ''],
            correctAnswerIndex: null,
            allowMultipleAnswers: false,
            correctAnswerIndices: [],
            correctAnswerList: [],
            points: 1
          });
          setSelectedQuestionId(null);
        } catch (error) {
          console.error('Error updating question:', error);
          toast.dismiss();
          toast.error(error.message || 'Failed to update question');
        }
      } else {
        // Add new question
        toast.loading('Saving question...');
        const savedQuestion = await saveQuestion(questionToSave, examId);
        toast.dismiss();
        
        if (savedQuestion) {
          // Update questions in state
          setQuestions(prev => [...prev, {
            ...questionToSave,
            id: savedQuestion.question_id,
            allowMultipleAnswers: currentQuestion.allowMultipleAnswers
          }]);
          
          toast.success('Question added successfully');
          
          // Reset current question form
          setCurrentQuestion({
            type: 'mcq',
            question: '',
            options: ['', '', '', ''],
            correctAnswerIndex: null,
            allowMultipleAnswers: false,
            correctAnswerIndices: [],
            correctAnswerList: [],
            points: 1
          });
        } else {
          toast.error('Failed to save question to server');
        }
      }
    } catch (error) {
      console.error('Error processing question:', error);
      toast.dismiss();
      toast.error(error.message || 'Failed to process question');
    } finally {
      setSaving(false);
    }
  }, [courseId, loadedExamId, examTitle, currentQuestion, selectedQuestionId, questions, createExam, saveQuestion, apiRequest]);

  // Add a "Cancel Edit" button function
  const handleCancelEdit = useCallback(() => {
    // Reset the form and clear the selection
    setSelectedQuestionId(null);
    setCurrentQuestion({
      type: 'mcq',
      question: '',
      options: ['', '', '', ''],
      correctAnswerIndex: null,
      allowMultipleAnswers: false,
      correctAnswerIndices: [],
      correctAnswerList: [],
      points: 1
    });
  }, []);

  // Delete a question from the exam
  const handleDeleteQuestion = useCallback(async (id) => {
    // Add confirmation dialog
    if (!window.confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return;
    }
    
    try {
      setSaving(true);
      toast.loading('Deleting question...');
      
      // If we have an exam ID and the question has a numeric ID (from backend)
      if (loadedExamId && !isNaN(id)) {
        const success = await deleteQuestionFromBackend(id);
        
        if (!success) {
          toast.dismiss();
          toast.error('Failed to delete question from the server');
          return;
        }
      }
      
      // Update local state only if backend deletion was successful or if it's a local-only question
      setQuestions(prev => prev.filter(q => q.id !== id));
      
      toast.dismiss();
      toast.success('Question deleted successfully');
    } catch (error) {
      console.error('Error in handleDeleteQuestion:', error);
      toast.dismiss();
      toast.error(error.message || 'An error occurred while deleting the question');
    } finally {
      setSaving(false);
    }
  }, [loadedExamId, deleteQuestionFromBackend]);

  // Handle multiple answers toggle
  const handleMultipleAnswersToggle = useCallback(() => {
    setCurrentQuestion(prev => {
      // If turning off multiple answers but had multiple selected, choose the first selected one
      const newCorrectAnswerIndex = prev.allowMultipleAnswers && prev.correctAnswerIndices.length > 0 
        ? prev.correctAnswerIndices[0] 
        : prev.correctAnswerIndex;
      
      // If turning on multiple answers but had a single one selected, add it to the array
      const newCorrectAnswerIndices = !prev.allowMultipleAnswers && prev.correctAnswerIndex !== null
        ? [prev.correctAnswerIndex]
        : prev.correctAnswerIndices;
      
      return {
        ...prev,
        allowMultipleAnswers: !prev.allowMultipleAnswers,
        correctAnswerIndex: newCorrectAnswerIndex,
        correctAnswerIndices: newCorrectAnswerIndices
      };
    });
  }, []);

  // Handle toggling a correct answer for multiple answers mode
  const handleCorrectAnswerToggle = useCallback((index) => {
    setCurrentQuestion(prev => {
      // Check if this index is already in the array
      const isAlreadySelected = prev.correctAnswerIndices.includes(index);
      
      // If it's selected, remove it; otherwise, add it
      const newCorrectAnswerIndices = isAlreadySelected
        ? prev.correctAnswerIndices.filter(i => i !== index)
        : [...prev.correctAnswerIndices, index];
      
      return {
        ...prev,
        correctAnswerIndices: newCorrectAnswerIndices
      };
    });
  }, []);

  // Export exam to JSON file
  const exportExam = useCallback(() => {
    if (!loadedExamId) {
      toast.error('Please save the exam first before exporting');
      return;
    }
    
    try {
      // Create export data structure
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        exam: {
          title: examTitle,
          description: examDescription,
          due_date: examDueDate ? new Date(examDueDate).toISOString() : null,
          questions: questions.map(q => ({
            type: q.type,
            question_text: q.question,
            options: q.type === 'mcq' ? q.options : null,
            correct_answer: q.correctAnswer || q.correct_answer,
            points: q.points || 1,
            allow_multiple_answers: q.allowMultipleAnswers || false
          }))
        }
      };
      
      // Convert to JSON string
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Create blob and download link
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // Set download attributes
      link.href = url;
      link.download = `exam_${loadedExamId}_${examTitle.replace(/\s+/g, '_').toLowerCase()}.json`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Exam exported successfully');
    } catch (error) {
      console.error('Error exporting exam:', error);
      toast.error('Failed to export exam: ' + error.message);
    }
  }, [loadedExamId, examTitle, examDescription, examDueDate, questions]);

  // Handle file selection for import
  const handleFileSelect = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setImportError(null);
    
    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setImportError('File too large. Maximum size is 10MB.');
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }
    
    // Determine file type
    const isJsonFile = file.type === 'application/json' || file.name.endsWith('.json');
    const isHtmlFile = file.type === 'text/html' || file.name.endsWith('.html');
    
    // Check file type
    if (!isJsonFile && !isHtmlFile) {
      setImportError('Invalid file type. Please select a JSON or HTML file.');
      toast.error('Invalid file type. Please select a JSON or HTML file.');
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        // Fully reset the exam content first before importing
        setExamTitle('');
        setExamDescription('');
        setExamDueDate('');
        setQuestions([]);
        setSelectedQuestionId(null);
        setLoadedExamId(null);
        setIsPublished(false);
        
        let importData;
        
        if (isJsonFile) {
          // Parse JSON
          importData = JSON.parse(e.target.result);
          
          // Validate structure
          if (!importData.exam || !importData.version) {
            throw new Error('Invalid exam file format');
          }
        } else if (isHtmlFile) {
          // Parse HTML content
          const htmlContent = e.target.result;
          importData = parseHtmlExam(htmlContent);
        }
        
        // Set exam details
        setExamTitle(importData.exam.title || 'Imported Exam');
        setExamDescription(importData.exam.description || '');
        setExamDueDate(importData.exam.due_date ? formatDateForLocalInput(importData.exam.due_date) : '');
        
        // Process questions
        if (importData.exam.questions && Array.isArray(importData.exam.questions)) {
          // Transform questions to match our format
          const formattedQuestions = importData.exam.questions.map((q, index) => {
            // Generate temporary IDs for the imported questions
            const tempId = `import_${Date.now()}_${index}`;
            
            // Process correct answers
            let correctAnswer = q.correct_answer || '';
            let correctAnswerIndices = [];
            
            // For MCQ questions, calculate correct answer indices
            if (q.type === 'mcq' && q.options && q.options.length > 0) {
              if (q.allow_multiple_answers && Array.isArray(correctAnswer)) {
                // For multiple correct answers
                q.options.forEach((option, optIndex) => {
                  if (correctAnswer.includes(option)) {
                    correctAnswerIndices.push(optIndex);
                  }
                });
              } else {
                // For single correct answer
                const index = q.options.indexOf(
                  Array.isArray(correctAnswer) ? correctAnswer[0] : correctAnswer
                );
                if (index !== -1) {
                  correctAnswerIndices = [index];
                }
              }
            }
            
            return {
              id: tempId,
              type: q.type || 'mcq',
              question: q.question_text || '',
              options: q.options || [],
              correctAnswer: correctAnswer,
              correctAnswerIndices: correctAnswerIndices,
              points: q.points || 1,
              allowMultipleAnswers: q.allow_multiple_answers || false
            };
          });
          
          // Set the formatted questions
          setQuestions(formattedQuestions);
          
          // Select the first question if available
          if (formattedQuestions.length > 0) {
            setSelectedQuestionId(formattedQuestions[0].id);
          }
          
          toast.success(`Imported exam with ${formattedQuestions.length} questions`);
        } else {
          toast.warning('No questions found in the imported exam');
        }
      } catch (error) {
        console.error('Error importing exam:', error);
        setImportError(`Failed to import exam: ${error.message}`);
        toast.error(`Failed to import exam: ${error.message}`);
      }
    };
    
    reader.onerror = () => {
      setImportError('Error reading file');
      toast.error('Error reading file');
    };
    
    reader.readAsText(file);
    
    // Reset the file input
    event.target.value = null;
  }, []);

  // Reset exam function - clears all content and starts fresh
  const resetExam = useCallback(async () => {
    // Ask for confirmation before resetting
    if (!window.confirm('Are you sure you want to reset the exam? This will clear all content and cannot be undone.')) {
      return;
    }
    
    // Show a loading toast while resetting
    toast.loading('Resetting exam...');
    
    // Set resetting state to disable UI elements
    setSaving(true);
    
    try {
      // If we have a loadedExamId, it means the exam exists in the database
      // and we need to delete it from there
      if (loadedExamId) {
        await apiRequest(
          `${API_BASE_URL}/exams/${loadedExamId}`,
          'DELETE'
        );
        
        // After successfully deleting, refresh the exams list
        await fetchExams();
      }
      
      // Clear all exam data
      setExamTitle('');
      setExamDescription('');
      setExamDueDate('');
      setQuestions([]);
      setSelectedQuestionId(null);
      setLoadedExamId(null);
      setIsPublished(false);
      
      // Reset the question form
      setCurrentQuestion({
        type: 'mcq',
        question: '',
        options: ['', '', '', ''],
        correctAnswerIndex: null,
        allowMultipleAnswers: false,
        correctAnswerIndices: [],
        correctAnswerList: [],
        points: 1
      });
      
      // Clear URL parameters for examId
      const params = new URLSearchParams(location.search);
      if (params.has('examId')) {
        params.delete('examId');
        navigate(`${location.pathname}?${params.toString()}`, { replace: true });
      }
      
      // Force a re-render after state updates with a slight delay
      setTimeout(() => {
        // This additional state update helps ensure the UI refreshes
        setQuestions([]); // Redundant set to trigger re-render
        
        // Increment the reset key to force a complete component re-render
        setResetKey(prevKey => prevKey + 1);
        
        // Dismiss the loading toast
        toast.dismiss();
        
        // Show success message
        toast.success('Exam has been reset and deleted from the database');
        
        // Re-enable UI elements
        setSaving(false);
      }, 100);
    } catch (error) {
      console.error('Error resetting exam:', error);
      
      // Dismiss the loading toast
      toast.dismiss();
      
      // Show error message
      toast.error(`Failed to reset exam: ${error.message}`);
      
      // Re-enable UI elements
      setSaving(false);
    }
  }, [loadedExamId, apiRequest, fetchExams, location.pathname, location.search, navigate]);

  // Trigger file input click
  const triggerImportFileInput = useCallback(() => {
    document.getElementById('import-exam-file').click();
  }, []);

  // Function to parse exam data from HTML content
  const parseHtmlExam = (htmlContent) => {
    try {
      // Create a temporary DOM element to parse HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // Extract exam title from the document title or a specific element
      const title = doc.querySelector('title')?.textContent || 
                    doc.querySelector('h1')?.textContent || 
                    'Imported HTML Exam';
                    
      // Initialize empty exam structure
      const exam = {
        exam: {
          title: title,
          description: 'Imported from HTML file',
          questions: []
        },
        version: "1.0"
      };
      
      // Look for question containers
      const questionContainers = doc.querySelectorAll('.question, .exam-question, .test-question');
      
      if (questionContainers.length === 0) {
        // If no structured question containers, try to extract questions based on common patterns
        const possibleQuestions = extractQuestionsFromUnstructuredHTML(doc);
        if (possibleQuestions.length > 0) {
          exam.exam.questions = possibleQuestions;
        }
      } else {
        // Process structured question containers
        questionContainers.forEach((container, index) => {
          // Extract question text
          const questionText = container.querySelector('.question-text, .question-title, h3, h4')?.textContent?.trim() || 
                             `Question ${index + 1}`;
          
          // Try to determine question type
          let questionType = 'mcq'; // Default to multiple choice
          let options = [];
          let correctAnswer = '';
          
          // Look for options (multiple choice)
          const optionElements = container.querySelectorAll('.option, .answer, li');
          if (optionElements.length > 0) {
            optionElements.forEach(opt => {
              const optionText = opt.textContent.trim();
              options.push(optionText);
              
              // Try to detect correct answers (might be marked with a class or other indicator)
              if (opt.classList.contains('correct') || 
                  opt.querySelector('.correct') || 
                  opt.textContent.includes('(correct)') || 
                  opt.textContent.includes('✓')) {
                correctAnswer = optionText;
              }
            });
          } else {
            // If no options found, it might be an identification question
            questionType = 'identification';
            // Try to find the answer
            correctAnswer = container.querySelector('.answer, .correct-answer')?.textContent?.trim() || '';
          }
          
          // Add the question to our exam
          exam.exam.questions.push({
            question_text: questionText,
            type: questionType,
            options: options,
            correct_answer: correctAnswer,
            points: 1, // Default points
            allow_multiple_answers: false // Default to single answer
          });
        });
      }
      
      return exam;
    } catch (error) {
      console.error('Error parsing HTML exam:', error);
      throw new Error('Failed to parse HTML exam: ' + error.message);
    }
  };
  
  // Helper function to extract questions from unstructured HTML
  const extractQuestionsFromUnstructuredHTML = (doc) => {
    const questions = [];
    
    // Look for possible question elements (paragraphs or headers that look like questions)
    const allElements = doc.querySelectorAll('p, h2, h3, h4, h5, div');
    
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      const text = el.textContent.trim();
      
      // Skip empty or very short texts
      if (!text || text.length < 5) continue;
      
      // Check if this looks like a question (ends with ? or starts with number.)
      if (text.endsWith('?') || /^\d+\.\s/.test(text)) {
        // This might be a question
        const questionText = text;
        let options = [];
        let correctAnswer = '';
        let questionType = 'identification';
        
        // Look for possible options in the next few elements
        let j = i + 1;
        let optionFound = false;
        
        while (j < allElements.length && j < i + 8) { // Check up to 8 elements ahead
          const optEl = allElements[j];
          const optText = optEl.textContent.trim();
          
          // Check if this looks like an option (starts with a, b, c, A, B, C, or bullet)
          if (/^[a-z]\.|\([a-z]\)|\d\.|\(\d\)|\s*•|\s*-/.test(optText)) {
            if (!optionFound) {
              // First option found, switch to MCQ type
              questionType = 'mcq';
              optionFound = true;
            }
            
            options.push(optText.replace(/^[a-z]\.|\([a-z]\)|\d\.|\(\d\)|\s*•|\s*-\s*/, '').trim());
            
            // Check if this option is marked as correct
            if (optText.includes('(correct)') || optEl.classList.contains('correct')) {
              correctAnswer = options[options.length - 1];
            }
            
            j++;
          } else if (optionFound) {
            // If we've already found options but this isn't one, we're done with this question
            break;
          } else {
            // Not an option, check if it might be an answer for identification question
            if (optText.includes('Answer:') || optText.includes('answer:') || 
                optEl.classList.contains('answer')) {
              correctAnswer = optText.replace(/Answer:|\s+answer:\s+/i, '').trim();
              j++;
              break;
            }
            j++;
          }
        }
        
        questions.push({
          question_text: questionText,
          type: questionType,
          options: options,
          correct_answer: correctAnswer,
          points: 1,
          allow_multiple_answers: false
        });
        
        // Skip ahead to the last processed element
        i = j - 1;
      }
    }
    
    return questions;
  };

  const handleDownloadOfflineCreator = async () => {
    try {
      // Show loading toast
      toast.loading('Downloading offline exam creator...');

      // Fetch the HTML file
      const response = await fetch(`${API_BASE_URL}/offline/examcreation.html`);
      if (!response.ok) {
        throw new Error('Failed to download offline exam creator');
      }

      // Get the blob from the response
      const blob = await response.blob();

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'exam_creator_offline.html';

      // Trigger the download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success('Offline exam creator downloaded successfully!');
    } catch (error) {
      console.error('Error downloading offline exam creator:', error);
      toast.dismiss();
      toast.error('Failed to download offline exam creator. Please try again.');
    }
  };

  return (
    <div className="exam-builder-container" key={`exam-builder-${resetKey}`}>
      <h2>{loadedExamId ? `Edit Exam: ${examTitle}` : 'Create New Exam'}</h2>
      
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
      
      {/* Import/Export Actions */}
      <div className="import-export-actions">
        <button 
          className="export-btn"
          onClick={exportExam}
          disabled={!loadedExamId && questions.length === 0}
          title={!loadedExamId && questions.length === 0 ? 'Save exam first to enable export' : 'Export exam as JSON file'}
        >
          <FaDownload /> Export Exam
        </button>
        
        <button 
          className="import-btn"
          onClick={triggerImportFileInput}
          disabled={saving}
          title="Import exam from JSON or HTML file"
        >
          <FaUpload /> Import Exam
        </button>

        <button 
          className="offline-creator-btn"
          onClick={handleDownloadOfflineCreator}
          title="Download offline exam creator"
        >
          <FaFileDownload /> Download Offline Creator
        </button>
        
        <button 
          className="exam-reset-btn"
          onClick={resetExam}
          disabled={saving || (!loadedExamId && questions.length === 0 && !examTitle)}
          title="Reset and clear all exam content"
        >
          <FaTrash /> Reset Exam
        </button>
        
        {/* Hidden file input for JSON and HTML import */}
        <input
          type="file"
          id="import-exam-file"
          accept=".json,application/json,.html,text/html"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        {importError && (
          <div className="import-error">
            <p>{importError}</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .import-export-actions {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .import-export-actions button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 15px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .import-export-actions button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .export-btn {
          background-color: #4CAF50;
          color: white;
        }

        .import-btn {
          background-color: #2196F3;
          color: white;
        }

        .offline-creator-btn {
          background-color: #9C27B0;
          color: white;
        }

        .exam-reset-btn {
          background-color: #f44336;
          color: white;
        }

        .import-export-actions button:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .import-export-actions button svg {
          font-size: 1.1em;
        }
      `}</style>
      
      <div className="exam-builder-layout">
        {/* Left Column - Questions List */}
        <div className="questions-column">
          <div className="questions-list">
            <h3>Exam Questions {questions.length > 0 && `(${questions.length})`}</h3>
            {questions.length === 0 ? (
              <p className="no-questions">No questions added yet.</p>
            ) : (
              questions.map((q, index) => (
                <div 
                  key={q.id || `temp-${index}`} 
                  className={`question-item ${selectedQuestionId === q.id ? 'selected edit-mode' : ''}`}
                  onClick={() => handleSelectQuestion(q.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="question-header">
                    <span>Question {index + 1}</span>
                    <div>
                      <span className="question-type">{q.type.toUpperCase()}</span>
                      <span className="question-points">{q.points} pts</span>
                    </div>
                  </div>
                  <p className="question-text">{q.question.length > 100 ? q.question.substring(0, 100) + '...' : q.question}</p>
                  {!isPublished && isModificationAllowed && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteQuestion(q.id);
                      }}
                      disabled={saving}
                      className="delete-btn"
                    >
                      {saving ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                  {!isModificationAllowed && (
                    <div className="view-only-indicator-small">
                      View Only
                    </div>
                  )}
                </div>
              ))
            )}
            
            {/* Exam Actions */}
            {loadedExamId && (
              <div className="exam-actions">
                <button 
                  className={`publish-btn ${isPublished ? 'unpublish' : ''}`}
                  onClick={togglePublishStatus}
                  disabled={saving || questions.length === 0 || !isModificationAllowed}
                  title={!isModificationAllowed ? `Publishing is disabled in ${courseStatus} courses` : ''}
                >
                  {saving ? 'Processing...' : isPublished ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleDownloadOfflineCreator}
                  title="Download offline exam creator"
                >
                  <i className="fas fa-download"></i> Download Offline Creator
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Right Column - Exam Form */}
        <div className="form-column">
          {/* Exam Details Form */}
          <div className="exam-details">
            <h3>{loadedExamId ? 'Edit Exam Details' : 'Create New Exam'}</h3>
            
            {loadedExamId && (
              <div className="success-message">
                <p>Exam ID: {loadedExamId}</p>
              </div>
            )}
            
            <div className="form-group">
              <label>Title: <span className="required">*</span></label>
              <input
                type="text"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="Enter exam title"
                disabled={isPublished || saving || !isModificationAllowed}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Description:</label>
              <textarea
                value={examDescription}
                onChange={(e) => setExamDescription(e.target.value)}
                placeholder="Enter exam description (optional)"
                disabled={isPublished || saving || !isModificationAllowed}
              />
            </div>
            
            <div className="form-group">
              <label>Due Date:</label>
              <input
                type="datetime-local"
                value={examDueDate}
                onChange={(e) => setExamDueDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                disabled={isPublished || saving || !isModificationAllowed}
              />
              <small style={{ color: 'var(--nova-color-gray-600)', fontSize: 'var(--nova-font-size-xs)', marginTop: '4px', display: 'block' }}>
                Students won't be able to access the exam after this date and time
              </small>
            </div>
            
            <div className="exam-actions">
              {!loadedExamId && isModificationAllowed && (
                <button 
                  className="save-btn create-exam-btn"
                  onClick={createExam}
                  disabled={saving || !examTitle.trim()}
                >
                  {saving ? 'Creating...' : 'Create Exam'}
                </button>
              )}
              
              {loadedExamId && isModificationAllowed && (
                <button 
                  className="save-btn"
                  onClick={updateExam}
                  disabled={saving || isPublished || !examTitle.trim()}
                >
                  {saving ? 'Saving...' : 'Update Exam'}
                </button>
              )}
              
              {!isModificationAllowed && (
                <div className="disabled-form-notice">
                  <p>
                    {isViewOnly 
                      ? "Exam editing is disabled in archived courses."
                      : "Exam editing is disabled in inactive courses."
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Question Form - Only show if exam is not published and modifications are allowed */}
          {(!isPublished && isModificationAllowed) && (
            <div className="question-form">
              <h3>{selectedQuestionId ? 'Edit Question' : 'Add New Question'}</h3>
              
              {!loadedExamId && !selectedQuestionId && (
                <div className="info-message">
                  <p>Enter exam details above and create an exam first, or a new exam will be automatically created when you add a question.</p>
                </div>
              )}
              
              {selectedQuestionId && (
                <div className="info-message" style={{ backgroundColor: '#e7f3fe', borderLeft: '6px solid #2196F3' }}>
                  <p>You are editing an existing question (ID: {selectedQuestionId})</p>
                </div>
              )}
              
              <div className="question-type-selector">
                <button 
                  className={currentQuestion.type === 'mcq' ? 'active' : ''}
                  onClick={() => handleQuestionTypeChange('mcq')}
                  disabled={saving}
                >
                  Multiple Choice
                </button>
                <button 
                  className={currentQuestion.type === 'identification' ? 'active' : ''}
                  onClick={() => handleQuestionTypeChange('identification')}
                  disabled={saving}
                >
                  Identification
                </button>
              </div>

              <div className="question-input">
                <textarea
                  placeholder="Enter your question"
                  value={currentQuestion.question}
                  onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
                  disabled={saving}
                />
              </div>

              {currentQuestion.type === 'mcq' && (
                <>
                  <div className="multiple-answer-toggle">
                    <span className="toggle-label">Allow multiple correct answers:</span>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={currentQuestion.allowMultipleAnswers}
                        onChange={handleMultipleAnswersToggle}
                        disabled={saving}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  
                  <div className="mcq-options">
                    {currentQuestion.options.map((option, index) => (
                      <div key={index} className="option-input">
                        <input
                          type="text"
                          placeholder={`Option ${index + 1}`}
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          disabled={saving}
                        />
                        
                        {/* Show checkbox or radio button based on multiple answers setting */}
                        {currentQuestion.allowMultipleAnswers ? (
                          <input
                            type="checkbox"
                            className="checkbox-input"
                            checked={currentQuestion.correctAnswerIndices.includes(index)}
                            onChange={() => handleCorrectAnswerToggle(index)}
                            disabled={saving}
                          />
                        ) : (
                          <input
                            type="radio"
                            name="correctAnswer"
                            checked={currentQuestion.correctAnswerIndex === index}
                            onChange={() => setCurrentQuestion({ ...currentQuestion, correctAnswerIndex: index })}
                            disabled={saving}
                          />
                        )}
                        
                        <label>Correct Answer</label>
                        {currentQuestion.options.length > 2 && (
                          <button 
                            className="remove-option-btn"
                            onClick={() => handleRemoveOption(index)}
                            title="Remove option"
                            disabled={saving}
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    ))}
                    
                    <button 
                      className="add-option-btn"
                      onClick={handleAddOption}
                      type="button"
                      disabled={saving}
                    >
                      + Add Option
                    </button>
                  </div>
                </>
              )}

              {currentQuestion.type === 'identification' && (
                <div className="identification-answer">
                  <div className="multiple-answer-toggle">
                    <span className="toggle-label">Allow multiple correct answers:</span>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={currentQuestion.allowMultipleAnswers}
                        onChange={handleMultipleAnswersToggle}
                        disabled={saving}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  
                  {!currentQuestion.allowMultipleAnswers ? (
                    <input
                      type="text"
                      placeholder="Enter the correct answer"
                      value={currentQuestion.correctAnswer || ''}
                      onChange={(e) => setCurrentQuestion({ ...currentQuestion, correctAnswer: e.target.value })}
                      disabled={saving}
                    />
                  ) : (
                    <div className="multiple-identification-answers">
                      {Array.isArray(currentQuestion.correctAnswerList) ? 
                        currentQuestion.correctAnswerList.map((answer, index) => (
                          <div key={index} className="multiple-answer-item">
                            <input
                              type="text"
                              placeholder={`Correct answer ${index + 1}`}
                              value={answer || ''}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                // Check for duplicates
                                const isDuplicate = newValue.trim() !== '' && 
                                  currentQuestion.correctAnswerList.some((answer, i) => 
                                    i !== index && answer.trim() === newValue.trim()
                                  );
                                
                                if (isDuplicate) {
                                  toast.error('Duplicate answers are not allowed');
                                  return;
                                }
                                
                                const newAnswers = [...currentQuestion.correctAnswerList];
                                newAnswers[index] = newValue;
                                setCurrentQuestion({ ...currentQuestion, correctAnswerList: newAnswers });
                              }}
                              disabled={saving}
                            />
                            {currentQuestion.correctAnswerList.length > 1 && (
                              <button 
                                className="remove-option-btn"
                                onClick={() => {
                                  const newAnswers = currentQuestion.correctAnswerList.filter((_, i) => i !== index);
                                  setCurrentQuestion({ ...currentQuestion, correctAnswerList: newAnswers });
                                }}
                                title="Remove answer"
                                disabled={saving}
                              >
                                <FaTrash />
                              </button>
                            )}
                          </div>
                        )) : (
                          <div className="multiple-answer-item">
                            <input
                              type="text"
                              placeholder="Correct answer 1"
                              value=""
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setCurrentQuestion({ ...currentQuestion, correctAnswerList: [newValue] });
                              }}
                              disabled={saving}
                            />
                          </div>
                        )
                      }
                      <button 
                        className="add-option-btn"
                        onClick={() => {
                          const newAnswers = Array.isArray(currentQuestion.correctAnswerList) ? 
                            [...currentQuestion.correctAnswerList, ''] : [''];
                          setCurrentQuestion({ ...currentQuestion, correctAnswerList: newAnswers });
                        }}
                        type="button"
                        disabled={saving}
                      >
                        + Add Answer
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="points-input">
                <label>Points:</label>
                <input
                  type="number"
                  min="1"
                  value={currentQuestion.points}
                  onChange={(e) => setCurrentQuestion({ ...currentQuestion, points: parseInt(e.target.value) || 1 })}
                  disabled={saving}
                />
              </div>

              <div className="form-actions">
                <button 
                  className="add-question-btn" 
                  onClick={handleAddQuestion}
                  disabled={saving || !currentQuestion.question.trim()}
                >
                  {saving ? 'Saving...' : selectedQuestionId ? 'Update Question' : loadedExamId ? 'Add Question' : 'Create Exam & Add Question'}
                </button>
                
                {selectedQuestionId && (
                  <button 
                    className="cancel-btn" 
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Show read-only notice if published or not allowed to modify */}
          {(isPublished || !isModificationAllowed) && questions.length > 0 && (
            <div className="read-only-notice">
              <h3>
                {isPublished ? 'Published Exam Preview' : 
                 isViewOnly ? 'Exam Content (Archived Course)' : 'Exam Content (Inactive Course)'}
              </h3>
              <p>
                {isPublished 
                  ? "This exam is published. Questions cannot be modified."
                  : isViewOnly
                    ? "This course is archived. Questions are in view-only mode."
                    : "This course is inactive. Questions cannot be modified."
                }
              </p>
              
              {/* Show selected question details if one is selected */}
              {selectedQuestionId && (
                <div className="selected-question-details">
                  {(() => {
                    const selectedQ = questions.find(q => q.id === selectedQuestionId);
                    if (!selectedQ) return null;
                    
                    return (
                      <div className="selected-question-preview">
                        <h4>Selected Question Details</h4>
                        <div className="question-detail-card">
                          <div className="question-detail-header">
                            <span className="question-type-badge">{selectedQ.type.toUpperCase()}</span>
                            <span className="question-points-badge">{selectedQ.points} pts</span>
                          </div>
                          <div className="question-detail-text">
                            <strong>Question:</strong> {selectedQ.question}
                          </div>
                          
                          {/* Show MCQ options and correct answers */}
                          {selectedQ.type === 'mcq' && selectedQ.options && (
                            <div className="question-detail-options">
                              <strong>Options:</strong>
                              <ul className="detailed-options-list">
                                {selectedQ.options.map((option, optIndex) => {
                                  const correctAnswers = Array.isArray(selectedQ.correctAnswer) ? selectedQ.correctAnswer : [selectedQ.correctAnswer];
                                  
                                  // Clean up correct answers for comparison
                                  const cleanedCorrectAnswers = correctAnswers.map(answer => 
                                    typeof answer === 'string' ? answer.replace(/^["'{]+|[}"']+$/g, '').trim() : answer
                                  );
                                  
                                  const isCorrect = cleanedCorrectAnswers.some(answer => 
                                    typeof answer === 'string' && typeof option === 'string' 
                                      ? answer.toLowerCase().trim() === option.toLowerCase().trim()
                                      : answer === option
                                  );
                                  
                                  return (
                                    <li key={optIndex} className={`detailed-option ${isCorrect ? 'correct-option' : ''}`}>
                                      <span className="option-letter">{String.fromCharCode(65 + optIndex)}.</span>
                                      <span className="option-text">{option}</span>
                                      {isCorrect && <span className="correct-badge">✓ Correct</span>}
                                    </li>
                                  );
                                })}
                              </ul>
                              {Array.isArray(selectedQ.correctAnswer) && selectedQ.correctAnswer.length > 1 && (
                                <div className="multiple-correct-note">
                                  <em>Multiple correct answers allowed - students must select all correct options and no incorrect options to receive full credit.</em>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Show identification correct answers */}
                          {selectedQ.type === 'identification' && (
                            <div className="question-detail-answer">
                              <strong>Correct Answer{Array.isArray(selectedQ.correctAnswer) && selectedQ.correctAnswer.length > 1 ? 's' : ''}:</strong>
                              <div className="correct-answers-display">
                                {Array.isArray(selectedQ.correctAnswer) 
                                  ? selectedQ.correctAnswer.map((answer, idx) => (
                                      <span key={idx} className="answer-tag">
                                        {typeof answer === 'string' ? answer.replace(/^["'{]+|[}"']+$/g, '').trim() : answer}
                                      </span>
                                    ))
                                  : <span className="answer-tag">
                                      {typeof selectedQ.correctAnswer === 'string' 
                                        ? selectedQ.correctAnswer.replace(/^["'{]+|[}"']+$/g, '').trim() 
                                        : selectedQ.correctAnswer}
                                    </span>
                                }
                              </div>
                              {Array.isArray(selectedQ.correctAnswer) && selectedQ.correctAnswer.length > 1 && (
                                <div className="multiple-correct-note">
                                  <em>Multiple correct answers allowed - students must select all correct options and no incorrect options to receive full credit.</em>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              
              <div className="questions-preview">
                <h4>All Questions Overview</h4>
                {questions.map((q, index) => (
                  <div key={q.id} className="question-preview-item">
                    <div className="question-preview-header">
                      <span>Question {index + 1} ({q.type.toUpperCase()})</span>
                      <span>{q.points} pts</span>
                    </div>
                    <p className="question-preview-text">{q.question}</p>
                    
                    {/* Show options for MCQ */}
                    {q.type === 'mcq' && q.options && (
                      <div className="options-preview-section">
                        <h5>Options:</h5>
                        <ul className="options-preview">
                          {q.options.map((option, optIndex) => {
                            // Determine if this option is correct
                            const correctAnswers = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
                            
                            // Clean up correct answers for comparison
                            const cleanedCorrectAnswers = correctAnswers.map(answer => 
                              typeof answer === 'string' ? answer.replace(/^["'{]+|[}"']+$/g, '').trim() : answer
                            );
                            
                            // Check if this option matches any of the correct answers
                            const isCorrect = cleanedCorrectAnswers.some(answer => 
                              typeof answer === 'string' && typeof option === 'string' 
                                ? answer.toLowerCase().trim() === option.toLowerCase().trim()
                                : answer === option
                            );
                            
                            return (
                              <li key={optIndex} className={`option-preview-item ${isCorrect ? 'correct-option' : ''}`}>
                                {option}
                                {isCorrect && <span className="correct-indicator"> ✓ Correct</span>}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    
                    {/* Show correct answer for identification */}
                    {q.type === 'identification' && (
                      <div className="correct-answer-preview">
                        <h5>Correct Answer{Array.isArray(q.correctAnswer) && q.correctAnswer.length > 1 ? 's' : ''}:</h5>
                        <div className="correct-answer-text">
                          {Array.isArray(q.correctAnswer) 
                            ? q.correctAnswer.map(answer => 
                                typeof answer === 'string' 
                                  ? answer.replace(/^["'{]+|[}"']+$/g, '').trim() 
                                  : answer
                              ).join(', ') 
                            : typeof q.correctAnswer === 'string'
                              ? q.correctAnswer.replace(/^["'{]+|[}"']+$/g, '').trim()
                              : q.correctAnswer}
                        </div>
                        {Array.isArray(q.correctAnswer) && q.correctAnswer.length > 1 && (
                          <small className="multiple-answers-note">
                            (Students need to provide any one of these answers)
                          </small>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Show empty state message if no questions and can't modify */}
          {!isModificationAllowed && questions.length === 0 && (
            <div className="read-only-notice">
              <h3>No Questions Found</h3>
              <p>
                {isViewOnly
                  ? "This exam has no questions or they couldn't be loaded."
                  : "This exam has no questions or they couldn't be loaded."
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamBuilderComponent; 