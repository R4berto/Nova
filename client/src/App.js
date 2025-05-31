import React, { Fragment, useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import './App.css';
import { Toaster } from 'react-hot-toast';

// Components
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import Courses from "./components/courses";
import Stream from "./components/stream/Stream";
import Messages from "./components/messages/Messages";
import PrivateMessages from "./components/messages/PrivateMessages";
import Assignments from "./components/assignments/Assignments";
import People from "./components/people/People";
import CourseSettings from "./components/settings/CourseSettings";
import Settings from "./components/Settings";
import CombinedExam from './components/exam/CombinedExam';
import PrivateRoute from "./components/PrivateRoute";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const isAuth = async () => {
    try {
      const res = await fetch("http://localhost:5000/auth/is-verify", {
        method: "GET",
        headers: { jwt_token: localStorage.getItem("token") }
      });

      const parseRes = await res.json();
      setIsAuthenticated(parseRes === true);
    } catch (err) {
      console.error("Error verifying authentication:", err.message);
    }
  };

  useEffect(() => {
    isAuth();
  }, []);

  const setAuth = (boolean) => {
    setIsAuthenticated(boolean);
  };

  return (
    <Fragment>
      <Toaster />
      <Router>
        <div className="container">
        <Routes>
          {/* Root path redirects to login if not authenticated, or dashboard if authenticated */}
          <Route path="/" element={
            localStorage.getItem("token") ? 
              <Navigate to="/dashboard" /> : 
              <Navigate to="/login" />
          } />
          
          {/* Public routes */}
          <Route path="/login" element={
            isAuthenticated ? 
              <Navigate to="/dashboard" /> : 
              <Login setAuth={setAuth} />
          } />
          <Route path="/register" element={<Register setAuth={setAuth} />} />
          
          {/* Protected routes using PrivateRoute */}
          <Route path="/dashboard" element={
            <PrivateRoute>
              <Dashboard setAuth={setAuth} />
            </PrivateRoute>
          } />
          
          <Route path="/courses" element={
            <PrivateRoute>
              <Courses setAuth={setAuth} />
            </PrivateRoute>
          } />
          
          <Route path="/messages" element={
            <PrivateRoute>
              <PrivateMessages setAuth={setAuth} />
            </PrivateRoute>
          } />
          
          {/* Course routes */}
          <Route path="/courses/:courseId/stream" element={
            <PrivateRoute>
              <Stream setAuth={setAuth} />
            </PrivateRoute>
          } />
          
          <Route path="/courses/:courseId/messages" element={
            <PrivateRoute>
              <Messages setAuth={setAuth} />
            </PrivateRoute>
          } />
          
          <Route path="/courses/:courseId/assignments" element={
            <PrivateRoute>
              <Assignments setAuth={setAuth} />
            </PrivateRoute>
          } />
          
          <Route path="/courses/:courseId/assignments/:assignmentId" element={
            <PrivateRoute>
              <Assignments setAuth={setAuth} />
            </PrivateRoute>
          } />
          
          <Route path="/courses/:courseId/exams" element={
            <PrivateRoute>
              <CombinedExam setAuth={setAuth} />
            </PrivateRoute>
          } />
          
          {/* Add new route for direct exam access */}
          <Route path="/courses/:courseId/exams/:examId" element={
            <PrivateRoute>
              <CombinedExam setAuth={setAuth} />
            </PrivateRoute>
          } />
          
          <Route path="/courses/:courseId/people" element={
            <PrivateRoute>
              <People setAuth={setAuth} />
            </PrivateRoute>
          } />
          
          <Route path="/courses/:courseId/settings" element={
            <PrivateRoute>
              <CourseSettings setAuth={setAuth} />
            </PrivateRoute>
          } />
          
          <Route path="/courses/exam" element={
            <PrivateRoute>
              <CombinedExam setAuth={setAuth} />
            </PrivateRoute>
          } />
          
          <Route path="/messages/:userId" element={
            <PrivateRoute>
              <PrivateMessages setAuth={setAuth} />
            </PrivateRoute>
          } />
          
          <Route path="/settings" element={
            <PrivateRoute>
              <Settings setAuth={setAuth} />
            </PrivateRoute>
          } />
        </Routes>
        </div>
      </Router>
    </Fragment>
  );
}

export default App;
