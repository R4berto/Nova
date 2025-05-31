/**
 * Test script for exam grading functionality
 * Run with: node examGrading.test.js
 */

const { gradeAnswer, parsePostgresArray } = require('../utils/examGrading');

// Test cases for parsePostgresArray
console.log('\n--- Testing parsePostgresArray ---');

const testArrays = [
  { input: '{"tet","23","3"}', expected: ['tet', '23', '3'] },
  { input: '{"option 1","option 2"}', expected: ['option 1', 'option 2'] },
  { input: '{}', expected: [] },
  { input: 'single value', expected: ['single value'] },
  { input: ['array', 'value'], expected: ['array', 'value'] }
];

testArrays.forEach((test, index) => {
  const result = parsePostgresArray(test.input);
  const passed = JSON.stringify(result) === JSON.stringify(test.expected);
  console.log(`Test ${index + 1}: ${passed ? 'PASSED' : 'FAILED'}`);
  console.log(`  Input: ${JSON.stringify(test.input)}`);
  console.log(`  Expected: ${JSON.stringify(test.expected)}`);
  console.log(`  Actual: ${JSON.stringify(result)}`);
});

// Test cases for gradeAnswer
console.log('\n--- Testing gradeAnswer ---');

const testCases = [
  // Test case 1: Multiple choice with multiple correct answers - student selects one correct answer
  {
    name: 'Multiple choice with multiple answers - student selects one correct answer',
    question: {
      type: 'multiple choice',
      options: ['tet', '23', '3', '4'],
      correct_answer: '{"tet","23","3"}',
      points: 1
    },
    studentAnswer: '0', // Selected "tet" (index 0)
    expected: { is_correct: true, points_earned: 1 }
  },
  
  // Test case 2: Multiple choice with multiple correct answers - student selects wrong answer
  {
    name: 'Multiple choice with multiple answers - student selects wrong answer',
    question: {
      type: 'multiple choice',
      options: ['tet', '23', '3', '4'],
      correct_answer: '{"tet","23","3"}',
      points: 1
    },
    studentAnswer: '3', // Selected "4" (index 3)
    expected: { is_correct: false, points_earned: 0 }
  },
  
  // Test case 3: Multiple choice with single correct answer
  {
    name: 'Multiple choice with single correct answer',
    question: {
      type: 'multiple choice',
      options: ['tet', '23', '3', '4'],
      correct_answer: 'tet',
      points: 1
    },
    studentAnswer: '0', // Selected "tet" (index 0)
    expected: { is_correct: true, points_earned: 1 }
  },
  
  // Test case 4: Identification question
  {
    name: 'Identification question - exact match',
    question: {
      type: 'identification',
      correct_answer: 'answer',
      points: 1
    },
    studentAnswer: 'answer',
    expected: { is_correct: true, points_earned: 1 }
  },
  
  // Test case 5: Identification question - case insensitive
  {
    name: 'Identification question - case insensitive',
    question: {
      type: 'identification',
      correct_answer: 'Answer',
      points: 1
    },
    studentAnswer: 'answer',
    expected: { is_correct: true, points_earned: 1 }
  },
  
  // Test case 6: Identification with multiple correct answers - correct answer
  {
    name: 'Identification with multiple answers - correct answer',
    question: {
      type: 'identification',
      correct_answer: '{"sdasd1","sdasd2","sdasd3"}',
      points: 1
    },
    studentAnswer: 'sdasd3',
    expected: { is_correct: true, points_earned: 1 }
  },
  
  // Test case 7: Identification with multiple correct answers - incorrect answer
  {
    name: 'Identification with multiple answers - incorrect answer',
    question: {
      type: 'identification',
      correct_answer: '{"sdasd1","sdasd2","sdasd3"}',
      points: 1
    },
    studentAnswer: 'sdasd4',
    expected: { is_correct: false, points_earned: 0 }
  }
];

testCases.forEach((test, index) => {
  const result = gradeAnswer(test.question, test.studentAnswer);
  const passed = 
    result.is_correct === test.expected.is_correct && 
    result.points_earned === test.expected.points_earned;
    
  console.log(`Test ${index + 1} (${test.name}): ${passed ? 'PASSED' : 'FAILED'}`);
  if (!passed) {
    console.log(`  Expected: ${JSON.stringify(test.expected)}`);
    console.log(`  Actual: ${JSON.stringify(result)}`);
  }
});

console.log('\nTests completed!'); 