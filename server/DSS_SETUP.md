# Decision Support System (DSS) Setup Guide

This document explains how to set up and use the new Decision Support System for exams.

## Overview

The Decision Support System provides professors with tools to:

1. **Predictive Analytics**: Predict student performance on exams based on past data
2. **Early Warning System**: Identify at-risk students who may struggle with exams
3. **Student Rankings**: View and analyze student performance rankings for exams

## Setup Instructions

### 1. Database Setup

First, you need to create the student_activity table that tracks student engagement:

```bash
cd server
node scripts/migrate-student-activity.js
```

### 2. API Endpoints

The DSS system exposes the following endpoints for professors:

#### Predictive Analytics
- **GET /dss/exams/predict/:examId** - Gets predictions for student performance on a specific exam

#### Early Warning System
- **GET /dss/exams/warnings/:courseId** - Gets warnings about at-risk students in a course

#### Student Rankings
- **GET /dss/exams/rankings/:examId** - Gets rankings and statistics for a completed exam

### 3. Access Control

- All DSS features are restricted to professors only
- Each professor can only access data for their own courses and exams
- Student information is properly secured

## Using the DSS

### Predictive Analytics

For any exam, professors can view predicted student performance:

```javascript
// Example request
fetch(`/dss/exams/predict/${examId}`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'token': yourJwtToken
  }
})
.then(response => response.json())
.then(data => {
  // Process predictions
  console.log(data.predictions);
});
```

The response includes:
- Predicted scores for each student
- Risk level assessments (High, Moderate, Low)
- Past performance metrics
- Assignment completion data
- Engagement metrics

### Early Warning System

Identify students who may need intervention before exams:

```javascript
// Example request
fetch(`/dss/exams/warnings/${courseId}`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'token': yourJwtToken
  }
})
.then(response => response.json())
.then(data => {
  // Process warnings
  console.log(data.at_risk_students);
});
```

The response includes:
- List of at-risk students
- Specific warning flags for each student
- Detailed metrics explaining risk factors
- Upcoming exam information

### Student Rankings

After an exam is completed and graded, view detailed rankings:

```javascript
// Example request
fetch(`/dss/exams/rankings/${examId}`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'token': yourJwtToken
  }
})
.then(response => response.json())
.then(data => {
  // Process rankings
  console.log(data.rankings);
  console.log(data.statistics);
});
```

The response includes:
- Ranked list of all student submissions
- Percentile information for each student
- Detailed statistics (highest, lowest, average scores)
- Overall exam metrics

## Activity Tracking

The DSS automatically tracks student activities to improve predictions. Activities tracked include:
- Exam starts and submissions
- Assignment views and submissions
- Resource access
- Discussion participation
- Login frequency

## Security Considerations

- All DSS data is protected by JWT authentication
- Role-based access control ensures only professors can access analytics
- Student privacy is maintained by restricting access to authorized professors only
- No DSS features are exposed to student users

## Troubleshooting

### Common Issues

1. **Missing Data**: If predictions seem incomplete, ensure students have sufficient activity history
2. **Permission Errors**: Verify the professor has proper access to the course
3. **Empty Rankings**: Make sure exams have been graded before requesting rankings

### Detailed Logs

For more detailed logs, set the environment variable:
```
DEBUG=dss:*
```

This will output detailed DSS operations in the server logs. 