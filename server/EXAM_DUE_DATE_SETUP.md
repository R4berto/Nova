# Exam Due Date Feature Setup

This document explains how to set up and use the new exam due date functionality.

## Database Migration

Before using the due date feature, you need to run the database migration to add the `due_date` column to the exam table.

### Option 1: Run the migration script
```bash
cd server
node scripts/migrate-exam-due-date.js
```

### Option 2: Run the SQL directly
```bash
cd server
psql -d your_database_name -f database/add_exam_due_date.sql
```

## Features Added

### 1. Database Changes
- **New Column**: `due_date TIMESTAMP WITH TIME ZONE` in the `exam` table
- **Index**: Optimized queries for due date filtering
- **Documentation**: Column comments explaining the feature

### 2. Backend API Updates

#### Exam Routes (`/exams`)
- **Create Exam**: `POST /:courseId` now accepts `due_date` parameter
- **Update Exam**: `PUT /:examId` now accepts `due_date` parameter
- **Validation**: Ensures due dates are in the future

#### Student Exam Routes (`/student-exams`)
- **Start Exam**: Checks if exam is past due before allowing access
- **Save Answer**: Prevents saving answers to overdue exams
- **Submit Exam**: Prevents submission of overdue exams
- **Get Available**: Includes due date information in response

### 3. Utility Functions (`utils/examUtils.js`)
- `isExamPastDue(exam)`: Check if an exam is overdue
- `isValidDueDate(dueDate)`: Validate due date is in the future
- `formatDueDate(dueDate)`: Format due date for display
- `getTimeRemaining(dueDate)`: Calculate time remaining until due

### 4. Middleware (`middleware/examDueDateCheck.js`)
- `checkExamDueDate`: Automatically validates exam access based on due date
- `checkSubmissionDueDate`: Validates submission access based on due date

## API Usage Examples

### Creating an Exam with Due Date
```javascript
POST /exams/123
{
  "title": "Midterm Exam",
  "description": "Chapter 1-5 material",
  "due_date": "2024-12-31T23:59:59.000Z"
}
```

### Updating Exam Due Date
```javascript
PUT /exams/456
{
  "title": "Midterm Exam",
  "description": "Chapter 1-5 material",
  "due_date": "2024-12-31T23:59:59.000Z"
}
```

### Error Responses
When an exam is past due, the API returns:
```javascript
{
  "error": "This exam is past its due date and can no longer be accessed.",
  "due_date": "2024-12-31T23:59:59.000Z",
  "exam_id": 456
}
```

## Frontend Integration

The frontend components have been updated to:
1. **Display due dates** with clear visual indicators
2. **Prevent access** to overdue exams
3. **Show countdown timers** for upcoming deadlines
4. **Style overdue exams** with muted colors and disabled interactions

### Key Frontend Features
- Due date input field in exam builder
- Visual indicators for overdue exams
- Automatic blocking of overdue exam access
- Countdown displays for time-sensitive exams

## Configuration

### Environment Variables
No additional environment variables are required.

### Database Configuration
The migration is safe to run multiple times and will only add the column if it doesn't exist.

## Testing

### Test Due Date Functionality
1. Create an exam with a due date in the future
2. Create an exam with a due date in the past (should fail validation)
3. Try to access an overdue exam as a student (should be blocked)
4. Verify professors can still access overdue exams

### Sample Test Data
```sql
-- Create a test exam with future due date
INSERT INTO exam (course_id, author_id, title, description, due_date, is_published)
VALUES (1, 'your-professor-id', 'Test Exam', 'Test Description', '2024-12-31 23:59:59+00', true);

-- Create a test exam with past due date
INSERT INTO exam (course_id, author_id, title, description, due_date, is_published)
VALUES (1, 'your-professor-id', 'Overdue Exam', 'Test Description', '2023-01-01 00:00:00+00', true);
```

## Troubleshooting

### Common Issues
1. **Migration fails**: Ensure you have proper database permissions
2. **Due date validation errors**: Check that dates are in ISO 8601 format
3. **Students can't access exams**: Verify the exam is published and not overdue

### Debugging
Enable detailed logging by setting environment variable:
```bash
NODE_ENV=development
```

This will show detailed error messages for due date validations and middleware checks.

## Security Considerations

- Due date checks are enforced on the server side
- Frontend validations are supplementary only
- Professors can always access exams regardless of due date
- Students are completely blocked from overdue exams
- All due date validations use server timestamps to prevent client-side manipulation 