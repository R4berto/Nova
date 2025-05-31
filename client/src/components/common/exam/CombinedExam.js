import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Sidebar from '../Sidebar';
import './CombinedExam.css';
import '../dashboard.css';
import { 
  FaSearch, FaBell, FaBook, 
  FaChalkboardTeacher, FaUserGraduate, FaPlus, FaFileAlt, FaGraduationCap,
  FaHome, FaEnvelope, FaCog, FaBars, FaUser, FaQuestionCircle, FaCheckCircle
} from 'react-icons/fa';
import { HiOutlineX, HiOutlineMenu } from "react-icons/hi";

// Import sub-components
import ExamBuilderComponent from './ExamBuilderComponent';
import PublishedForms from './PublishedForms/PublishedForms';
import Grading from './Grading/Grading';
import TestInterfaceComponent from './TestInterfaceComponent';
import LoadingIndicator from '../common/LoadingIndicator';

const CombinedExam = ({ setAuth }) => {
  const { courseId, examId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Check if there's a tab, view, or examId in the state passed from navigation
  const [activeTab, setActiveTab] = useState(() => {
    // First check URL search params
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    const viewParam = searchParams.get('view');
    
    // Handle exam-navbar views
    if (viewParam === 'builder' || viewParam === 'published' || viewParam === 'grading') {
      return viewParam;
    }
    
    // Handle interface/completed tabs
    if (tabParam === 'interface' || tabParam === 'completed') {
      return tabParam;
    }
    
    // Fall back to state or default
    return location.state?.activeTab || 'builder';
  });
  const [selectedExamId, setSelectedExamId] = useState(
    location.state?.examId || null
  );
  
  const [userProfile, setUserProfile] = useState({
    first_name: "",
    last_name: "",
    profilePicture: null,
    role: ""
  });
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Try to get the sidebar state from localStorage
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState === "true";
  });
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courseDetails, setCourseDetails] = useState(null);
  const [courseStatus, setCourseStatus] = useState('active');

  // Add effect to handle examId from URL
  useEffect(() => {
    if (examId) {
      // If we have an examId in the URL, switch to interface tab and set the selected exam
      setActiveTab('interface');
      setSelectedExamId(examId);
    }
  }, [examId]);

  // Add effect to handle URL tab parameter
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    
    if (tabParam === 'interface' || tabParam === 'completed') {
      setActiveTab(tabParam);
    } else if (examId) {
      // If we have an examId but no tab parameter, default to interface
      setActiveTab('interface');
    }
  }, [location.search, examId]);

  // Add effect to handle URL view parameter
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewParam = searchParams.get('view');
    const tabParam = searchParams.get('tab');
    
    if (viewParam === 'builder' || viewParam === 'published' || viewParam === 'grading') {
      setActiveTab(viewParam);
    } else if (tabParam === 'interface' || tabParam === 'completed') {
      setActiveTab(tabParam);
    } else if (examId) {
      // If we have an examId but no tab/view parameter, default to interface
      setActiveTab('interface');
    }
  }, [location.search, examId]);

  // Clear location state after using it
  useEffect(() => {
    if (location.state) {
      // Replace the current state with null to avoid reusing it on refresh
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, navigate, location.pathname]);

  // Authentication and profile data
  const getProfile = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setAuth(false);
        navigate("/login");
        return;
      }

      const res = await fetch("http://localhost:5000/dashboard/", {
        method: "GET",
        headers: { jwt_token: token }
      });

      if (!res.ok) {
        // Handle specific HTTP error codes
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("token");
          setAuth(false);
          navigate("/login");
          return;
        }
        throw new Error(`Server error: ${res.status}`);
      }

      const parseData = await res.json();

      if (parseData.error) {
        throw new Error(parseData.error);
      }

      // Set default role to "student" if not provided
      const userRole = parseData.role || "student";
      
      setUserProfile({
        first_name: parseData.first_name || "",
        last_name: parseData.last_name || "",
        profilePicture: parseData.profile_picture_url || null,
        role: userRole
      });

      // If user is not a professor and tries to access professor-only tabs, redirect to test interface
      if (userRole !== "professor" && 
          (activeTab === 'builder' || 
           activeTab === 'published' ||
           activeTab === 'grading')) {
        setActiveTab('interface');
      }

    } catch (err) {
      console.error("Error fetching profile:", err.message);
      if (err.message.includes('jwt') || err.message.includes('token')) {
        localStorage.removeItem("token");
        setAuth(false);
        navigate("/login");
      } else {
        // Provide more specific error message for debugging
        toast.error(`Error loading profile data: ${err.message}`);
        
        // Set default profile values to prevent UI errors
        setUserProfile({
          first_name: "Student",
          last_name: "",
          profilePicture: null,
          role: "student"
        });
        
        // Ensure student is redirected to appropriate view
        if (activeTab === 'builder' || 
            activeTab === 'published' ||
            activeTab === 'grading') {
          setActiveTab('interface');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [setAuth, navigate, activeTab]);

  useEffect(() => {
    getProfile();
  }, [getProfile]);

  // Fetch course details
  useEffect(() => {
    const fetchCourseDetails = async () => {
      if (!courseId) return;
      try {
        const response = await fetch(`http://localhost:5000/courses/${courseId}`, {
          method: "GET",
          headers: { "jwt_token": localStorage.token }
        });

        if (!response.ok) {
          let foundCourse = null;
          try {
            const professorResponse = await fetch(`http://localhost:5000/courses/professor`, {
              method: "GET", headers: { "jwt_token": localStorage.token }
            });
            if (professorResponse.ok) {
              const professorCourses = await professorResponse.json();
              foundCourse = professorCourses.find(c => c.course_id === parseInt(courseId));
            }
          } catch {}

          if (!foundCourse) {
            try {
              const studentResponse = await fetch(`http://localhost:5000/courses/student`, {
                method: "GET", headers: { "jwt_token": localStorage.token }
              });
              if (studentResponse.ok) {
                const studentCourses = await studentResponse.json();
                foundCourse = studentCourses.find(c => c.course_id === parseInt(courseId));
              }
            } catch {}
          }

          if (foundCourse) {
            setCourseDetails(foundCourse);
            setCourseStatus(foundCourse.status || 'active');
          } else {
            setCourseDetails({
              course_name: "Course",
              section: "Details Unavailable",
              description: "Could not load course description.",
              semester: "N/A",
              academic_year: "N/A",
              status: 'active'
            });
            setCourseStatus('active');
          }
        } else {
          const data = await response.json();
          setCourseDetails(data);
          setCourseStatus(data.status || 'active');
        }
      } catch (error) {
        console.error('Error fetching course details:', error);
        setCourseDetails({
          course_name: "Course",
          section: "Details Unavailable",
          description: "Could not load course description.",
          semester: "N/A",
          academic_year: "N/A",
          status: 'active'
        });
        setCourseStatus('active');
      }
    };
    fetchCourseDetails();
  }, [courseId]);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);

    return () => {
      window.removeEventListener("resize", checkIfMobile);
    };
  }, []);

  // Fetch courses for sidebar
  useEffect(() => {
    const fetchCourses = async () => {
      setLoadingCourses(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        let endpoint = '';
        if (userProfile.role === 'professor') {
          endpoint = 'http://localhost:5000/enrollment/professor-courses';
        } else {
          endpoint = 'http://localhost:5000/enrollment/student-courses';
        }
        const response = await fetch(endpoint, {
          headers: { jwt_token: token }
        });
        if (!response.ok) throw new Error('Failed to fetch courses');
        const data = await response.json();
        setCourses(Array.isArray(data) ? data : []);
      } catch (err) {
        setCourses([]);
      } finally {
        setLoadingCourses(false);
      }
    };
    if (userProfile.role) fetchCourses();
  }, [userProfile.role]);

  const logout = async (e) => {
    e.preventDefault();
    try {
      localStorage.clear();
      setAuth(false);
      toast.success("Logged out successfully!");
      navigate("/login");
    } catch (err) {
      console.error(err.message);
      toast.error("Error during logout");
    }
  };

  // Handle tab switching with optional exam ID
  const handleSwitchTab = (tab, examId = null, submissionId = null) => {
    console.log(`Switching to tab: ${tab}, exam ID: ${examId}, submission ID: ${submissionId}`);
    
    // Allow navigation to all tabs for viewing purposes
    // Individual components will handle their own modification restrictions
    if (courseStatus === 'inactive' && userProfile.role !== 'professor' && tab === 'interface') {
      // For inactive courses, redirect students from interface to completed
      toast.info("This course is inactive. You can only view completed exams.");
      navigate(`/courses/${courseId}/exams?view=completed`);
      return;
    }
    
    // Handle different navigation types
    if (tab === 'interface') {
      if (examId) {
        // For direct exam access, use URL parameter
        navigate(`/courses/${courseId}/exams/${examId}?tab=interface`);
      } else {
        // For general interface view, just use tab parameter
        navigate(`/courses/${courseId}/exams?tab=interface`);
      }
    } else if (tab === 'completed') {
      if (examId) {
        // For direct completed exam access, use URL parameter
        navigate(`/courses/${courseId}/exams/${examId}?tab=completed`);
      } else {
        // For general completed view, just use tab parameter
        navigate(`/courses/${courseId}/exams?tab=completed`);
      }
    } else if (tab === 'grading') {
      // For grading view, include examId and submissionId in URL if provided
      const searchParams = new URLSearchParams();
      searchParams.set('view', tab);
      if (examId) searchParams.set('examId', examId);
      if (submissionId) searchParams.set('submissionId', submissionId);
      navigate(`/courses/${courseId}/exams?${searchParams.toString()}`, { replace: true });
      setActiveTab(tab);
      setSelectedExamId(examId);
    } else {
      // For other exam-navbar tabs (builder, published)
      const searchParams = new URLSearchParams();
      searchParams.set('view', tab);
      navigate(`/courses/${courseId}/exams?${searchParams.toString()}`, { replace: true });
      setActiveTab(tab);
      setSelectedExamId(examId);
    }
  };

  // Render appropriate component based on active tab
  const renderComponent = () => {
    // Get URL parameters for grading view
    const searchParams = new URLSearchParams(location.search);
    const examIdParam = searchParams.get('examId');
    const submissionIdParam = searchParams.get('submissionId');
    
    // Pass courseId and courseStatus to all components that might need it
    const commonProps = { 
      courseId,
      userRole: userProfile.role,
      courseStatus,
      key: activeTab,
      ...(activeTab === 'builder' && selectedExamId ? { examId: selectedExamId } : {}),
      ...(activeTab === 'interface' && (selectedExamId || examId) ? { initialExamId: selectedExamId || examId } : {}),
      ...(activeTab === 'grading' ? { 
        initialExamId: examIdParam || selectedExamId,
        initialSubmissionId: submissionIdParam
      } : {})
    };
    
    // If student tries to access professor-only tabs, redirect to interface
    if (userProfile.role !== "professor" && 
        (activeTab === 'builder' || 
         activeTab === 'published' ||
         activeTab === 'grading')) {
      return <TestInterfaceComponent {...commonProps} showCompletedOnly={false} />;
    }
    
    switch (activeTab) {
      case 'builder':
        return <ExamBuilderComponent {...commonProps} />;
      case 'published':
        return <PublishedForms {...commonProps} onSwitchTab={handleSwitchTab} />;
      case 'grading':
        return <Grading {...commonProps} />;
      case 'interface':
        return <TestInterfaceComponent {...commonProps} showCompletedOnly={false} />;
      case 'completed':
        return <TestInterfaceComponent {...commonProps} showCompletedOnly={true} />;
      default:
        return userProfile.role === "professor" ? 
          <ExamBuilderComponent {...commonProps} /> : 
          <TestInterfaceComponent {...commonProps} showCompletedOnly={false} />;
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container dashboard-page">
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={{width: '280px', borderRight: '1px solid #e0e0e0'}}></div>
        <div className="main-content" style={{marginLeft: '280px'}}>
          <div className="content-wrapper">
            <div className="top-bar" style={{height: '60px', borderBottom: '1px solid #e0e0e0', marginBottom:'24px'}}></div>
            <LoadingIndicator text="Loading Course Exams" />
          </div>
        </div>
      </div>
    );
  }

  const currentCourse = courseDetails || {
    course_name: "Course",
    section: "Details Unavailable",
    description: "Course details could not be loaded.",
    semester: "N/A",
    academic_year: "N/A"
  };

  const tabs = [
    { id: 'stream', label: 'Stream' },
    { id: 'messages', label: 'Messages' },
    { id: 'assignments', label: 'Assignments' },
    { id: 'exams', label: 'Exams' },
    { id: 'people', label: 'People' },
    { id: 'grades', label: 'Grades' }
  ];

  return (
    <div className="dashboard-container dashboard-page">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobile={isMobile}
        userRole={userProfile.role}
        courses={courses}
        loading={loadingCourses}
        userProfile={{
          first_name: userProfile.first_name,
          last_name: userProfile.last_name,
          profile_picture_url: userProfile.profilePicture
        }}
        onLogout={logout}
        activePath={location.pathname}
      />
      <div className={`main-content ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {isMobile && (
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <HiOutlineX /> : <HiOutlineMenu />}
          </button>
        )}
        <div className="content-wrapper">
          <div className="top-bar">
            <div className="top-bar-right">
              <div className="user-profile">
                <div className="user-info">
                  <div className="user-name">{userProfile.first_name} {userProfile.last_name}</div>
                  <div className="user-role">{userProfile.role || 'Loading...'}</div>
                </div>
                {userProfile.profilePicture ? (
                  <div className="avatar" onClick={() => navigate("/settings")} style={{ cursor: 'pointer' }}>
                    <img src={userProfile.profilePicture} alt="Profile" />
                  </div>
                ) : (
                  <div className="avatar" onClick={() => navigate("/settings")} style={{ cursor: 'pointer' }}>
                    {userProfile.first_name && userProfile.last_name ? `${userProfile.first_name[0]}${userProfile.last_name[0]}` : ""}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="course-main-area">
            <nav className="course-nav">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`nav-tab ${
                    window.location.pathname.endsWith(`/${tab.id}`) || 
                    (tab.id === 'exams' && window.location.pathname.includes(`/courses/${courseId}/exams`))
                      ? 'active' 
                      : ''
                  }`}
                  onClick={() => navigate(
                    tab.id === 'stream' 
                      ? `/courses/${courseId}/stream` 
                      : `/courses/${courseId}/${tab.id}`
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Course Status Banner */}
            {courseStatus !== 'active' && (
              <div className={`course-status-banner ${courseStatus}`}>
                <span className="status-icon">
                  {courseStatus === 'archived' ? '📚' : '⏸️'}
                </span>
                <div className="status-text">
                  <strong>
                    {courseStatus === 'archived' ? 'Archived Course' : 'Inactive Course'}
                  </strong>
                  <p>
                    {courseStatus === 'archived' 
                      ? 'This course is archived. Only viewing is available.'
                      : userProfile.role === 'professor'
                        ? 'This course is inactive. Only grade rechecking is available.'
                        : 'This course is inactive. You can only view completed exams.'
                    }
                  </p>
                </div>
              </div>
            )}

            <div className="exam-navbar">
              {userProfile.role === "professor" ? (
                <>
                  <button 
                    className={`nav-button ${activeTab === 'builder' ? 'active' : ''} ${courseStatus !== 'active' ? 'view-only' : ''}`}
                    onClick={() => handleSwitchTab('builder')}
                    title={courseStatus !== 'active' ? `View-only mode in ${courseStatus} courses` : ''}
                  >
                    <FaPlus className="nav-icon" />
                    <span>{courseStatus !== 'active' ? 'View Exams' : 'Exam Builder'}</span>
                  </button>
                  <button 
                    className={`nav-button ${activeTab === 'published' ? 'active' : ''} ${courseStatus !== 'active' ? 'view-only' : ''}`}
                    onClick={() => handleSwitchTab('published')}
                    title={courseStatus !== 'active' ? `View-only mode in ${courseStatus} courses` : ''}
                  >
                    <FaFileAlt className="nav-icon" />
                    <span>{courseStatus !== 'active' ? 'View Forms' : 'Published Forms'}</span>
                  </button>
                  <button 
                    className={`nav-button ${activeTab === 'grading' ? 'active' : ''} ${courseStatus === 'archived' ? 'view-only' : ''}`}
                    onClick={() => handleSwitchTab('grading')}
                    title={courseStatus === 'archived' ? 'View-only mode in archived courses' : courseStatus === 'inactive' ? 'Recheck-only mode in inactive courses' : ''}
                  >
                    <FaGraduationCap className="nav-icon" />
                    <span>
                      {courseStatus === 'archived' ? 'View Grades' : courseStatus === 'inactive' ? 'Recheck Grades' : 'Grading'}
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className={`nav-button ${activeTab === 'interface' ? 'active' : ''} ${courseStatus === 'inactive' ? 'disabled' : ''}`}
                    onClick={() => handleSwitchTab('interface')}
                    disabled={courseStatus === 'inactive'}
                    title={courseStatus === 'inactive' ? 'Taking new exams is disabled in inactive courses' : ''}
                  >
                    <FaFileAlt className="nav-icon" />
                    <span>Available Exams</span>
                  </button>
                  <button 
                    className={`nav-button ${activeTab === 'completed' ? 'active' : ''}`}
                    onClick={() => handleSwitchTab('completed')}
                  >
                    <FaCheckCircle className="nav-icon" />
                    <span>Completed</span>
                  </button>
                </>
              )}
            </div>
            <div className="exam-content">
              {renderComponent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CombinedExam; 