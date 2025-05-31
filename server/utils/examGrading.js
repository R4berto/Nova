/**
 * Utility functions for exam grading
 */

// Function to check if an answer is in PostgreSQL array format
const isPostgresArray = (str) => {
  return typeof str === 'string' && str.startsWith('{') && str.endsWith('}');
};

// Function to parse a PostgreSQL array string into a JavaScript array
const parsePostgresArray = (pgArray) => {
  if (!isPostgresArray(pgArray)) {
    return Array.isArray(pgArray) ? pgArray : [pgArray];
  }
  
  try {
    // Parse PostgreSQL array format: {"value1","value2","value3"}
    return pgArray
      .substring(1, pgArray.length - 1)
      .split(',')
      .map(item => item.trim().replace(/^"(.*)"$/, '$1'));
  } catch (err) {
    console.error("Error parsing PostgreSQL array:", err);
    return [];
  }
};

// Main grading function for any question type
const gradeAnswer = (question, studentAnswer) => {
  // Default result if grading fails
  const defaultResult = {
    is_correct: false,
    points_earned: 0
  };

  // Handle missing inputs
  if (!question || studentAnswer === undefined) {
    console.log("DEBUG: Missing input - question or studentAnswer is undefined");
    return defaultResult;
  }

  const { type, correct_answer, points } = question;
  console.log(`DEBUG: Grading question type: ${type}, points: ${points}`);
  console.log(`DEBUG: Correct answer (raw): ${JSON.stringify(correct_answer)}`);
  console.log(`DEBUG: Student answer (raw): ${JSON.stringify(studentAnswer)}`);

  // For identification questions
  if (type === 'identification') {
    // Check if correct_answer is an array (multiple correct answers)
    if (isPostgresArray(correct_answer)) {
      // Parse the array of correct answers
      const correctAnswers = parsePostgresArray(correct_answer);
      const studentAnswerLower = (studentAnswer || '').toString().toLowerCase().trim();
      
      // Check if student's answer matches any of the correct answers
      const isCorrect = correctAnswers.some(answer => 
        (answer || '').toString().toLowerCase().trim() === studentAnswerLower
      );
      
      console.log(`DEBUG: Identification (multiple answers) - correct options: ${JSON.stringify(correctAnswers)}`);
      console.log(`DEBUG: Student answer: "${studentAnswerLower}", isCorrect: ${isCorrect}`);
      
      return {
        is_correct: isCorrect,
        points_earned: isCorrect ? points : 0
      };
    }
    
    // Single correct answer - compare case-insensitively
    const correctAnswerLower = (correct_answer || '').toString().toLowerCase().trim();
    const studentAnswerLower = (studentAnswer || '').toString().toLowerCase().trim();
    
    const isCorrect = correctAnswerLower === studentAnswerLower;
    console.log(`DEBUG: Identification - correct: "${correctAnswerLower}", student: "${studentAnswerLower}", isCorrect: ${isCorrect}`);
    
    return {
      is_correct: isCorrect,
      points_earned: isCorrect ? points : 0
    };
  } 
  
  // For multiple-choice questions
  else if (type === 'multiple choice' || type === 'mcq') {
    console.log(`DEBUG: Handling MCQ type: ${type}`);
    
    // Convert student answers to array for consistent processing
    const studentAnswers = Array.isArray(studentAnswer) 
      ? studentAnswer
      : typeof studentAnswer === 'string' && studentAnswer.includes(',') 
        ? studentAnswer.split(',').map(a => a.trim()) 
        : typeof studentAnswer === 'string' && studentAnswer !== ''
          ? [studentAnswer]
          : [];

    console.log(`DEBUG: Student answers after formatting: ${JSON.stringify(studentAnswers)}`);
    
    // Parse correct answers (handle PostgreSQL array format)
    let correctAnswers = parsePostgresArray(correct_answer);
    console.log(`DEBUG: Correct answers (processed): ${JSON.stringify(correctAnswers)}`);
    console.log(`DEBUG: Question has multiple answers: ${correctAnswers.length > 1}`);
    console.log(`DEBUG: Question options: ${JSON.stringify(question.options)}`);

    // Handle multiple correct answers scenario
    if (correctAnswers.length > 1) {
      // Check if the student selected at least one correct answer
      // AND hasn't selected any incorrect answers
      let hasAtLeastOneCorrect = false;
      let hasSelectedIncorrectOption = false;
      
      // Process each student answer
      for (const answer of studentAnswers) {
        console.log(`DEBUG: Checking student answer: ${answer}`);
        
        // If student selected an option by index, check if it's in the correct answers
        if (question.options && !isNaN(parseInt(answer, 10))) {
          const selectedIndex = parseInt(answer, 10);
          
          // Check bounds to avoid undefined
          if (selectedIndex >= 0 && selectedIndex < question.options.length) {
            const selectedOption = question.options[selectedIndex];
            console.log(`DEBUG: Student selected option by index ${answer}, which is: ${selectedOption}`);
            
            if (correctAnswers.includes(selectedOption)) {
              hasAtLeastOneCorrect = true;
              console.log(`DEBUG: Found match by option: ${selectedOption}`);
            } else {
              // Selected an incorrect option
              hasSelectedIncorrectOption = true;
              console.log(`DEBUG: Selected incorrect option: ${selectedOption}`);
            }
          }
        } 
        // Direct comparison if answer isn't an index
        else {
          if (correctAnswers.includes(answer)) {
            hasAtLeastOneCorrect = true;
            console.log(`DEBUG: Found direct match: ${answer}`);
          } else {
            hasSelectedIncorrectOption = true;
            console.log(`DEBUG: Selected incorrect option: ${answer}`);
          }
        }
      }

      // The answer is correct if the student selected at least one correct option
      // AND hasn't selected any incorrect options
      const isCorrect = hasAtLeastOneCorrect && !hasSelectedIncorrectOption;
      console.log(`DEBUG: Multiple answers - hasAtLeastOneCorrect: ${hasAtLeastOneCorrect}, hasSelectedIncorrectOption: ${hasSelectedIncorrectOption}, isCorrect: ${isCorrect}`);
      
      // Award full points if the answer is correct
      return {
        is_correct: isCorrect,
        points_earned: isCorrect ? points : 0
      };
    } 
    // Single-answer multiple-choice question
    else {
      // For single-answer MCQ, the student should select the exact correct option
      const isCorrect = studentAnswers.length === 1 && correctAnswers.includes(studentAnswers[0]);
      console.log(`DEBUG: Single answer - direct comparison result: ${isCorrect}`);
      
      // If the student selected an option by index
      if (question.options && studentAnswers.length === 1 && !isNaN(parseInt(studentAnswers[0], 10))) {
        const selectedIndex = parseInt(studentAnswers[0], 10);
        console.log(`DEBUG: Student selected option by index: ${selectedIndex}`);
        
        // Check bounds to avoid undefined
        if (selectedIndex >= 0 && selectedIndex < question.options.length) {
          const selectedOption = question.options[selectedIndex];
          console.log(`DEBUG: Selected option text: "${selectedOption}"`);
          console.log(`DEBUG: Comparing with correct answers: ${JSON.stringify(correctAnswers)}`);
          
          const isCorrectByIndex = correctAnswers.includes(selectedOption);
          console.log(`DEBUG: Option match result: ${isCorrectByIndex}`);
          
          return {
            is_correct: isCorrectByIndex,
            points_earned: isCorrectByIndex ? points : 0
          };
        } else {
          console.log(`DEBUG: Selected index ${selectedIndex} is out of bounds for options array length ${question.options.length}`);
        }
      }
      
      return {
        is_correct: isCorrect,
        points_earned: isCorrect ? points : 0
      };
    }
  }

  console.log(`DEBUG: Unknown question type: ${type}`);
  // Default fallback
  return defaultResult;
};

module.exports = {
  gradeAnswer,
  parsePostgresArray,
  isPostgresArray
}; 