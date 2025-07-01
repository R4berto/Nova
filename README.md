# Nova Learning Platform 🚀

A comprehensive, modern learning management system (LMS) built with React, Node.js, and PostgreSQL. Nova provides an intuitive platform for professors and students to collaborate, share resources, and manage educational content with real-time communication capabilities.

![Nova Platform](https://img.shields.io/badge/React-19.0.0-blue) ![Node.js](https://img.shields.io/badge/Node.js-Express-green) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue) ![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-orange)

## ✨ Features

### 🎓 Core Learning Management
- **Course Management**: Create, organize, and manage courses with enrollment codes
- **Role-Based Access**: Separate interfaces for professors and students
- **Assignment System**: Upload, submit, and grade assignments with file support
- **Exam Creation & Taking**: Build comprehensive exams with multiple question types
- **Real-time Messaging**: Instant communication between students and professors
- **Course Stream**: Share announcements, materials, and updates

### 📊 Advanced Analytics
- **Decision Support System (DSS)**: Predictive analytics for student performance
- **Early Warning System**: Identify at-risk students
- **Performance Tracking**: Detailed analytics and progress monitoring
- **Student Rankings**: Comparative performance analysis

### 🔔 Communication & Collaboration
- **Real-time Messaging**: WebSocket-powered instant messaging
- **File Sharing**: Support for multiple file types with preview capabilities
- **Notifications**: Email and push notifications for important events
- **Course Announcements**: Timely updates and information sharing
- **Link Previews**: Automatic link previews in messages

### 🎨 Modern User Experience
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Dark/Light Themes**: Customizable interface themes
- **Interactive UI**: Smooth animations and modern design elements
- **Offline Capabilities**: Exam creation works offline with sync later

## 🏗️ Architecture

### Frontend (React)
- **React 19.0.0** with modern hooks and functional components
- **React Router** for navigation and routing
- **Socket.io-client** for real-time communication
- **Styled Components** for styling
- **React Hot Toast** for notifications
- **React Icons** for consistent iconography

### Backend (Node.js)
- **Express.js** server with RESTful API
- **PostgreSQL** database with advanced queries and functions
- **Socket.io** for real-time WebSocket communication
- **JWT Authentication** with secure token management
- **Multer** for file upload handling
- **Nodemailer** for email notifications

### Database (PostgreSQL)
- **User Management**: Authentication, profiles, and role-based access
- **Course System**: Courses, enrollments, and materials
- **Communication**: Messages, conversations, and notifications
- **Assessment**: Exams, assignments, and submissions
- **Analytics**: Student activity tracking and performance data

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/nova-learning-platform.git
   cd nova-learning-platform
   ```

2. **Set up environment variables**
   Create `.env` files in both root and server directories:

   **Root `.env**:**
   ```env
   CLIENT_URL=http://localhost:3000
   ```

   **Server `.env**:**
   ```env
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=nova
   JWT_SECRET=your_jwt_secret_key
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_email_app_password
   CLIENT_URL=http://localhost:3000
   ```

3. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install

   # Install client dependencies
   cd client
   npm install

   # Install server dependencies
   cd ../server
   npm install
   ```

4. **Set up the database**
   ```bash
   # Connect to PostgreSQL and create database
   psql -U your_db_user -d postgres
   CREATE DATABASE nova;
   \q

   # Run database setup scripts
   cd server/database
   psql -U your_db_user -d nova -f db.sql
   psql -U your_db_user -d nova -f messages.sql
   psql -U your_db_user -d nova -f notifications.sql
   psql -U your_db_user -d nova -f exams.sql
   psql -U your_db_user -d nova -f assignments.sql
   # ... run other SQL files as needed
   ```

5. **Start the application**
   ```bash
   # Start the server (from server directory)
   cd server
   npm start

   # Start the client (from client directory, in a new terminal)
   cd client
   npm start
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## 📖 Usage Guide

### For Professors

1. **Registration & Login**
   - Register with professor role
   - Verify email address
   - Login to access dashboard

2. **Course Management**
   - Create new courses with automatic enrollment codes
   - Set course details (semester, academic year, section)
   - Manage course status (active/inactive/archived)

3. **Content Creation**
   - Upload assignments with file attachments
   - Create exams with multiple question types
   - Post announcements and course materials
   - Share resources and links

4. **Student Management**
   - View enrolled students
   - Approve enrollment requests
   - Monitor student activity and performance
   - Access analytics and insights

5. **Assessment & Grading**
   - Grade assignments and exams
   - Provide feedback to students
   - Track student progress
   - Use DSS for performance analytics

### For Students

1. **Registration & Login**
   - Register with student role
   - Verify email address
   - Login to access dashboard

2. **Course Enrollment**
   - Use enrollment codes to join courses
   - View enrolled courses on dashboard
   - Access course materials and announcements

3. **Learning Activities**
   - Submit assignments with file uploads
   - Take exams with real-time validation
   - View grades and feedback
   - Track personal progress

4. **Communication**
   - Send messages to professors and classmates
   - Receive real-time notifications
   - Participate in course discussions
   - Access course announcements

## 🔧 Configuration

### Email Setup
Configure email notifications in `server/.env`:
```env
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password
```

### File Upload Limits
Adjust file size limits in `server/index.js`:
```javascript
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
```

### Database Connection
Configure database settings in `server/.env`:
```env
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nova
```

## 🛠️ Development

### Project Structure
```
nova/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/         # Page components
│   │   ├── contexts/      # React contexts
│   │   ├── hooks/         # Custom hooks
│   │   └── utils/         # Utility functions
│   └── public/            # Static assets
├── server/                # Node.js backend
│   ├── routes/            # API routes
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Custom middleware
│   ├── database/          # SQL scripts
│   ├── services/          # Business logic
│   └── uploads/           # File uploads
└── public/                # Public assets
```

### Available Scripts

**Client:**
```bash
npm start          # Start development server
npm run build      # Build for production
npm test           # Run tests
```

**Server:**
```bash
npm start          # Start server
npm run setup-email-verification  # Setup email verification
```

### API Endpoints

#### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/is-verify` - Verify authentication
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password` - Reset password

#### Courses
- `GET /enrollment/student-courses` - Get student courses
- `GET /enrollment/professor-courses` - Get professor courses
- `POST /enrollment-approval/request-enrollment` - Request enrollment

#### Messaging
- `GET /api/messages/conversations` - Get conversations
- `POST /api/messages/conversations` - Create conversation
- `GET /api/messages/:conversationId` - Get messages

#### Assignments
- `GET /assignments/:courseId` - Get course assignments
- `POST /assignments` - Create assignment
- `POST /assignments/:id/submit` - Submit assignment

#### Exams
- `GET /exams/:courseId` - Get course exams
- `POST /exams` - Create exam
- `POST /student-exams/submit` - Submit exam

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **CORS Protection**: Configured for secure cross-origin requests
- **Input Validation**: Server-side validation for all inputs
- **File Upload Security**: Secure file handling and validation
- **SQL Injection Prevention**: Parameterized queries

## 🚀 Deployment

### Production Build
```bash
# Build client
cd client
npm run build

# Start server in production
cd ../server
NODE_ENV=production npm start
```

### Environment Variables for Production
```env
NODE_ENV=production
DB_USER=production_db_user
DB_PASSWORD=production_db_password
DB_HOST=production_db_host
DB_PORT=5432
DB_NAME=nova_production
JWT_SECRET=production_jwt_secret
EMAIL_USER=production_email
EMAIL_PASS=production_email_password
CLIENT_URL=https://yourdomain.com
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yourusername/nova-learning-platform/issues) page
2. Create a new issue with detailed information
3. Include error logs and steps to reproduce

## 🙏 Acknowledgments

- React team for the amazing framework
- Express.js for the robust server framework
- PostgreSQL for the reliable database
- Socket.io for real-time communication capabilities
- All contributors and users of Nova Learning Platform

---

**Made with ❤️ for better education**

*Nova Learning Platform - Transforming education through technology*