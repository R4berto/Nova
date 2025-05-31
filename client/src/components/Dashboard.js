import React, { useState, useEffect, useCallback, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { 
    HiOutlineBell,
    HiOutlineMenu,
    HiOutlineX,
    HiOutlineAcademicCap,
    HiOutlinePlus,
    HiOutlineSearch,

} from "react-icons/hi"
import { FaArchive, FaBan, FaGraduationCap } from "react-icons/fa"
import toast from "react-hot-toast"
import "./dashboard.css"
import { createCourseChat } from './messages/messagingHelpers'
import { io } from "socket.io-client";
import LoadingIndicator from "./common/LoadingIndicator";
import Sidebar from './Sidebar';

export default function Dashboard({ setAuth }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Try to get the sidebar state from localStorage
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState === "true";
  })
  const [isMobile, setIsMobile] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const navigate = useNavigate()
  const [userRole, setUserRole] = useState(null)
  const [courses, setCourses] = useState([])
  const [enrollmentCode, setEnrollmentCode] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState("active")
  const [inputs, setInputs] = useState({
    first_name: "",
    last_name: "",
    profilePicture: null
  });
  const [userId, setUserId] = useState(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [isCoursesSubmenuOpen, setIsCoursesSubmenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationPreferences, setNotificationPreferences] = useState({
    email_notifications: true,
    push_notifications: true,
    due_date_reminders: true,
    new_content_alerts: true,
    grade_notifications: true,
    message_notifications: true
  });
  const socketRef = useRef(null);
  const [notificationsError, setNotificationsError] = useState(null);
  
  const { first_name, last_name } = inputs;

  // Getting profile details
  const getProfile = async () => {
    try {
      const res = await fetch("http://localhost:5000/dashboard/", {
        method: "GET",
        headers: { jwt_token: localStorage.token }
      });

      const parseData = await res.json();

      // Set userId from profile data
      setUserId(parseData.user_id || parseData.id);
      console.log("User ID set:", parseData.user_id || parseData.id);

      // Update all state fields correctly
      setInputs(prevState => ({
        ...prevState,
        first_name: parseData.first_name,
        last_name: parseData.last_name,
        profilePicture: parseData.profile_picture_url || null
      }));

    } catch (err) {
      console.error("Error fetching profile:", err.message);
    }
  };

  const fetchUserRole = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch("http://localhost:5000/auth/user-role", {
        headers: {
          jwt_token: token
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
          return;
        }
        throw new Error("Failed to fetch user role");
      }

      const data = await response.json();
      setUserRole(data.role);
    } catch (err) {
      console.error("Error fetching user role:", err);
      toast.error("Failed to fetch user role");
    }
  }, [navigate]);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const endpoint = userRole === "professor" 
        ? "http://localhost:5000/enrollment/professor-courses"
        : "http://localhost:5000/enrollment/student-courses";
      
      const response = await fetch(endpoint, {
        headers: {
          jwt_token: token
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
          return;
        }
        throw new Error('Failed to fetch courses');
      }
      
      const data = await response.json();
      const processedData = Array.isArray(data) ? data.map(course => ({
        ...course
      })) : [];
      
      setCourses(processedData);
      setError(null);
    } catch (err) {
      console.error(err.message);
      setError('Failed to load courses');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [userRole, navigate]);

  const handleEnroll = async (e) => {
    e.preventDefault();
    if (!enrollmentCode.trim()) {
      setError("Please enter an enrollment code");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      // Check if already enrolled in a course with this code
      const alreadyEnrolled = courses.some(course => course.enrollment_code === enrollmentCode);
      if (alreadyEnrolled) {
        setError("You are already enrolled in this course. Please enter a different enrollment code.");
        setEnrollmentCode(""); // Clear the input
        return;
      }

      const response = await fetch("http://localhost:5000/enrollment/enroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          jwt_token: token
        },
        body: JSON.stringify({ enrollment_code: enrollmentCode })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error?.includes("already enrolled")) {
          setError("You are already enrolled in this course. Please enter a different enrollment code.");
          setEnrollmentCode(""); // Clear the input for new code
        } else {
          setError(errorData.error || "Failed to enroll in course");
          setEnrollmentCode(""); // Clear the input after any error
        }
        return;
      }

      const data = await response.json();
      // Add the new course
      const newCourse = {
        ...data.course,
        progress: 0
      };
      
      setCourses([...courses, newCourse]);
      setEnrollmentCode("");
      setShowEnrollModal(false);
      setError(null);
      toast.success("Successfully enrolled in course");
      
      // Refresh courses to show the newly added course
      await fetchCourses();
      
      // Automatically create or join the course chat
      try {
        // Get user profile to pass to createCourseChat
        const profileResponse = await fetch("http://localhost:5000/dashboard/", {
          method: "GET",
          headers: { jwt_token: token }
        });
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const userProfile = {
            user_id: profileData.user_id || profileData.id,
            first_name: profileData.first_name,
            last_name: profileData.last_name,
            role: profileData.role,
            profile_picture_url: profileData.profile_picture_url || null
          };
          
          // Call helper function to create or join course chat
          await createCourseChat(newCourse.course_id, userProfile, newCourse.course_name);
          console.log(`Course chat for ${newCourse.course_name} automatically created/joined`);
        }
      } catch (chatError) {
        console.error("Could not automatically create/join course chat:", chatError);
        // Don't show error to user, as this is a background operation
      }
      
      // Redirect to dashboard
      navigate("/dashboard");
    }
    catch (err) {
      console.error(err.message);
      setError("Server error. Please try again later.");
    }
  };

  // Simplify fetch notifications to avoid any loading state
  const fetchNotifications = async () => {
    try {
      if (!userId) {
        console.log("Cannot fetch notifications: User ID not available");
        return;
      }
      
      console.log("Fetching notifications for user:", userId);
      const response = await fetch("http://localhost:5000/notifications", {
        method: "GET",
        headers: { jwt_token: localStorage.token }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Update state with fetched notifications
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
      
    } catch (error) {
      console.error("Error fetching notifications:", error);
      // Only update error message, no loading state changes
      setNotificationsError(error.message);
    }
  };

  // Initial fetch of notifications
  const initialFetchNotifications = async () => {
    try {
      // Only fetch if we have a valid user ID
      if (!userId) {
        return;
      }
      
      const response = await fetch("http://localhost:5000/notifications", {
        method: "GET",
        headers: { jwt_token: localStorage.token }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Update state with fetched notifications
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
      
    } catch (error) {
      console.error("Error in initial fetch of notifications:", error);
    }
  };

  // Add this useEffect for initial notification loading
  useEffect(() => {
    if (userId) {
      initialFetchNotifications();
    }
  }, [userId]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      console.log(`Marking notification ${notificationId} as read`);
      const response = await fetch(`http://localhost:5000/notifications/${notificationId}/read`, {
        method: "PUT",
        headers: { jwt_token: localStorage.token }
      });

      if (!response.ok) {
        throw new Error("Failed to mark notification as read");
      }

      // Update notification state
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => 
          (notification.notification_id || notification.id) === notificationId 
            ? { ...notification, is_read: true } 
            : notification
        )
      );
      
      // Update unread count
      setUnreadCount(prevCount => Math.max(0, prevCount - 1));
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification) => {
    // Mark as read if not already read
    if (!notification.is_read) {
      await markAsRead(notification.notification_id || notification.id);
    }

    // Handle navigation based on notification type and metadata
    if (notification.metadata) {
      try {
        // Log the raw metadata for debugging
        console.log("Raw notification metadata:", notification.metadata);
        
        const metadata = typeof notification.metadata === 'string' 
          ? JSON.parse(notification.metadata) 
          : notification.metadata;
        
        // Log parsed metadata for debugging
        console.log("Parsed notification metadata:", metadata);

        if (metadata.redirect_url) {
          console.log("Navigating to redirect URL:", metadata.redirect_url);
          // If there's state in the metadata, use it for navigation
          if (metadata.state) {
            console.log("Using state for navigation:", metadata.state);
            navigate(metadata.redirect_url, { state: metadata.state });
          } else {
            navigate(metadata.redirect_url);
          }
        } else if (metadata.type === 'course_chat') {
          // Course chat messages should have priority
          console.log("This is a course chat message. Navigating to course messages:", metadata.course_id);
          navigate(`/courses/${metadata.course_id}/messages`);
        } else if (metadata.message_id && metadata.sender_id) {
          // Private messages from a specific sender
          console.log("Navigating to message from sender:", metadata.sender_id, "Message ID:", metadata.message_id);
          navigate(`/messages/${metadata.sender_id}`);
        } else if (metadata.conversation_id) {
          // Regular group chats without course context
          console.log("Navigating to conversation:", metadata.conversation_id);
          navigate(`/messages`);
        } else if (metadata.course_id) {
          // Generic course navigation - for announcements, assignments, etc.
          if (metadata.announcement_id) {
            console.log("Navigating to course announcement:", metadata.course_id, metadata.announcement_id);
            navigate(`/courses/${metadata.course_id}/stream`);
          } else if (metadata.assignment_id) {
            console.log("Navigating to course assignment:", metadata.course_id, metadata.assignment_id);
            navigate(`/courses/${metadata.course_id}/assignments?assignmentId=${metadata.assignment_id}`);
          } else {
            console.log("Navigating to course stream:", metadata.course_id);
            navigate(`/courses/${metadata.course_id}/stream`);
          }
        } else {
          console.log("No navigation information found in metadata");
        }
      } catch (error) {
        console.error("Error handling notification metadata:", error);
      }
    } else {
      console.log("Notification has no metadata for navigation");
    }

    // Close notification panel after click
    setShowNotificationPanel(false);
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/notifications/read-all", {
        method: "PUT",
        headers: {
          jwt_token: token
        }
      });

      if (!response.ok) {
        throw new Error("Failed to mark all notifications as read");
      }

      setNotifications(prevNotifications =>
        prevNotifications.map(notification => ({ ...notification, is_read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
      toast.error("Failed to mark all notifications as read");
    }
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/notifications/clear-all", {
        method: "DELETE",
        headers: {
          jwt_token: token
        }
      });

      if (!response.ok) {
        throw new Error("Failed to clear all notifications");
      }

      // Clear notifications from state
      setNotifications([]);
      setUnreadCount(0);
      toast.success("All notifications cleared!");
    } catch (err) {
      console.error("Error clearing all notifications:", err);
      toast.error("Failed to clear all notifications");
    }
  };

  // Check if mobile on mount and when window resizes
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkIfMobile()
    window.addEventListener("resize", checkIfMobile)

    return () => {
      window.removeEventListener("resize", checkIfMobile)
    }
  }, [])

  useEffect(() => {
    fetchUserRole();
  }, [fetchUserRole]);

  useEffect(() => {
    if (userRole) {
      fetchCourses();
    }
  }, [userRole, fetchCourses]);

  useEffect(() => {
    getProfile();
  }, []);

  // Add WebSocket connection
  useEffect(() => {
    const socket = io('http://localhost:5000', {
      withCredentials: true,
      transportOptions: {
        polling: {
          extraHeaders: {
            'Authorization': `Bearer ${localStorage.token}`
          }
        }
      }
    });

    // Only set up notifications if we have a userId available
    if (userId) {
      console.log(`Attempting to connect to WebSocket with user_id: ${userId}`);
      
      socket.on('connect', () => {
        console.log('WebSocket connected successfully');
        // Join a room specific to this user
        socket.emit('join', `user:${userId}`);
      });

      socket.on('notification', (notification) => {
        console.log('Received notification:', notification);
        // Update your notifications state
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
      });

      socket.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
      });
    } else {
      console.log('User ID not available yet, WebSocket connection deferred');
    }

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  // Add notification preferences fetch
  const fetchNotificationPreferences = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:5000/notifications/preferences", {
        headers: { jwt_token: localStorage.getItem("token") }
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch notification preferences");
      }
      
      const data = await response.json();
      setNotificationPreferences(data);
    } catch (err) {
      console.error("Error fetching notification preferences:", err);
      toast.error("Failed to load notification preferences");
    }
  }, []);

  // Add notification preferences update
  const updateNotificationPreferences = async (newPreferences) => {
    try {
      const response = await fetch("http://localhost:5000/notifications/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          jwt_token: localStorage.getItem("token")
        },
        body: JSON.stringify(newPreferences)
      });

      if (!response.ok) {
        throw new Error("Failed to update notification preferences");
      }

      const data = await response.json();
      setNotificationPreferences(data);
      toast.success("Notification preferences updated!");
    } catch (err) {
      console.error("Error updating notification preferences:", err);
      toast.error("Failed to update notification preferences");
    }
  };

  // Add to existing useEffect
  useEffect(() => {
    fetchNotificationPreferences();
  }, [fetchNotificationPreferences]);

  const logout = async (e) => {
    e.preventDefault()
    try {
      localStorage.removeItem("token")
      setAuth(false)
      toast.success("Logged out successfully!")
      navigate("/login")
    } catch (err) {
      console.error(err.message)
    }
  }

  const filteredCourses = courses.filter(
    (course) => {
      const matchesSearch = course.course_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = course.status === activeTab;
      return matchesSearch && matchesStatus;
    }
  );

  // Toggle submenu open/close
  const toggleCoursesSubmenu = (e) => {
    e.preventDefault();
    setIsCoursesSubmenuOpen(!isCoursesSubmenuOpen);
  };

  return (
    <div className="dashboard-container dashboard-page">
      {/* Sidebar */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobile={isMobile}
        userRole={userRole}
        courses={courses}
        loading={loading}
        userProfile={{ first_name, last_name, profile_picture_url: inputs.profilePicture }}
        onLogout={logout}
        activePath="/dashboard"
      />

      {/* Main Content */}
      <div className={`main-content ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Mobile Toggle Button */}
        {isMobile && (
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <HiOutlineX /> : <HiOutlineMenu />}
          </button>
        )}

        <div className="content-wrapper">
          {/* Top Bar */}
          <div className="top-bar">
            <div className="search-container">
              <div className="search-bar">
                <HiOutlineSearch className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search courses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="top-bar-right">
              {/* Notification Panel */}
              <div className="notification-container">
                <button 
                  className="notification-trigger"
                  onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                >
                  <HiOutlineBell className="notification-icon" />
                  {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount}</span>
                  )}
                </button>

                {showNotificationPanel && (
                  <div className="notification-panel" onClick={(e) => e.stopPropagation()}>
                    <div className="notification-header">
                      <h2>Notifications</h2>
                      <div className="notification-actions">
                        <button 
                          className="refresh-button"
                          onClick={fetchNotifications}
                          title="Refresh notifications"
                        >
                          Refresh
                        </button>
                        {notifications.length > 0 && (
                          <button 
                            className="clear-all-button"
                            onClick={clearAllNotifications}
                            title="Clear all notifications"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {notificationsError && (
                      <div className="notification-error">
                        Error loading notifications: {notificationsError}
                      </div>
                    )}
                    
                    {notifications.length === 0 ? (
                      <div className="empty-notifications">
                        <p>No notifications yet.</p>
                      </div>
                    ) : (
                      <div className="notification-list">
                        {notifications.map((notification) => (
                          <div
                            key={notification.notification_id}
                            className={`notification-item ${!notification.is_read ? "unread" : ""}`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="notification-content">
                              <p>{notification.message}</p>
                              <span className="notification-time">
                                {new Date(notification.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="user-profile">
                <div className="user-info">
                  <div className="user-name">{first_name} {last_name}</div>
                  <div className="user-role">{userRole}</div>
                </div>
                {inputs.profilePicture ? (
                  <div className="avatar" onClick={() => navigate("/settings")} style={{ cursor: 'pointer' }}>
                    <img src={inputs.profilePicture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  </div>
                ) : (
                  <div className="avatar" onClick={() => navigate("/settings")} style={{ cursor: 'pointer' }}>
                    {first_name && last_name ? `${first_name[0]}${last_name[0]}` : ""}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Welcome Section */}
          <div className="welcome-section">
            <h1>Welcome, {first_name}!</h1>
            <p>Here's an overview of your learning progress and upcoming schedule.</p>
          </div>

          {/* Statistics Cards - Reverted Structure */}
          <div className="stats-grid">
            <div className="stats-card">
              <div className="stats-icon icon-active"> 
                <FaGraduationCap />
              </div>
              <div className="stats-info">
                <h3>Active Courses</h3>
                <p className="stats-value">{courses.filter(course => course.status === 'active').length}</p>
              </div>
            </div>

            <div className="stats-card">
              <div className="stats-icon icon-archived"> 
                <FaArchive />
              </div>
              <div className="stats-info">
                <h3>Archive Courses</h3> 
                <p className="stats-value">{courses.filter(course => course.status === 'archived').length}</p>
              </div>
            </div>
            
            <div className="stats-card">
              <div className="stats-icon icon-inactive"> 
                <FaBan />
              </div>
              <div className="stats-info">
                <h3>Inactive Courses</h3>
                <p className="stats-value">{courses.filter(course => course.status === 'inactive').length}</p>
              </div>
            </div>
          </div>

          {/* Courses Section - Reverted Title */}
          <div className="dashboard-section">
            <div className="section-header">
              <h2>
                {activeTab === 'active' && 'Active Courses'}
                {activeTab === 'inactive' && 'Inactive Courses'}
                {activeTab === 'archived' && 'Archived Courses'}
              </h2> 
              <div className="section-actions">
                <div className="tab-buttons">
                  <button 
                    className={`tab-btn ${activeTab === "active" ? "active" : ""}`}
                    onClick={() => setActiveTab("active")}
                  >
                    Active
                  </button>
                  <button 
                    className={`tab-btn ${activeTab === "inactive" ? "active" : ""}`}
                    onClick={() => setActiveTab("inactive")}
                  >
                    Inactive
                  </button>
                  <button 
                    className={`tab-btn ${activeTab === "archived" ? "active" : ""}`}
                    onClick={() => setActiveTab("archived")}
                  >
                    Archived
                  </button>
                </div>
                <Link to="/courses" className="view-all-btn">View all</Link>
              </div>
            </div>
            
            {loading ? (
              <LoadingIndicator text="Loading courses" />
            ) : error ? (
              <div className="error-message">{error}</div>
            ) : filteredCourses.length === 0 ? (
              <div className="no-courses-message">
                <HiOutlineAcademicCap size={48} className="mb-4" />
                <h3>No Courses Found</h3>
                {activeTab === "active" ? (
                  <>
                    <p>You are not enrolled in any courses yet. Browse available courses or enroll using a course code.</p>
                    {userRole === "student" ? (
                      <button 
                        className="btn btn-primary mt-4"
                        onClick={() => setShowEnrollModal(true)}
                      >
                        <HiOutlinePlus className="mr-2" /> Enroll in Course
                      </button>
                    ) : (
                      <Link 
                        to="/courses" 
                        className="btn btn-primary mt-4"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate('/courses', { state: { openAddCourseModal: true } });
                        }}
                      >
                        <HiOutlinePlus className="mr-2" /> Create New Course
                      </Link>
                    )}
                  </>
                ) : (
                  <p>You don't have any archived courses.</p>
                )}
              </div>
            ) : (
              <div className="course-grid dashboard-course-grid">
                {filteredCourses.map(course => {
                  return (
                    <div 
                      key={course.course_id} 
                      className={`course-card`}
                    >
                      <div className="course-card-content"> 
                        <h3 className="course-title">
                          <Link 
                            to={`/courses/${course.course_id}/stream`} 
                            className="course-name-link"
                          >
                            {course.course_name}
                          </Link>
                        </h3>
                        <p className="course-description">{course.description}</p>
                        
                        {userRole === "professor" && course.enrollment_code && (
                          <div className="enrollment-code-container">
                            <span className="enrollment-code-label">Enrollment Code:</span> 
                            <span className="enrollment-code">{course.enrollment_code}</span>
                          </div>
                        )}
                        
                        <div className="course-meta">
                          <span>{course.semester}</span>
                          {course.section && <span>{course.section}</span>}
                          <span>{course.academic_year}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enrollment Modal */}
      {showEnrollModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Enroll in Course</h2>
              <button 
                className="close-modal"
                onClick={() => {
                  setShowEnrollModal(false);
                  setEnrollmentCode("");
                  setError(null);
                }}
              >
                <HiOutlineX />
              </button>
            </div>
            
            <form className="modal-form" onSubmit={handleEnroll}>
              <div className="form-group">
                <label htmlFor="enrollment_code">Course Enrollment Code</label>
                <input
                  type="text"
                  id="enrollment_code"
                  value={enrollmentCode}
                  onChange={(e) => {
                    setEnrollmentCode(e.target.value);
                    setError(null); // Clear error when typing
                  }}
                  placeholder="Enter course enrollment code"
                  required
                  autoFocus
                />
                <p className="help-text">Enter the enrollment code provided by your instructor.</p>
                {error && (
                  <div className="error-container">
                    <p className="error-message-text">{error}</p>
                  </div>
                )}
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn cancel-btn"
                  onClick={() => {
                    setShowEnrollModal(false);
                    setEnrollmentCode("");
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn submit-btn">
                  Enroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Action Button - only visible for students */}
      {userRole === "student" && (
        <button 
          className="floating-action-btn"
          onClick={() => setShowEnrollModal(true)}
          title="Enroll in Course"
          style={{ display: courses.filter(course => course.status === 'active').length > 0 ? 'flex' : 'none' }}
        >
          <HiOutlinePlus />
        </button>
      )}

      {/* Create Course Button - only visible for professors with active courses */}
      {userRole === "professor" && courses.filter(course => course.status === 'active').length > 0 && (
        <Link
          to="/courses"
          className="floating-action-btn professor-btn"
          title="Create New Course"
          onClick={(e) => {
            e.preventDefault();
            navigate('/courses', { state: { openAddCourseModal: true } });
          }}
        >
          <HiOutlinePlus />
        </Link>
      )}
    </div>
  );
} 