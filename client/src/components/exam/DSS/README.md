# Exam Decision Support System (DSS)

This directory contains components for the Exam Decision Support System, which provides professors with analytics and insights about student performance.

## Features

### 1. Predictive Analytics
- Predicts student performance on exams based on past data
- Shows risk levels for each student
- Provides detailed metrics on past performance, assignment completion, and engagement

### 2. Early Warning System
- Identifies at-risk students who may struggle with exams
- Shows specific warning flags for each student
- Displays upcoming exams and deadlines

### 3. Student Rankings
- Provides detailed rankings for completed exams
- Shows statistics like highest score, average score, and percentiles
- Helps identify top performers and students who may need additional support

## Usage

The DSS is accessible through the "Analytics" tab in the exam interface, which is only visible to professors. The system uses data from:

- Past exam submissions
- Assignment performance
- Student engagement metrics
- Course activity

## API Endpoints

The frontend components connect to these backend endpoints:

- `GET /dss/exams/predict/:examId` - Gets predictions for student performance
- `GET /dss/exams/warnings/:courseId` - Gets early warnings for at-risk students
- `GET /dss/exams/rankings/:examId` - Gets rankings for completed exams

## Components

- `ExamAnalytics.js` - Main component with tabs for different analytics views
- `ExamAnalytics.css` - Styles for the analytics interface

## Data Collection

The system automatically collects student activity data through:

- Exam starts and submissions
- Assignment interactions
- Course engagement

This data is stored in the `student_activity` table and used to generate predictions and insights. 