import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './CourseSettings.css';
import '../dashboard.css';
import Sidebar from '../Sidebar';
import { HiOutlineX, HiOutlineMenu } from 'react-icons/hi';

const CourseSettings = ({ setAuth }) => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [inputs, setInputs] = useState({
    first_name: "",
    last_name: "",
    profilePicture: null
  });

  // Check if mobile on mount and when window resizes
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);

    return () => {
      window.removeEventListener("resize", checkIfMobile);
    };
  }, []);

  // Fetch user data, role and courses
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // This would be implemented to fetch actual user data
        // For now using placeholder data
        setUserRole("professor");
        setCourses([]);
        setLoadingCourses(false);
        setInputs({
          first_name: "User",
          last_name: "Name",
          profilePicture: null
        });
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };

    fetchUserData();
  }, []);

  const logout = async () => {
    try {
      localStorage.removeItem("token");
      setAuth(false);
      navigate("/login");
    } catch (err) {
      console.error(err.message);
    }
  };

  return (
    <div className="dashboard-container dashboard-page">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isMobile={isMobile}
        userRole={userRole}
        courses={courses}
        loading={loadingCourses}
        userProfile={{
          first_name: inputs.first_name,
          last_name: inputs.last_name,
          profile_picture_url: inputs.profilePicture
        }}
        onLogout={logout}
        activePath={`/courses/${courseId}/settings`}
      />

      <div className="main-content">
        {isMobile && (
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <HiOutlineX /> : <HiOutlineMenu />}
          </button>
        )}

        <div className="content-wrapper">
          <div className="course-settings-container">
            <h1>Course Settings</h1>
            <p>This feature is coming soon!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseSettings; 