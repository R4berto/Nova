import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  HiOutlineCalendar,
  HiOutlineClipboardList,
  HiOutlinePresentationChartBar,
  HiOutlineMenu,
  HiOutlineX,
  HiOutlineHome,
  HiOutlineAcademicCap,
  HiOutlineChatAlt2,
  HiOutlineCog,
  HiOutlineLogout,
  HiOutlineChevronDown,
  HiOutlineUserGroup,
  HiOutlineAnnotation,
  HiOutlineNewspaper,
  HiOutlinePencilAlt,
  HiOutlineSearch,
  HiOutlineSortAscending,
  HiOutlineSortDescending
} from "react-icons/hi";
import Sidebar from './Sidebar';
import LoadingIndicator from './common/LoadingIndicator';
import './dashboard.css';
import './ToDoList.css';

const ToDoList = ({ setAuth }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [allUpcomingItems, setAllUpcomingItems] = useState({
    assignments: [],
    exams: []
  });
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState === "true";
  });
  const [inputs, setInputs] = useState({
    first_name: "",
    last_name: "",
    profilePicture: null
  });
  const { first_name, last_name } = inputs;

  // Add sorting state
  const [sortConfig, setSortConfig] = useState({
    field: 'due_date',
    direction: 'asc'
  });
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Add search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [showSearchMenu, setShowSearchMenu] = useState(false);

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

  const fetchUserRole = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No token found");
      }
      const response = await fetch("http://localhost:5000/auth/user-role", {
        headers: {
          jwt_token: token
        }
      });
      if (!response.ok) {
        if (response.status === 401) {
          // Handle unauthorized
        }
        throw new Error("Failed to fetch user role");
      }
      const data = await response.json();
      setUserRole(data.role);
    } catch (err) {
      console.error("Error fetching user role:", err);
    }
  }, [navigate, setAuth]);

  const getProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch("http://localhost:5000/dashboard/", {
        method: "GET",
        headers: { jwt_token: token }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch profile from dashboard');
      }
      const parseData = await res.json();

      setInputs(prevState => ({
        ...prevState,
        first_name: parseData.first_name,
        last_name: parseData.last_name,
        profilePicture: parseData.profile_picture_url || null
      }));
      setUserProfile({
        user_id: parseData.user_id || parseData.id,
        first_name: parseData.first_name,
        last_name: parseData.last_name,
        role: userRole || parseData.role,
        profile_picture_url: parseData.profile_picture_url || null
      });
    } catch (err) {
      console.error("Error fetching profile:", err.message);
      try {
        const profileResponse = await fetch(`http://localhost:5000/user/profile`, {
          method: "GET",
          headers: { 
            "jwt_token": localStorage.token,
            "token": localStorage.token
          }
        });
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setInputs(prevState => ({
            ...prevState,
            first_name: profileData.first_name,
            last_name: profileData.last_name,
            profilePicture: profileData.profile_picture_url || null
          }));
          setUserProfile({
            user_id: profileData.user_id,
            first_name: profileData.first_name,
            last_name: profileData.last_name,
            role: userRole || profileData.role,
            profile_picture_url: profileData.profile_picture_url || null
          });
        }
      } catch (fallbackError) {
        console.error("Error fetching fallback profile:", fallbackError.message);
        setError("Failed to load user profile.");
      }
    }
  }, [userRole]);

  const logout = async (e) => {
    e.preventDefault();
    try {
      localStorage.removeItem("token");
      if(setAuth) setAuth(false);
      toast.success("Logged out successfully!");
      navigate("/login");
    } catch (err) {
      console.error(err.message);
    }
  };

  // Fetch user courses
  useEffect(() => {
    const fetchCourses = async () => {
      setLoadingCourses(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        // Only fetch student courses since this is for students only
        const endpoint = 'http://localhost:5000/enrollment/student-courses';
        const response = await fetch(endpoint, {
          headers: { jwt_token: token }
        });
        if (!response.ok) throw new Error('Failed to fetch courses');
        const data = await response.json();
        
        // Filter only active courses
        const activeCourses = Array.isArray(data) ? data.filter(course => 
          course.status !== 'archived' && course.status !== 'inactive'
        ) : [];
        
        setCourses(activeCourses);
      } catch (err) {
        console.error('Error fetching courses:', err);
        setCourses([]);
      } finally {
        setLoadingCourses(false);
      }
    };
    
    if (userRole) {
      fetchCourses();
    }
  }, [userRole]);

  // Fetch all upcoming items from all active courses
  const fetchAllUpcomingItems = useCallback(async () => {
    if (!courses.length) return;
    
    setLoadingUpcoming(true);
    try {
      const allAssignments = [];
      const allExams = [];
      
      // Fetch upcoming items for each course
      for (const course of courses) {
        try {
          // Fetch upcoming assignments for this course
          const assignmentsResponse = await fetch(`http://localhost:5000/assignments/upcoming/${course.course_id}`, {
            method: "GET",
            headers: { 
              "jwt_token": localStorage.token, 
              "token": localStorage.token 
            }
          });
          
          // Fetch upcoming exams for this course
          const examsResponse = await fetch(`http://localhost:5000/exams/upcoming/${course.course_id}`, {
            method: "GET",
            headers: { 
              "jwt_token": localStorage.token, 
              "token": localStorage.token 
            }
          });
          
          // Fetch overdue assignments for this course
          const overdueAssignmentsResponse = await fetch(`http://localhost:5000/assignments/overdue/${course.course_id}`, {
            method: "GET",
            headers: { 
              "jwt_token": localStorage.token, 
              "token": localStorage.token 
            }
          });
          
          // Fetch overdue exams for this course
          const overdueExamsResponse = await fetch(`http://localhost:5000/exams/overdue/${course.course_id}`, {
            method: "GET",
            headers: { 
              "jwt_token": localStorage.token, 
              "token": localStorage.token 
            }
          });
          
          // Fetch student's exam submissions for this course
          const studentExamSubmissionsResponse = await fetch(`http://localhost:5000/student-exams/submissions/${course.course_id}`, {
            method: "GET",
            headers: { 
              "jwt_token": localStorage.token, 
              "token": localStorage.token 
            }
          });
          
          // Fetch student's assignment submissions for this course
          const studentAssignmentSubmissionsResponse = await fetch(`http://localhost:5000/assignments/${course.course_id}/student-submissions`, {
            method: "GET",
            headers: { 
              "jwt_token": localStorage.token, 
              "token": localStorage.token 
            }
          });
          
          let assignments = [];
          let exams = [];
          let overdueAssignments = [];
          let overdueExams = [];
          let studentExamSubmissions = [];
          let studentAssignmentSubmissions = [];
          
          if (assignmentsResponse.ok) {
            assignments = await assignmentsResponse.json();
          }
          
          if (examsResponse.ok) {
            exams = await examsResponse.json();
          }
          
          if (overdueAssignmentsResponse.ok) {
            overdueAssignments = await overdueAssignmentsResponse.json();
          }
          
          if (overdueExamsResponse.ok) {
            overdueExams = await overdueExamsResponse.json();
          }
          
          if (studentExamSubmissionsResponse.ok) {
            studentExamSubmissions = await studentExamSubmissionsResponse.json();
          }
          
          if (studentAssignmentSubmissionsResponse.ok) {
            studentAssignmentSubmissions = await studentAssignmentSubmissionsResponse.json();
          }
          
          // Filter out submitted items
          const submittedExamIds = studentExamSubmissions.map(submission => submission.exam_id);
          const submittedAssignmentIds = studentAssignmentSubmissions.map(submission => submission.assignment_id);
          
          const filteredExams = exams.filter(exam => !submittedExamIds.includes(exam.exam_id));
          const filteredOverdueExams = overdueExams.filter(exam => !submittedExamIds.includes(exam.exam_id))
            .map(exam => ({...exam, isOverdue: true}));
          
          const filteredAssignments = assignments.filter(assignment => !submittedAssignmentIds.includes(assignment.assignment_id));
          
          // Add course information to each item
          const courseAssignments = [
            ...filteredAssignments.map(item => ({...item, course_name: course.course_name, course_id: course.course_id})),
            ...overdueAssignments.map(item => ({...item, isOverdue: true, course_name: course.course_name, course_id: course.course_id}))
          ];
          
          const courseExams = [
            ...filteredExams.map(item => ({...item, course_name: course.course_name, course_id: course.course_id})),
            ...filteredOverdueExams.map(item => ({...item, course_name: course.course_name, course_id: course.course_id}))
          ];
          
          allAssignments.push(...courseAssignments);
          allExams.push(...courseExams);
          
        } catch (courseError) {
          console.error(`Error fetching items for course ${course.course_id}:`, courseError);
        }
      }
      
      // Sort all items by due date
      const sortedAssignments = allAssignments.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      const sortedExams = allExams.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      
      setAllUpcomingItems({
        assignments: sortedAssignments,
        exams: sortedExams
      });
      
    } catch (error) {
      console.error('Error fetching all upcoming items:', error);
      setAllUpcomingItems({ assignments: [], exams: [] });
    } finally {
      setLoadingUpcoming(false);
    }
  }, [courses]);

  useEffect(() => {
    if (courses.length > 0) {
      fetchAllUpcomingItems();
    }
  }, [courses, fetchAllUpcomingItems]);

  useEffect(() => {
    const loadUserData = async () => {
      await fetchUserRole();
      await getProfile();
      setLoading(false);
    };
    loadUserData();
  }, [fetchUserRole, getProfile]);

  // Format upcoming date in a user-friendly format
  const formatUpcomingDate = (dateString, isOverdue = false) => {
    if (!dateString) return 'No due date';
    
    const dueDate = new Date(dateString);
    const now = new Date();
    
    // Format date
    const formattedDate = dueDate.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric'
    });
    
    // Add time if it's not midnight
    const formattedTime = dueDate.getHours() || dueDate.getMinutes() 
      ? dueDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : '';
    
    // If it's marked as overdue, or the date is in the past
    if (isOverdue || dueDate < now) {
      const diffTime = now - dueDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (diffDays === 0) {
        if (diffHours < 1) {
          return `Just overdue (${formattedDate} ${formattedTime})`;
        }
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} overdue (${formattedDate})`;
      } else if (diffDays === 1) {
        return `1 day overdue (${formattedDate})`;
      }
      return `${diffDays} days overdue (${formattedDate})`;
    }
    
    // Calculate difference in days and hours for upcoming items
    const diffTime = dueDate - now;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    // Check if it's the same day by comparing year, month, and day
    const isSameDay = now.getFullYear() === dueDate.getFullYear() && 
                      now.getMonth() === dueDate.getMonth() && 
                      now.getDate() === dueDate.getDate();
    
    // Check if it's tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = tomorrow.getFullYear() === dueDate.getFullYear() && 
                       tomorrow.getMonth() === dueDate.getMonth() && 
                       tomorrow.getDate() === dueDate.getDate();
    
    // Return appropriate string based on due date
    if (isSameDay) {
      if (diffHours < 6) {
        return `Due today at ${formattedTime} (${diffHours}h remaining)`;
      }
      return `Due today at ${formattedTime}`;
    } else if (isTomorrow) {
      return `Due tomorrow at ${formattedTime}`;
    } else if (diffDays === 0) {
      // Less than 24 hours but not same calendar day
      if (diffHours < 6) {
        return `Due soon at ${formattedTime} (${diffHours}h remaining)`;
      }
      return `Due today at ${formattedTime}`;
    } else if (diffDays < 7) {
      return `Due in ${diffDays} days (${formattedDate} at ${formattedTime})`;
    } else {
      return `Due on ${formattedDate} at ${formattedTime}`;
    }
  };

  // Sort function
  const sortItems = useCallback((items, field, direction) => {
    if (!items || items.length === 0) return items;

    const sortedItems = [...items].sort((a, b) => {
      let aValue, bValue;

      switch (field) {
        case 'due_date':
          aValue = a.due_date ? new Date(a.due_date).getTime() : 0;
          bValue = b.due_date ? new Date(b.due_date).getTime() : 0;
          break;
        case 'course_name':
          aValue = (a.course_name || '').toLowerCase();
          bValue = (b.course_name || '').toLowerCase();
          break;
        case 'title':
          aValue = (a.title || '').toLowerCase();
          bValue = (b.title || '').toLowerCase();
          break;
        case 'urgency':
          // Overdue items first, then due soon, then regular
          const now = new Date();
          const aDueDate = a.due_date ? new Date(a.due_date) : null;
          const bDueDate = b.due_date ? new Date(b.due_date) : null;
          
          const aIsOverdue = a.isOverdue || (aDueDate && aDueDate < now);
          const bIsOverdue = b.isOverdue || (bDueDate && bDueDate < now);
          
          const aIsDueSoon = !aIsOverdue && aDueDate && (aDueDate - now) < 6 * 60 * 60 * 1000;
          const bIsDueSoon = !bIsOverdue && bDueDate && (bDueDate - now) < 6 * 60 * 60 * 1000;
          
          if (aIsOverdue && !bIsOverdue) return -1;
          if (!aIsOverdue && bIsOverdue) return 1;
          if (aIsDueSoon && !bIsDueSoon) return -1;
          if (!aIsDueSoon && bIsDueSoon) return 1;
          
          // If same urgency, sort by due date
          aValue = aDueDate ? aDueDate.getTime() : 0;
          bValue = bDueDate ? bDueDate.getTime() : 0;
          break;
        default:
          aValue = a[field] || '';
          bValue = b[field] || '';
      }

      if (aValue < bValue) {
        return direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sortedItems;
  }, []);

  // Search function
  const searchItems = useCallback((items, term, field) => {
    if (!term.trim()) return items;
    
    const searchLower = term.toLowerCase().trim();
    
    return items.filter(item => {
      switch (field) {
        case 'title':
          return (item.title || '').toLowerCase().includes(searchLower);
        case 'course_name':
          return (item.course_name || '').toLowerCase().includes(searchLower);
        case 'all':
        default:
          return (
            (item.title || '').toLowerCase().includes(searchLower) ||
            (item.course_name || '').toLowerCase().includes(searchLower) ||
            (item.due_date ? formatUpcomingDate(item.due_date, item.isOverdue).toLowerCase() : '').includes(searchLower)
          );
      }
    });
  }, []);

  // Get filtered and sorted items
  const getFilteredAndSortedItems = useCallback(() => {
    const { field, direction } = sortConfig;
    
    // First filter items
    const filteredAssignments = searchItems(allUpcomingItems.assignments, searchTerm, searchField);
    const filteredExams = searchItems(allUpcomingItems.exams, searchTerm, searchField);
    
    // Then sort filtered items
    const sortedAssignments = sortItems(filteredAssignments, field, direction);
    const sortedExams = sortItems(filteredExams, field, direction);
    
    return {
      assignments: sortedAssignments,
      exams: sortedExams
    };
  }, [allUpcomingItems, searchTerm, searchField, sortConfig, searchItems, sortItems]);

  // Handle sort change
  const handleSortChange = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setShowSortMenu(false);
  };

  // Get sort icon
  const getSortIcon = (field) => {
    if (sortConfig.field !== field) return null;
    return sortConfig.direction === 'asc' ? <HiOutlineSortAscending /> : <HiOutlineSortDescending />;
  };

  // Get sort label
  const getSortLabel = (field) => {
    const labels = {
      'due_date': 'Due Date',
      'course_name': 'Course',
      'title': 'Title',
      'urgency': 'Urgency'
    };
    return labels[field] || field;
  };

  // Get search field label
  const getSearchFieldLabel = (field) => {
    const labels = {
      'all': 'All Fields',
      'title': 'Title',
      'course_name': 'Course'
    };
    return labels[field] || field;
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
    setSearchField('all');
    setShowSearchMenu(false);
  };

  if (loading) {
    return (
      <div className="dashboard-container dashboard-page">
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={{width: '280px', borderRight: '1px solid #e0e0e0'}}> 
          <div style={{padding: '24px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap:'12px', marginBottom: '36px'}}>
              <div style={{width: '40px', height:'40px', background:'#eee', borderRadius:'12px'}}></div>
              <div style={{height: '24px', width:'80px', background:'#eee', borderRadius:'4px'}}></div>
            </div>
          </div>
        </div>
        <div className="main-content" style={{marginLeft: '280px'}}>
          <div className="content-wrapper">
            <div className="top-bar" style={{height: '60px', borderBottom: '1px solid #e0e0e0', marginBottom:'24px'}}></div> 
            <LoadingIndicator text="Loading to do list" />
          </div>
        </div>
      </div>
    );
  }

  // Redirect if not a student
  if (userRole !== 'student') {
    return (
      <div className="dashboard-container dashboard-page">
        <div className="main-content">
          <div className="content-wrapper">
            <div className="error-message">
              <h2>Access Denied</h2>
              <p>This page is only available for students.</p>
              <button onClick={() => navigate('/dashboard')} className="btn-primary">
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container dashboard-page">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobile={isMobile}
        userRole={userRole}
        courses={courses}
        loading={loadingCourses}
        userProfile={{
          first_name,
          last_name,
          profile_picture_url: inputs.profilePicture
        }}
        onLogout={logout}
        activePath={window.location.pathname}
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
                  <div className="user-name">{first_name} {last_name}</div>
                  <div className="user-role">{userRole || 'Loading...'}</div>
                </div>
                {inputs.profilePicture ? (
                  <div className="avatar" onClick={() => navigate("/settings")} style={{ cursor: 'pointer' }}>
                    <img src={inputs.profilePicture} alt="Profile" />
                  </div>
                ) : (
                  <div className="avatar" onClick={() => navigate("/settings")} style={{ cursor: 'pointer' }}>
                    {first_name && last_name ? `${first_name[0]}${last_name[0]}` : ""}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="todo-main-area">
            <div className="todo-header">
              <h1>My To Do List</h1>
              <p>All upcoming assignments and exams from your active courses</p>
            </div>

            {error && <div className="error-message">{error}</div>}

            {loadingUpcoming ? (
              <div className="todo-loading">
                <LoadingIndicator text="Loading your to do items" />
              </div>
            ) : (
              <div className="todo-content">
                {allUpcomingItems.assignments.length === 0 && allUpcomingItems.exams.length === 0 ? (
                  <div className="empty-todo-state">
                    <div className="empty-icon">
                      <HiOutlineCalendar size={64} />
                    </div>
                    <h2>No items to complete</h2>
                    <p>You're all caught up! No upcoming assignments or exams.</p>
                  </div>
                ) : (
                  <>
                    {/* Search and Sort Controls */}
                    <div className="todo-controls">
                      {/* Search Controls */}
                      <div className="search-container">
                        <div className="search-input-wrapper">
                          <HiOutlineSearch className="search-icon" />
                          <input
                            type="text"
                            placeholder="Search items..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                          />
                          {searchTerm && (
                            <button 
                              onClick={clearSearch}
                              className="clear-search-btn"
                              title="Clear search"
                            >
                              <HiOutlineX />
                            </button>
                          )}
                        </div>
                        <div className="search-field-container">
                          <button 
                            className="search-field-button"
                            onClick={() => setShowSearchMenu(!showSearchMenu)}
                          >
                            {getSearchFieldLabel(searchField)}
                            <HiOutlineChevronDown className={`search-arrow ${showSearchMenu ? 'open' : ''}`} />
                          </button>
                          {showSearchMenu && (
                            <div className="search-field-menu">
                              {['all', 'title', 'course_name'].map(field => (
                                <button
                                  key={field}
                                  className={`search-field-option ${searchField === field ? 'active' : ''}`}
                                  onClick={() => {
                                    setSearchField(field);
                                    setShowSearchMenu(false);
                                  }}
                                >
                                  {getSearchFieldLabel(field)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Sort Controls */}
                      <div className="sort-container">
                        <button 
                          className="sort-button"
                          onClick={() => setShowSortMenu(!showSortMenu)}
                        >
                          <HiOutlineSortAscending />
                          Sort by: {getSortLabel(sortConfig.field)}
                          <HiOutlineChevronDown className={`sort-arrow ${showSortMenu ? 'open' : ''}`} />
                        </button>
                        {showSortMenu && (
                          <div className="sort-menu">
                            {['urgency', 'due_date', 'course_name', 'title'].map(field => (
                              <button
                                key={field}
                                className={`sort-option ${sortConfig.field === field ? 'active' : ''}`}
                                onClick={() => handleSortChange(field)}
                              >
                                {getSortLabel(field)}
                                {getSortIcon(field)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Results Info */}
                      <div className="results-info">
                        {(() => {
                          const filteredItems = getFilteredAndSortedItems();
                          const totalItems = filteredItems.assignments.length + filteredItems.exams.length;
                          const originalTotal = allUpcomingItems.assignments.length + allUpcomingItems.exams.length;
                          
                          if (searchTerm && totalItems !== originalTotal) {
                            return `${totalItems} of ${originalTotal} items`;
                          }
                          return `${totalItems} item${totalItems !== 1 ? 's' : ''} total`;
                        })()}
                      </div>
                    </div>

                    <div className="todo-sections">
                      {(() => {
                        const filteredItems = getFilteredAndSortedItems();
                        
                        // Show no results message if search has no matches
                        if (searchTerm && filteredItems.assignments.length === 0 && filteredItems.exams.length === 0) {
                          return (
                            <div className="no-search-results">
                              <div className="no-results-icon">
                                <HiOutlineSearch size={48} />
                              </div>
                              <h3>No items found</h3>
                              <p>No items match your search for "{searchTerm}"</p>
                              <button onClick={clearSearch} className="clear-search-link">
                                Clear search
                              </button>
                            </div>
                          );
                        }
                        
                        return (
                          <>
                            {filteredItems.assignments.length > 0 && (
                              <div className="todo-section">
                                <h2 className="section-title">
                                  <HiOutlineClipboardList className="section-icon" />
                                  Assignments ({filteredItems.assignments.length})
                                </h2>
                                <div className="todo-items">
                                  {filteredItems.assignments.map((assignment) => {
                                    const isPastDue = assignment.isOverdue || (assignment.due_date && new Date(assignment.due_date) < new Date());
                                    return (
                                      <div 
                                        key={`asg-${assignment.assignment_id}`} 
                                        className="todo-item" 
                                        data-past-due={isPastDue}
                                        onClick={() => navigate(`/courses/${assignment.course_id}/assignments?assignmentId=${assignment.assignment_id}`)}
                                      >
                                        <div className="todo-item-content">
                                          <div className="todo-item-header">
                                            <div className="todo-item-title">{assignment.title}</div>
                                            <div className="todo-item-course">{assignment.course_name}</div>
                                          </div>
                                          <div 
                                            className="todo-item-due"
                                            data-past-due={isPastDue}
                                            data-due-soon={!isPastDue && assignment.due_date && new Date(assignment.due_date) - new Date() < 6 * 60 * 60 * 1000}
                                          >
                                            {formatUpcomingDate(assignment.due_date, assignment.isOverdue)}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                            {filteredItems.exams.length > 0 && (
                              <div className="todo-section">
                                <h2 className="section-title">
                                  <HiOutlinePresentationChartBar className="section-icon" />
                                  Exams ({filteredItems.exams.length})
                                </h2>
                                <div className="todo-items">
                                  {filteredItems.exams.map((exam) => {
                                    const isPastDue = exam.due_date && new Date(exam.due_date) < new Date();
                                    return (
                                      <div 
                                        key={`exam-${exam.exam_id}`} 
                                        className="todo-item"
                                        data-past-due={isPastDue}
                                        onClick={() => navigate(`/courses/${exam.course_id}/exams/${exam.exam_id}`)}
                                      >
                                        <div className="todo-item-content">
                                          <div className="todo-item-header">
                                            <div className="todo-item-title">{exam.title}</div>
                                            <div className="todo-item-course">{exam.course_name}</div>
                                          </div>
                                          <div 
                                            className="todo-item-due"
                                            data-past-due={isPastDue}
                                            data-due-soon={!isPastDue && exam.due_date && new Date(exam.due_date) - new Date() < 6 * 60 * 60 * 1000}
                                          >
                                            {formatUpcomingDate(exam.due_date)}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToDoList; 