require('dotenv').config();
const express = require("express");
const app = express();
const cors = require("cors");
const pool = require("./db");
const path = require("path");
const fs = require("fs");
const messagesRoutes = require("./routes/messagesRoutes");
const linkPreviewRoutes = require("./routes/linkPreviewRoutes");
const fileUploadRoutes = require("./routes/fileUploadRoutes");
const http = require("http");
const { initializeWebSocket } = require("./websocket");
const notificationRoutes = require('./routes/notifications');

//middleware
app.use(cors());
app.use(express.json({ limit: '500mb' })); //req.body
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Configure express to serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from the public directory
app.use('/offline', express.static(path.join(__dirname, '../public/offline')));

// Also add a direct path for the Activity_2_beziermethod.png file
app.get('/Activity_2_beziermethod.png', (req, res) => {
  // Try to find the file in various locations
  const possiblePaths = [
    path.join(__dirname, 'uploads', 'assignments', 'Activity_2_beziermethod.png'),
    path.join(__dirname, 'public', 'images', 'Activity_2_beziermethod.png'),
    path.join(__dirname, 'public', 'assets', 'Activity_2_beziermethod.png'),
    path.join(__dirname, 'public', 'Activity_2_beziermethod.png')
  ];
  
  // Check each path and serve the first one that exists
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
  }
  
  // If no file found, return 404
  res.status(404).send('Image not found');
});

//ROUTES//
app.use("/auth", require("./routes/jwtAuth"));
app.use("/dashboard", require("./routes/dashboard"));
const coursesRouter = require("./routes/courses");
const enrollmentRouter = require("./routes/enrollment");
const streamRouter = require("./routes/stream");
const announcementsRouter = require("./routes/announcements");
const assignmentsRouter = require("./routes/assignments");
const examsRouter = require("./routes/exams");
const studentExamsRouter = require("./routes/student_exams");
const dssRouter = require("./routes/dss");

app.use("/courses", coursesRouter);
app.use("/enrollment", enrollmentRouter);
app.use("/stream", streamRouter);
app.use("/announcements", announcementsRouter);
app.use("/assignments", assignmentsRouter);
app.use("/exams", examsRouter);
app.use("/student-exams", studentExamsRouter);
app.use("/api/messages", messagesRoutes);
app.use("/api/links", linkPreviewRoutes);
app.use("/api/uploads", fileUploadRoutes);
app.use('/notifications', notificationRoutes);
app.use('/dss', dssRouter);

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
initializeWebSocket(server);

// Update listen to use the HTTP server instead of the Express app
server.listen(5000, () => {
  console.log("Server is running on port 5000");
});
