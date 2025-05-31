import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { MdSettings, MdMoreVert, MdErrorOutline, MdRefresh, MdPersonRemove, MdBlock } from 'react-icons/md';
import { FaCheckCircle } from 'react-icons/fa';
import { 
    HiOutlineBell,
    HiOutlineHome,
    HiOutlineAcademicCap,
    HiOutlineCog,
    HiOutlineArchive,
    HiOutlineBan,
    HiOutlineChevronDown,
    HiOutlineUserGroup,
    HiOutlineCalendar,
    HiOutlineNewspaper,
    HiOutlineSearch,
    HiOutlinePresentationChartBar, 
    HiUserPlus
} from "react-icons/hi2";
import { 
    HiOutlineX, 
    HiOutlineClipboardList, 
    HiOutlineAnnotation, 
    HiOutlinePencilAlt, 
    HiOutlineChatAlt2, 
    HiOutlineLogout,
    HiOutlineMenu,
    HiOutlineChevronLeft,
    HiOutlineChevronRight
} from "react-icons/hi";
import './People.css';
import '../dashboard.css';
import Sidebar from '../Sidebar';

const People = ({ setAuth }) => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [courseMembers, setCourseMembers] = useState({ teachers: [], students: [], banned: [], studentCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState({});
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [courseDetails, setCourseDetails] = useState(null);
  
  // Restore State
  const [inputs, setInputs] = useState({
    first_name: "",
    last_name: "",
    profilePicture: null
  });
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [searchTerm, setSearchTerm] = useState("") // Keep if search is needed later
  const [userRole, setUserRole] = useState(null)
  const { first_name, last_name } = inputs; // Keep for display
  const [isTeacher, setIsTeacher] = useState(false);
  const [isCoursesSubmenuOpen, setIsCoursesSubmenuOpen] = useState(false);
  // Add state for the active tab (students or banned)
  const [activePeopleTab, setActivePeopleTab] = useState('students');
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Try to get the sidebar state from localStorage
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState === "true";
  });

  // Restore Mobile Check Effect
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

  // Restore Fetch User Role Function
  const fetchUserRole = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        // Redirect or handle missing token, maybe setAuth(false)
        console.error("No token found, cannot fetch user role.");
        if(setAuth) setAuth(false); 
        navigate("/login"); // Or appropriate action
        return; 
      }
      const response = await fetch("http://localhost:5000/auth/user-role", { // Use correct endpoint
        headers: { 
          jwt_token: token // Use correct header key
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch user role: ${errorText}`);
      }
      const data = await response.json();
      console.log("Fetched user role:", data.role);
      setUserRole(data.role);
      setIsTeacher(data.role === 'professor');
    } catch (err) {
      console.error("Error fetching user role:", err);
      // Handle error, maybe redirect or show message
      if(err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          setError("Could not connect to the server to verify your role.");
      } else {
          setError("An error occurred while fetching your role.");
      }
      // Potentially logout if role fetch fails critically
      // localStorage.removeItem("token");
      // if(setAuth) setAuth(false);
      // navigate("/login");
    }
  }, [navigate, setAuth]);

  // Restore Get Profile Function
  const getProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
          console.error("No token found, cannot fetch profile.");
          if(setAuth) setAuth(false);
          navigate("/login");
          return; // Stop execution if no token
        }

      const res = await fetch("http://localhost:5000/dashboard/", { // Ensure endpoint is correct
        method: "GET",
        headers: { jwt_token: token } // Use correct header key
      });

      if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to fetch profile: ${errorText}`);
      }
      const parseData = await res.json();
      console.log("Fetched profile data:", parseData);
      
      setInputs(prevState => ({
        ...prevState,
        first_name: parseData.first_name || '', // Provide defaults
        last_name: parseData.last_name || '',
        profilePicture: parseData.profile_picture_url || null
      }));

      // If userRole hasn't been set yet (e.g., by fetchUserRole), set it now.
      // Also update isTeacher based on profile data if needed.
      if (!userRole) {
        console.log("Setting role from profile data:", parseData.role);
        setUserRole(parseData.role);
        setIsTeacher(parseData.role === 'professor');
      } else if (userRole !== parseData.role) {
         console.warn("Role mismatch between /auth/user-role and /dashboard/", userRole, parseData.role);
         // Decide which source of truth to trust or how to handle mismatch
         setIsTeacher(parseData.role === 'professor'); // Update based on profile potentially
      }


    } catch (err) {
      console.error("Error fetching profile:", err.message);
       if(err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          setError("Could not connect to the server to fetch your profile.");
      } else {
          setError("An error occurred while fetching your profile information.");
      }
      // Potentially logout
      // localStorage.removeItem("token");
      // if(setAuth) setAuth(false);
      // navigate("/login");
    }
  }, [navigate, setAuth, userRole]); // Add userRole dependency

  // Restore Logout Function
  const logout = async (e) => {
    e.preventDefault()
    try {
      localStorage.removeItem("token")
      if(setAuth) setAuth(false)
      navigate("/login")
    } catch (err) {
      console.error(err.message)
    }
  }
  
  // Restore Toggle Courses Submenu Function
  const toggleCoursesSubmenu = (e) => {
    e.preventDefault();
    setIsCoursesSubmenuOpen(!isCoursesSubmenuOpen);
  };

   // Restore Initial Load Effect
   useEffect(() => {
    const initialLoad = async () => {
      console.log("Starting initial load...");
      setLoading(true);
      setError(null); // Clear previous errors
      await fetchUserRole(); // Fetch role first
      await getProfile();   // Then fetch profile
      await fetchCourseMembers(); // Fetch members
      await fetchCourseDetails(); // Fetch course details including status
      setLoading(false);
      console.log("Initial load finished.");
    }
    initialLoad();
  }, [courseId, fetchUserRole, getProfile]); // Add fetchCourseDetails dependency


  // Restore fetchCourseMembers Function (with useCallback)
  const fetchCourseMembers = useCallback(async () => {
    console.log("Fetching course members for course:", courseId);
    // Don't set loading here if called within initialLoad
    // setLoading(true); 
    setError(null); 
    try {
      const token = localStorage.token;
      if (!token) {
        throw new Error('No authentication token found');
      }
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/enrollment/course-members/${courseId}`, {
        method: "GET",
        headers: { 
          "Content-Type": "application/json",
          "jwt_token": token,
          // "token": token // Removed redundant token header unless specifically needed by backend
        }
      });
      console.log('Course Members Response status:', response.status);
      if (!response.ok) {
        let errorData = {};
        try {
            errorData = await response.json();
        } catch (e) {
             errorData.msg = await response.text() || `Server returned status ${response.status}`;
        }
        console.error('Server error response (Course Members):', errorData);
        throw new Error(errorData.error || errorData.msg || `Failed to fetch course members (${response.status})`);
      }
      const data = await response.json();
       console.log('Received course members data:', data);
      if (!data || typeof data !== 'object' || !Array.isArray(data.teachers) || !Array.isArray(data.students)) {
        console.error('Invalid data format received:', data);
        throw new Error('Invalid data format received from server');
      }
      setCourseMembers({ 
        teachers: data.teachers || [], 
        students: data.students || [], 
        // Add banned students from response, default to empty array
        banned: data.banned || [], 
        // Calculate student count from the array length for reliability
        studentCount: Array.isArray(data.students) ? data.students.length : 0 
      });
    } catch (err) {
      console.error("Error in fetchCourseMembers:", err);
      setError(err.message || 'Failed to fetch course members');
      if (err.message.includes('not valid') || err.message.includes('No authentication token found')) {
        // Redirect to login if token is invalid
        console.log("Authentication error, redirecting to login.");
        localStorage.removeItem("token");
        if(setAuth) setAuth(false);
        navigate("/login");
    }
    } finally {
        // Ensure loading is set to false even if fetchCourseMembers is called independently
         if (loading) setLoading(false); 
    }
  }, [courseId, setAuth, navigate, loading]); // Added navigate and loading dependencies

  // Function to fetch course details (including status)
  const fetchCourseDetails = useCallback(async () => {
    console.log("Fetching course details for course:", courseId);
    try {
      const token = localStorage.token;
      if (!token) throw new Error('No authentication token found');

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/courses/${courseId}`, {
        method: "GET",
        headers: { "jwt_token": token }
      });

      if (!response.ok) {
        // Try fetching from professor/student specific endpoints as fallback (like in Stream.js)
        let foundCourse = null;
        try {
          const professorResponse = await fetch(`http://localhost:5000/courses/professor`, { method: "GET", headers: { "jwt_token": token } });
          if (professorResponse.ok) {
            const professorCourses = await professorResponse.json();
            foundCourse = professorCourses.find(c => c.course_id === parseInt(courseId));
          }
        } catch { /* Ignore fetch errors */ }

        if (!foundCourse) {
          try {
            const studentResponse = await fetch(`http://localhost:5000/enrollment/student-courses`, { method: "GET", headers: { "jwt_token": token } });
            if (studentResponse.ok) {
              const studentCourses = await studentResponse.json();
              foundCourse = studentCourses.find(c => c.course_id === parseInt(courseId));
            }
          } catch { /* Ignore fetch errors */ }
        }

        if (foundCourse && foundCourse.status) { // Ensure status is included
          setCourseDetails(foundCourse);
          console.log('Fetched course details via fallback:', foundCourse);
          return; // Exit if fallback successful
        } else {
          // If no fallback found or status missing, throw error
          let errorData = {};
          try { errorData = await response.json(); } catch { errorData.msg = await response.text() || `Server returned status ${response.status}`; }
          console.error('Server error response (Course Details):', errorData);
          throw new Error(errorData.error || errorData.msg || `Failed to fetch course details (${response.status})`);
        }
      }

      const data = await response.json();
      console.log('Received course details data:', data);
      if (!data || !data.status) { // Ensure status is included
         console.error('Invalid data format received or status missing:', data);
         throw new Error('Invalid course data format received from server');
      }
      setCourseDetails(data);
      
    } catch (err) {
      console.error("Error in fetchCourseDetails:", err);
      setError(prevError => prevError || err.message || 'Failed to fetch course details'); // Keep existing member fetch error if present
       if (err.message.includes('No authentication token found')) {
           localStorage.removeItem("token");
           if(setAuth) setAuth(false);
           navigate("/login");
       }
       // Set a default/empty details object?
       // setCourseDetails({ status: 'unknown' }); 
    }
    // No finally block setting loading to false, as it's part of initialLoad
  }, [courseId, setAuth, navigate]);

   // Restore Kick Student Function - update to close new state
  const kickStudent = async (userId) => {
     setShowActionMenu({}); // Close all menus using new state setter
    try {
      if (!isTeacher) {
        alert("Only professors can remove students from the course.");
        return;
      }

      const confirmed = window.confirm("Are you sure you want to unenroll this student from the course? They can rejoin later.");
      if (!confirmed) return;

      const token = localStorage.token;
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/enrollment/kick/${courseId}/${userId}`, {
        method: "DELETE",
        headers: { 
          "Content-Type": "application/json",
          "jwt_token": token,
          // "token": token // Removed redundant token
        }
      });

       // Check for successful no-content response
      if (response.status === 204) {
        alert("Student has been unenrolled from the course.");
        fetchCourseMembers(); // Refresh list after success
        return;
      }
      
      if (!response.ok) {
        let errorMessage = 'Failed to unenroll student';
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.msg || errorMessage;
          } else {
            const textResponse = await response.text();
            errorMessage = textResponse || errorMessage;
            console.error('Non-JSON error response:', textResponse);
          }
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
           errorMessage = `Failed to unenroll student. Server returned status ${response.status}.`;
        }
        throw new Error(errorMessage);
      }

       // Fallback success handling (if API returns 200 OK instead of 204)
      alert("Student has been unenrolled from the course.");
       fetchCourseMembers(); // Refresh list
    } catch (err) {
      console.error("Error unenrolling student:", err);
      alert(`Error: ${err.message}` || 'Failed to unenroll student');
       if (err.message.includes('No authentication token found')) {
           localStorage.removeItem("token");
           if(setAuth) setAuth(false);
           navigate("/login");
       }
    }
  };

  // Rename function from banStudent to blocklistStudent for clarity
  const blocklistStudent = async (userId) => {
    setShowActionMenu({}); 
    try {
      if (!isTeacher) {
        alert("Only professors can add students to the blocklist.");
        return;
      }

      const confirmed = window.confirm("Are you sure you want to add this student to the blocklist? They will NOT be able to rejoin the course in the future.");
      if (!confirmed) return;

      const token = localStorage.token;
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/enrollment/ban/${courseId}/${userId}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "jwt_token": token
        }
      });

      if (response.status === 204 || response.status === 200 || response.status === 201) { 
        alert("Student has been added to the course blocklist and cannot rejoin.");

        // Optimistic UI Update
        console.log(`Attempting optimistic blocklist for userId: ${userId}`);
        console.log('Current students in state:', JSON.stringify(courseMembers.students, null, 2));
        
        const studentToBlock = courseMembers.students.find(s => s.user_id === userId);
        if (studentToBlock) {
          console.log('Optimistically updating UI after adding to blocklist...');
          setCourseMembers(prev => {
            const updatedStudents = prev.students.filter(s => s.user_id !== userId);
            // Ensure not to add duplicates if already present
            const alreadyBlocked = prev.banned.some(b => b.user_id === userId);
            const updatedBanned = alreadyBlocked ? prev.banned : [...prev.banned, studentToBlock];
            
            return {
              ...prev,
              students: updatedStudents,
              banned: updatedBanned,
              studentCount: updatedStudents.length
            };
          });
        } else {
          console.warn('Could not find student in local state for optimistic blocklist update.');
        }

        fetchCourseMembers(); // Refresh list from server to confirm
        return;
      }
      
      if (!response.ok) {
        let errorMessage = 'Failed to add student to blocklist';
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.msg || errorMessage;
          } else {
            const textResponse = await response.text();
            errorMessage = textResponse || errorMessage;
            console.error('Non-JSON error response:', textResponse);
          }
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          errorMessage = `Failed to add student to blocklist. Server returned status ${response.status}.`;
        }
        throw new Error(errorMessage);
      }

      // Fallback success handling 
      alert("Student has been added to the course blocklist and cannot rejoin.");
      fetchCourseMembers(); // Refresh list
    } catch (err) {
      console.error("Error adding student to blocklist:", err);
      alert(`Error: ${err.message}` || 'Failed to add student to blocklist');
      if (err.message.includes('No authentication token found')) {
        localStorage.removeItem("token");
        if(setAuth) setAuth(false);
        navigate("/login");
      }
    }
  };

  // Function to remove a student from the blocklist
  const removeFromBlocklist = async (userId) => {
    try {
      if (!isTeacher) {
        alert("Only professors can remove students from the blocklist.");
        return;
      }

      const confirmed = window.confirm("Are you sure you want to remove this student from the blocklist? They will be able to rejoin the course.");
      if (!confirmed) return;

      const token = localStorage.token;
      if (!token) throw new Error('No authentication token found');

      // Use unban endpoint
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/enrollment/unban/${courseId}/${userId}`, {
        method: "POST", 
        headers: { 
          "Content-Type": "application/json",
          "jwt_token": token
        }
      });

      // Check for successful response
      if (response.ok) {
        alert("Student has been removed from the blocklist and can rejoin the course.");
        fetchCourseMembers(); // Refresh list after success
      } else {
        let errorMessage = 'Failed to remove student from blocklist';
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.msg || errorMessage;
          } else {
            const textResponse = await response.text();
            errorMessage = textResponse || errorMessage;
          }
        } catch (parseError) {
          errorMessage = `Failed to remove student from blocklist. Server returned status ${response.status}.`;
        }
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error("Error removing student from blocklist:", err);
      alert(`Error: ${err.message}` || 'Failed to remove student from blocklist');
      if (err.message.includes('No authentication token found')) {
        localStorage.removeItem("token");
        if(setAuth) setAuth(false);
        navigate("/login");
      }
    }
  };

  // Modify toggleActionMenu to calculate position with edge detection
  const toggleActionMenu = (userId, event) => {
    console.log("Toggling action menu for student ID:", userId);
    const currentVisibility = !!showActionMenu[userId];
    const newVisibility = !currentVisibility;
    
    // Calculate position only when opening the menu
    if (newVisibility && event && event.currentTarget) {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      const spaceRight = window.innerWidth - buttonRect.left;
      const spaceLeft = buttonRect.left;

      const menuMinWidth = 180; // From CSS
      const menuMinHeight = 50; // Estimate based on content (2 items approx)
      const gap = 5; // Gap from button

      let top = buttonRect.bottom + gap;
      let left = buttonRect.left;

      // Adjust vertical position if not enough space below
      if (spaceBelow < menuMinHeight + gap && spaceAbove > spaceBelow) {
        top = buttonRect.top - menuMinHeight - gap; // Position above
        console.log("Not enough space below, positioning above.");
      }

      // Adjust horizontal position if not enough space to the right
      if (spaceRight < menuMinWidth && spaceLeft > spaceRight) {
        left = buttonRect.right - menuMinWidth;
        console.log("Not enough space right, adjusting left.");
      }

      // Ensure menu doesn't go off top/left viewport edges (sanity check)
      top = Math.max(gap, top);
      left = Math.max(gap, left);

      console.log("Calculated fixed position with edge detection:", { top, left });
      setDropdownPosition({ top, left });
    }

    // Always update visibility state
    setShowActionMenu(prev => ({
      // Ensure only one menu is open at a time
      ...Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: false }), {}),
      [userId]: newVisibility
    }));
  };

  // Restore Render Avatar Function (minor cleanup)
  const renderAvatar = (person) => {
    if (person.profile_picture_url) {
      // Ensure alt text is descriptive
      return <img src={person.profile_picture_url} alt={`Profile picture of ${person.first_name} ${person.last_name}`} />;
    }
    // Handle cases where first_name might be missing
    const initial = person.first_name ? person.first_name.charAt(0).toUpperCase() : '?';
    return (
      <div className="avatar-placeholder">
        {initial}
      </div>
    );
  };
  
  const tabs = [
    { id: 'stream', label: 'Stream' },
    { id: 'messages', label: 'Messages' },
    { id: 'assignments', label: 'Assignments' },
    { id: 'exams', label: 'Exams' },
    { id: 'people', label: 'People' }
  ];

  // Restore Click Outside Handler - Adapt for fixed positioning and new class name
  useEffect(() => {
    const handleClickOutside = (event) => {
      const isAnyMenuOpen = Object.values(showActionMenu).some(isOpen => isOpen);
      // Check outside the menu itself (using new class) AND outside the button that triggers it
      if (isAnyMenuOpen && 
          !event.target.closest('.people-action-menu') && // Use renamed class
          !event.target.closest('.more-options-button')) { 
          console.log("Clicked outside, closing menu.");
          setShowActionMenu({}); 
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActionMenu]);

  // Dropdown Item Click Handler
  const handleDropdownItemClick = (e, action, userId) => {
    e.stopPropagation();
    console.log(`Dropdown action clicked: ${action} for user ${userId}`);
    if (action === 'kick') kickStudent(userId);
    else if (action === 'block') blocklistStudent(userId);
  };

  // Restore Self Unenroll Function (minor cleanup)
  const selfUnenroll = async () => {
    try {
      const confirmed = window.confirm("Are you sure you want to unenroll from this course?");
      if (!confirmed) return;

      const token = localStorage.token;
      if (!token) throw new Error('No authentication token found');

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/enrollment/unenroll/${courseId}`, {
        method: "DELETE",
        headers: { 
          "Content-Type": "application/json",
          "jwt_token": token,
            // "token": token // Removed redundant
        }
      });

      if (!response.ok) {
        let errorMessage = 'Failed to unenroll from course';
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.msg || errorMessage;
          } else {
            const textResponse = await response.text();
            errorMessage = textResponse || errorMessage;
            console.error('Non-JSON error response:', textResponse);
          }
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
           errorMessage = `Failed to unenroll. Server returned status ${response.status}.`;
        }
        throw new Error(errorMessage);
      }

      // Attempt to parse JSON for success message, but provide default
      let successMessage = "Successfully unenrolled from the course.";
      try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
              successMessage = data.message || successMessage;
          } 
          // If no JSON or no message property, use the default.
      } catch (jsonError) {
          console.warn("Could not parse JSON success response for unenroll:", jsonError);
      }
      
      alert(successMessage);
      navigate("/dashboard"); // Navigate after successful unenrollment
    } catch (err) {
      console.error("Error unenrolling from course:", err);
      alert(err.message || 'Failed to unenroll from course');
       if (err.message.includes('No authentication token found')) {
           localStorage.removeItem("token");
           if(setAuth) setAuth(false);
           navigate("/login");
       }
    }
  };

  // Fetch user role and courses
  useEffect(() => {
    const fetchUserRoleAndCourses = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        // Fetch user role
        const roleRes = await fetch('http://localhost:5000/auth/user-role', { headers: { jwt_token: token } });
        if (!roleRes.ok) throw new Error('Failed to fetch user role');
        const roleData = await roleRes.json();
        setUserRole(roleData.role);
        setIsTeacher(roleData.role === 'professor');
        // Fetch courses
        let endpoint = roleData.role === 'professor'
          ? 'http://localhost:5000/enrollment/professor-courses'
          : 'http://localhost:5000/enrollment/student-courses';
        const coursesRes = await fetch(endpoint, { headers: { jwt_token: token } });
        if (!coursesRes.ok) throw new Error('Failed to fetch courses');
        const coursesData = await coursesRes.json();
        setCourses(Array.isArray(coursesData) ? coursesData : []);
      } catch (err) {
        setCourses([]);
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchUserRoleAndCourses();
  }, []);

  // --- Restore Loading State ---
  if (loading) {
    return (
      <div className="dashboard-container dashboard-page people-page">
         {/* Render basic sidebar/topbar placeholders during load */}
         <div className={`sidebar ${sidebarOpen ? 'open' : ''} loading`}> 
             {/* Minimal sidebar structure */}
         </div>
         <div className="main-content loading">
             <div className="content-wrapper">
                <div className="top-bar loading"> {/* Minimal top bar */} </div> 
                {/* Centered Loading Indicator */}
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading course members...</p>
                 </div>
             </div>
         </div>
      </div>
    );
  }

  // --- Restore Error State ---
  if (error) {
    return (
      <div className="dashboard-container dashboard-page people-page">
        {/* Render sidebar/topbar even on error for context */}
         <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
             {/* Basic Sidebar structure - content might be limited */}
             <div className="logo-container">
               <img src="/logo.png" alt="Nova Logo" className="logo" /> 
               <h2>Nova</h2>
             </div>
             {/* Maybe simplified nav or just the logout button */}
              <button onClick={logout} className="logout-button">
                <HiOutlineLogout className="nav-icon" /> <span>Logout</span>
             </button>
         </div>
         <div className="main-content">
             <div className="content-wrapper">
                {/* Basic Top bar structure */}
                 <div className="top-bar">
                 <div className="top-bar-right">
                   <div className="user-profile">
                     {/* Show basic info even on error if available */}
                     <div className="user-info">
                       <div className="user-name">{first_name} {last_name}</div>
                       <div className="user-role">{userRole || '...'}</div>
                     </div>
                     {/* Basic avatar */}
                     <div className="avatar">
                         {first_name && last_name ? `${first_name[0]}${last_name[0]}` : "?"}
                     </div>
                   </div>
                 </div>
               </div>
               {/* Centered Error Message */}
      <div className="error-container">
        <div className="error-message">
          <MdErrorOutline size={48} />
                  <p>Error loading people: {error}</p>
                  {/* Provide retry option */}
          <button onClick={fetchCourseMembers} className="retry-button">
            <MdRefresh />
            Retry
          </button>
                </div>
              </div>
             </div>
        </div>
      </div>
    );
  }

  // --- Restore Main Render ---
  return (
    <div className="dashboard-container dashboard-page people-page">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
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
        activePath={location.pathname}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />
      <div className={`main-content ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Mobile Sidebar Toggle */}
        {isMobile && (
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <HiOutlineX /> : <HiOutlineMenu />}
          </button>
        )}

        {/* Content Wrapper */}
        <div className="content-wrapper">
          {/* Restore Top Bar */}
      <div className="top-bar">
            {/* Add search bar placeholder if needed */}
             {/* <div className="search-bar"> <HiOutlineSearch /> <input type="text" placeholder="Search..." /> </div> */}
        <div className="top-bar-right">
          <div className="user-profile">
            <div className="user-info">
                  {/* Use state variables */}
                  <div className="user-name">{first_name} {last_name}</div> 
                  <div className="user-role">{userRole || 'Loading...'}</div> 
            </div>
                 {/* Conditional Avatar rendering */}
            {inputs.profilePicture ? (
              <div className="avatar" onClick={() => navigate("/settings")} style={{ cursor: 'pointer' }}>
                    <img src={inputs.profilePicture} alt="Profile" /> 
              </div>
            ) : (
              <div className="avatar" onClick={() => navigate("/settings")} style={{ cursor: 'pointer' }}>
                     {/* Display initials */}
                    {first_name && last_name ? `${first_name[0]}${last_name[0]}` : ""} 
              </div>
            )}
          </div>
        </div>
      </div>
      
          {/* Main area for course content (below top bar) */}
          <div className="course-main-area"> 
            {/* Restore Navigation Tabs */}
      <nav className="course-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
                  // Improved active class logic: exact match for stream, endsWith for others
                  className={`nav-tab ${ 
                    (tab.id === 'stream' && window.location.pathname === `/courses/${courseId}`) || 
                    (tab.id !== 'stream' && window.location.pathname.endsWith(`/${tab.id}`)) 
                    ? 'active' : ''
                  }`}
                  onClick={() => navigate(tab.id === 'stream' ? `/courses/${courseId}/stream` : `/courses/${courseId}/${tab.id}`)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

            {/* Restore People Content Container */}
      <div className="people-content">
              {/* Restore Self-Unenroll Button (no inline styles) */}
        {!isTeacher && (
          <div className="self-unenroll-container">
                  <button onClick={selfUnenroll} className="self-unenroll-button">
                    <MdPersonRemove size={18} /> Unenroll from course
            </button>
          </div>
        )}

              {/* Restore Professor Section */}
        <section className="professor-section">
                <div className="section-header">
          <h2>Professor</h2>
                   {/* Removed Add Co-teacher button as requested */}
          </div>
                 {/* Map through teachers */}
          {courseMembers.teachers.map(teacher => (
            <div key={teacher.user_id} className="person-item professor-item">
                    <div className="person-avatar">{renderAvatar(teacher)}</div>
                    <div className="person-name">{teacher.first_name} {teacher.last_name}</div>
                     {/* No actions needed for professor in this list usually */}
            </div>
          ))}
        </section>

        {/* --- Tabbed View for Students and Banned --- */}
        {isTeacher && (
          <div className="people-tab-container">
            {/* Tab Buttons */}
            <div className="people-tabs">
              <button 
                className={`tab-btn ${activePeopleTab === 'students' ? 'active' : ''}`}
                onClick={() => setActivePeopleTab('students')}
              >
                Students ({courseMembers.students.length})
              </button>
              <button 
                className={`tab-btn ${activePeopleTab === 'banned' ? 'active' : ''}`}
                onClick={() => setActivePeopleTab('banned')}
              >
                Blocklist ({courseMembers.banned.length})
              </button>
            </div>

            {/* Tab Content */}
            <div className="people-tab-content">
              {activePeopleTab === 'students' && (
                <section className="students-section">
                  {/* Student Section Header (Optional - could be removed if count is in tab) */}
                   <div className="section-header">
                     {/* <h2>Students</h2> MOVED TO TAB */}
                      <div className="header-right-group"> 
                          {/* Add Student Button removed as requested */}
                      </div>
                   </div>
                  <div className="students-list">
                    {courseMembers.students.length === 0 ? (
                      <div className="students-empty-state">
                        <HiOutlineUserGroup size={48} />
                        <p>No students are enrolled in this class yet.</p>
                      </div>
                    ) : (
                      courseMembers.students.map(student => (
                        <div key={student.user_id} className="person-item student-item">
                          <div className="person-avatar">{renderAvatar(student)}</div>
                          <div className="person-name">{student.first_name} {student.last_name}</div>
                          {/* Only show options if teacher AND course is not archived */} 
                          {courseDetails?.status !== 'archived' && (
                            <div className="more-options">
                              {/* ... More options button and menu ... */}
                               <button 
                                className="more-options-button"
                                onClick={(e) => { e.stopPropagation(); toggleActionMenu(student.user_id, e); }}
                                aria-haspopup="true"
                                aria-expanded={!!showActionMenu[student.user_id]}
                                aria-label={`Actions for ${student.first_name} ${student.last_name}`}
                                >
                                <MdMoreVert size={20} />
                                </button>
                                {showActionMenu[student.user_id] && (
                                <div 
                                    className="people-action-menu"
                                    role="menu"
                                    style={{
                                    top: `${dropdownPosition.top}px`, 
                                    left: `${dropdownPosition.left}px`,
                                    display: 'block'
                                    }}
                                >
                                    <button 
                                    className="people-action-item kick"
                                    onClick={(e) => handleDropdownItemClick(e, 'kick', student.user_id)}
                                    role="menuitem"
                                    >
                                    <MdPersonRemove size={16} /> <span>Unenroll Student</span> 
                                    </button>
                                    <button 
                                    className="people-action-item ban"
                                    onClick={(e) => handleDropdownItemClick(e, 'block', student.user_id)}
                                    role="menuitem"
                                    >
                                    <MdBlock size={16} /> <span>Add to Blocklist</span> 
                                    </button>
                                </div>
                                )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}

              {activePeopleTab === 'banned' && (
                <section className="banned-section">
                   {/* Banned Section Header (Optional - could be removed if count is in tab) */}
                   {/* <div className="section-header"> <h2>Banned Students</h2> </div> */}
                  <div className="banned-list">
                    {courseMembers.banned.length === 0 ? (
                      <div className="banned-empty-state">
                        <MdBlock size={48} /> 
                        <p>No students are currently on the blocklist for this course.</p>
                      </div>
                    ) : (
                      courseMembers.banned.map(bannedStudent => (
                        <div key={bannedStudent.user_id} className="person-item banned-item">
                          <div className="person-avatar">{renderAvatar(bannedStudent)}</div>
                          <div className="person-name">{bannedStudent.first_name} {bannedStudent.last_name}</div>
                          {/* Unban Button */}
                          {/* Only show if course is not archived */}
                          {courseDetails?.status !== 'archived' && (
                            <div className="banned-actions">
                              <button 
                                className="unban-button" 
                                onClick={() => removeFromBlocklist(bannedStudent.user_id)}
                                title="Remove from Blocklist"
                              >
                                <FaCheckCircle size={16} /> Remove from Blocklist
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
        
        {/* If user is NOT a teacher, just show the student list without tabs/banned section */}
        {!isTeacher && (
           <section className="students-section">
              <div className="section-header">
                <h2>Students</h2>
                <span className="student-count">
                 {courseMembers.studentCount} {courseMembers.studentCount === 1 ? 'student' : 'students'}
               </span>
             </div>
            <div className="students-list">
              {courseMembers.students.length === 0 ? (
                <div className="students-empty-state">
                  <HiOutlineUserGroup size={48} />
                  <p>No students are enrolled in this class yet.</p>
                </div>
              ) : (
                courseMembers.students.map(student => (
                  <div key={student.user_id} className="person-item student-item">
                    <div className="person-avatar">{renderAvatar(student)}</div>
                    <div className="person-name">{student.first_name} {student.last_name}</div>
                     {/* No actions for students viewing other students */}
                  </div>
                ))
              )}
             </div>
           </section>
        )}

            </div> 
          </div> 
        </div> 
      </div>
    </div>
  );
};

export default People; 