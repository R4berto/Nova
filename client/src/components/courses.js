import React, { useState, useEffect, useCallback } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { FaPlus, FaEdit, FaTrash, FaArchive, FaBan, FaCheck } from "react-icons/fa"
import { BsTrash } from "react-icons/bs"
import {
    HiOutlineLogout,
    HiOutlineCog,
    HiOutlineUsers,
    HiOutlinePencilAlt,
    HiOutlineChevronDown,
    HiOutlinePlus,
    HiOutlineBan,
    HiOutlineCheck,
    HiOutlineArchive,
    HiOutlineTrash,
    HiOutlineX,
    HiOutlineMenu,
    HiOutlineViewList,
    HiOutlineClipboardList,
    HiOutlineUserGroup,
    HiOutlineHome,
    HiOutlineBookOpen,
    HiOutlineAnnotation,
    HiOutlineCalendar,
    HiOutlineNewspaper,
    HiOutlinePresentationChartBar,
    HiOutlineChat,
    HiOutlineSearch,
    HiOutlineViewGrid,
    HiOutlineExclamationCircle
} from "react-icons/hi"
import "./classroom.css"
import { toast } from 'react-hot-toast'
import Sidebar from './Sidebar'
import LoadingIndicator from './common/LoadingIndicator'

export default function Classroom({ setAuth }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Try to get the sidebar state from localStorage
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState === "true";
  })
  const [isMobile, setIsMobile] = useState(false)
  const [courses, setCourses] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [editingCourse, setEditingCourse] = useState(null)
  const [newCourse, setNewCourse] = useState({ 
    course_name: "", 
    description: "",
    section: null,
    semester: "1st semester",
    academic_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    status: "active"
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("active")
  const [viewMode, setViewMode] = useState("grid")
  const navigate = useNavigate()
  const location = useLocation()
  const [inputs, setInputs] = useState({
    first_name: "",
    last_name: "",
    profilePicture: null
  });
  const [coursesSubmenuOpen, setCoursesSubmenuOpen] = useState(true)
  const [enrollmentCode, setEnrollmentCode] = useState("");
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [showArchiveWarningModal, setShowArchiveWarningModal] = useState(false)
  const [showDeleteWarningModal, setShowDeleteWarningModal] = useState(false)
  const [courseToArchive, setCourseToArchive] = useState(null)
  const [courseToDelete, setCourseToDelete] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInactivateModal, setShowInactivateModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [userId, setUserId] = useState(null);

  const {first_name, last_name} = inputs;

  // Getting profile details
  const getProfile = async () => {
    try {
      const res = await fetch("http://localhost:5000/dashboard/", {
        method: "GET",
        headers: { jwt_token: localStorage.token }
      });

      const parseData = await res.json();

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

  // Geting role data
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

  // Getting course data
  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      // For students, fetch only enrolled courses
      // For professors, fetch courses they created
      const endpoint = userRole === "professor" 
        ? "http://localhost:5000/courses/professor"
        : "http://localhost:5000/enrollment/student-courses"; // Changed to enrollment endpoint for students
      
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
      // Process the data to include status if it's missing for some courses
      const processedData = Array.isArray(data) ? data.map(course => ({
        ...course,
        // Ensure status exists (default to 'active' if not present)
        status: course.status || 'active'
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

  useEffect(() => {
    fetchUserRole()
  }, [fetchUserRole])

  useEffect(() => {
    if (userRole) {
      fetchCourses()
    }
  }, [userRole, fetchCourses])

  // Get profile information
  useEffect(() => {
    getProfile();
  }, []);

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
    if (location.state?.openAddCourseModal) {
      openAddCourseModal();
      // Clear the state to prevent the modal from opening again on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Add validateCourseField function to prevent special characters
  const validateCourseField = (field, fieldName) => {
    // Special handling for section field
    if (fieldName === "Section") {
      // Allow formats like "BSCS 3C", "Section-A", "Block 1", etc.
      const sectionRegex = /^[A-Za-z0-9\s-]{1,20}$/;
      if (!sectionRegex.test(field)) {
        toast.error(`Section can only contain letters, numbers, spaces and hyphens (max 20 characters)`);
        return false;
      }
      // Additional check to ensure it's not just spaces
      if (field.trim().length === 0) {
        toast.error(`Section cannot be empty or just spaces`);
        return false;
      }
      return true;
    }
    
    // For other fields (course name and description)
    const alphanumericRegex = /^[A-Za-z0-9\s.,!?:;()-]+$/;
    if (!alphanumericRegex.test(field)) {
      toast.error(`${fieldName} cannot contain special characters`);
      return false;
    }
    return true;
  };

  // Add course name validation
  const validateCourseName = (name) => {
    // Check if name contains at least one letter
    const hasLetter = /[a-zA-Z]/.test(name);
    if (!hasLetter) {
      return false;
    }
    return true;
  };

  // Handle Add Course with validation
  const handleAddCourse = async (e) => {
    e.preventDefault();
    let updatedCourse = { ...newCourse };
    let hasErrors = false;
    
    if (!newCourse.course_name.trim()) {
      toast.error("Course name is required");
      hasErrors = true;
    }
    if (!newCourse.description.trim()) {  
      toast.error("Course description is required");
      hasErrors = true;
    }
    if (!newCourse.academic_year.trim()) {  
      toast.error("Course academic Year is required");
      hasErrors = true;
    }

    // Validate course name
    if (newCourse.course_name.trim() && !validateCourseField(newCourse.course_name, "Course name")) {
      updatedCourse.course_name = "";
      hasErrors = true;
    }
    
    // Validate description
    if (newCourse.description.trim() && !validateCourseField(newCourse.description, "Course description")) {
      updatedCourse.description = "";
      hasErrors = true;
    }
    
    // Validate section if provided (not null or empty)
    if (newCourse.section && newCourse.section.trim()) {
      if (!validateCourseField(newCourse.section.trim(), "Section")) {
        updatedCourse.section = "";
        hasErrors = true;
      }
    }

    // Validate academic year format
    if (newCourse.academic_year.trim() && !/^\d{4}-\d{4}$/.test(newCourse.academic_year)) {
      toast.error("Academic year must be in YYYY-YYYY format");
      updatedCourse.academic_year = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
      hasErrors = true;
    } else if (newCourse.academic_year.trim()) {
      // Validate academic year range
      const [startYear, endYear] = newCourse.academic_year.split('-').map(Number);
      if (endYear - startYear !== 1) {
        toast.error("Academic year must have a gap of exactly 1 year (e.g., 2023-2024)");
        updatedCourse.academic_year = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
        hasErrors = true;
      }
      
      // Check if the academic year is within allowed range
      const currentYear = new Date().getFullYear();
      if (startYear < currentYear - 1) {
        toast.error("Academic year cannot be more than one year in the past");
        updatedCourse.academic_year = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
        hasErrors = true;
      }
    }
    
    // Apply updates to form values if there are errors
    if (hasErrors) {
      setNewCourse(updatedCourse);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      // Adding courses
      const response = await fetch("http://localhost:5000/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          jwt_token: token
        },
        body: JSON.stringify(newCourse)
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
          return;
        }
        const error = await response.json();
        throw new Error(error.error || "Failed to create course");
      }

      const data = await response.json();
      setCourses([...courses, data.course]);
      setNewCourse({ 
        course_name: "", 
        description: "",
        section: null,
        semester: "1st semester",
        academic_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        status: "active"
      });
      setShowModal(false);
      toast.success("Course created successfully");
    } catch (err) {
      console.error(err.message);
      toast.error(err.message);
    }
  };

  // Add confirmation dialog for status changes
  const handleStatusChange = async (courseId, newStatus) => {
    const course = courses.find(c => c.course_id === courseId);
    
    if (newStatus === 'inactive') {
      setSelectedCourse(course);
      setShowInactivateModal(true);
    } else if (newStatus === 'active') {
      setSelectedCourse(course);
      setShowReactivateModal(true);
    }
  };

  // Confirm inactivate course
  const confirmInactivateCourse = async () => {
    try {
      if (!selectedCourse) return;
      
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      
      const response = await fetch(`http://localhost:5000/courses/${selectedCourse.course_id}/inactivate`, {
        method: "PUT",
        headers: { 
          jwt_token: token 
        }
      });

      if (!response.ok) {
        throw new Error("Failed to inactivate course");
      }

      // Refresh courses list
      fetchCourses();
      toast.success("Course inactivated successfully");
      
      // Close the modal
      setShowInactivateModal(false);
      setSelectedCourse(null);
    } catch (err) {
      console.error("Error inactivating course:", err);
      toast.error(err.message);
    }
  };

  // Confirm reactivate course
  const confirmReactivateCourse = async () => {
    try {
      if (!selectedCourse) return;
      
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      
      const response = await fetch(`http://localhost:5000/courses/${selectedCourse.course_id}/reactivate`, {
        method: "PUT",
        headers: { 
          jwt_token: token 
        }
      });

      if (!response.ok) {
        throw new Error("Failed to reactivate course");
      }

      // Refresh courses list
      fetchCourses();
      toast.success("Course reactivated successfully");
      
      // Close the modal
      setShowReactivateModal(false);
      setSelectedCourse(null);
    } catch (err) {
      console.error("Error reactivating course:", err);
      toast.error(err.message);
    }
  };

  // Add discard changes confirmation
  const handleCancelEdit = () => {
    const confirmed = window.confirm('Do you want to discard the changes?');
    if (confirmed) {
      setEditingCourse(null);
      setShowModal(false);
    }
  };

  // Update course form submission
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    let updatedCourse = { ...editingCourse };
    let hasErrors = false;
    
    if (!editingCourse.course_name.trim()) {
      toast.error("Course name is required");
      hasErrors = true;
    }
    
    if (!editingCourse.description.trim()) {
      toast.error("Course description is required");
      hasErrors = true;
    }

    // Validate course name
    if (editingCourse.course_name.trim() && !validateCourseField(editingCourse.course_name.trim(), "Course name")) {
      updatedCourse.course_name = "";
      hasErrors = true;
    }
    
    // Validate description
    if (editingCourse.description.trim() && !validateCourseField(editingCourse.description.trim(), "Course description")) {
      updatedCourse.description = "";
      hasErrors = true;
    }
    
    // Validate section if provided (not null or empty)
    if (editingCourse.section && editingCourse.section.trim()) {
      if (!validateCourseField(editingCourse.section.trim(), "Section")) {
        updatedCourse.section = "";
        hasErrors = true;
      }
    }

    // Validate academic year format
    if (!/^\d{4}-\d{4}$/.test(editingCourse.academic_year)) {
      toast.error("Academic year must be in YYYY-YYYY format");
      updatedCourse.academic_year = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
      hasErrors = true;
    } else {
      // Validate academic year range
      const [startYear, endYear] = editingCourse.academic_year.split('-').map(Number);
      if (endYear - startYear !== 1) {
        toast.error("Academic year must have a gap of exactly 1 year (e.g., 2023-2024)");
        updatedCourse.academic_year = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
        hasErrors = true;
      }
      
      // Check if the academic year is within allowed range
      const currentYear = new Date().getFullYear();
      if (startYear < currentYear - 1) {
        toast.error("Academic year cannot be more than one year in the past");
        updatedCourse.academic_year = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
        hasErrors = true;
      }
    }
    
    // Apply updates to form values if there are errors
    if (hasErrors) {
      setEditingCourse(updatedCourse);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      // Prepare the update data
      const updateData = {
        course_name: editingCourse.course_name.trim(),
        description: editingCourse.description.trim(),
        semester: editingCourse.semester,
        academic_year: editingCourse.academic_year,
        section: editingCourse.section ? editingCourse.section.trim() : null
      };

      const response = await fetch(`http://localhost:5000/courses/${editingCourse.course_id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          jwt_token: token 
        },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update course");
      }

      // Update the local state with the updated course
      setCourses(prevCourses => 
        prevCourses.map(course => 
          course.course_id === editingCourse.course_id 
            ? { ...course, ...updateData }
            : course
        )
      );

      setShowModal(false);
      setEditingCourse(null);
      setIsEditing(false);
      toast.success("Course updated successfully");
    } catch (err) {
      console.error("Error updating course:", err);
      toast.error(err.message || "Failed to update course");
    }
  };

  const handleArchiveCourse = async (courseId) => {
    // Instead of immediately archiving, show the warning modal
    const course = courses.find(c => c.course_id === courseId);
    setCourseToArchive(course);
    setShowArchiveWarningModal(true);
  };

  // Confirm archive course
  const confirmArchiveCourse = async () => {
    try {
      if (!courseToArchive) return;
      
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      
      const response = await fetch(`http://localhost:5000/courses/${courseToArchive.course_id}/archive`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          jwt_token: token
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to archive course");
      }
      
      // Update the course status in the UI
      setCourses(courses.map(course => 
        course.course_id === courseToArchive.course_id
          ? { ...course, status: 'archived' }
          : course
      ));
      
      toast.success(`Course "${courseToArchive.course_name}" has been archived`);
      
      // Automatically close the modal
      setShowArchiveWarningModal(false);
      setCourseToArchive(null);
    } catch (err) {
      console.error(err.message);
      toast.error(err.message || "An error occurred while archiving the course");
    }
  };

  const handleDeleteCourse = async (courseId) => {
    // Instead of using window.confirm, show the warning modal
    const course = courses.find(c => c.course_id === courseId);
    setCourseToDelete(course);
    setShowDeleteWarningModal(true);
  };

  // Add a new function to confirm and execute the delete action
  const confirmDeleteCourse = async () => {
    try {
      if (!courseToDelete) return;
      
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch(`http://localhost:5000/courses/${courseToDelete.course_id}`, {
        method: "DELETE",
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
        const error = await response.json();
        throw new Error(error.error || "Failed to delete course");
      }

      setCourses(courses.filter(course => course.course_id !== courseToDelete.course_id));
      toast.success("Course deleted successfully");
      setShowDeleteWarningModal(false);
      setCourseToDelete(null);
    } catch (err) {
      console.error(err.message);
      toast.error(err.message);
    }
  };

  const startEditing = (course) => {
    setEditingCourse({
      ...course,
      section: course.section || null // Ensure section is null if not set
    });
    setIsEditing(true);
    setShowModal(true);
  };

  const openAddCourseModal = () => {
    setIsEditing(false)
    setEditingCourse(null)
    setNewCourse({ 
      course_name: "", 
      description: "",
      section: null,
      semester: "1st semester",
      academic_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      status: "active"
    })
    setShowModal(true)
    
    // Debug log to confirm modal should be displaying
    console.log("Opening modal:", { showModal: true })
  }

  // Filter courses based on search and active tab
  const filteredCourses = courses.filter(course => {
    if (!course) return false;
    
    const courseName = course.course_name?.toLowerCase() || '';
    const description = course.description?.toLowerCase() || '';
    const searchTerm = searchQuery.toLowerCase();
    
    return (courseName.includes(searchTerm) || description.includes(searchTerm)) && 
           course.status === activeTab;
  });

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

  // Function to render course cards in grid view
  const renderCourseCards = () => {
    if (loading) {
      return <LoadingIndicator text="Loading courses" />;
    }

    if (error) {
      return <div className="error-message">{error}</div>;
    }

    if (filteredCourses.length === 0) {
      return (
        <div className="no-courses-message">
          <HiOutlineBookOpen size={48} className="mb-4" />
          <h3>No courses found</h3>
          {activeTab === "active" ? (
            <>
              <p>You are not enrolled in any courses yet. Browse available courses or enroll using a course code.</p>
              {userRole === "student" ? (
                <button 
                  className="btn-primary mt-4"
                  onClick={() => setShowEnrollModal(true)}
                >
                  <HiOutlinePlus className="mr-2" /> Enroll in Course
                </button>
              ) : (
                <Link 
                  to="/courses" 
                  className="btn-primary mt-4"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/courses', { state: { openAddCourseModal: true } });
                  }}
                >
                  <HiOutlinePlus className="mr-2" /> Create New Course
                </Link>
              )}
            </>
          ) : activeTab === "inactive" ? (
            <p>You don't have any inactive courses.</p>
          ) : (
            <p>You don't have any archived courses.</p>
          )}
        </div>
      );
    }

    return (
      <div className="course-grid">
        {filteredCourses.map(course => {
          return (
            <div 
              key={course.course_id} 
              className={`course-card shadow-md fade-in`}
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
                
                {userRole === 'professor' && course.enrollment_code && (
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
                
                {userRole === 'professor' && (
                  <div className="course-actions">
                    {course.status !== 'archived' && (
                      <button 
                        className="action-btn edit-btn"
                        onClick={() => startEditing(course)}
                        title="Edit Course"
                      >
                        <FaEdit />
                        <span>Edit</span>
                      </button>
                    )}
                    {course.status === 'active' ? (
                      <button 
                        className="action-btn inactivate-btn"
                        onClick={() => handleStatusChange(course.course_id, 'inactive')}
                        title="Inactivate Course"
                      >
                        <FaBan />
                        <span>Inactivate</span>
                      </button>
                    ) : course.status === 'inactive' ? (
                      <>
                        <button 
                          className="action-btn reactivate-btn"
                          onClick={() => handleStatusChange(course.course_id, 'active')}
                          title="Reactivate Course"
                        >
                          <FaCheck />
                          <span>Reactivate</span>
                        </button>
                        <button 
                          className="action-btn archive-btn"
                          onClick={() => handleArchiveCourse(course.course_id)}
                          title="Archive Course"
                        >
                          <FaArchive />
                          <span>Archive</span>
                        </button>
                      </>
                    ) : null}
                    <button 
                      className="action-btn delete-btn"
                      onClick={() => handleDeleteCourse(course.course_id)}
                      title="Delete Course"
                    >
                      <BsTrash />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Function to render course table in list view
  const renderCourseTable = () => {
    if (loading) {
      return <LoadingIndicator text="Loading courses" />;
    }

    if (error) {
      return <div className="error-message">{error}</div>;
    }

    if (filteredCourses.length === 0) {
      return (
        <div className="no-courses-message">
          <HiOutlineBookOpen size={48} className="mb-4" />
          <h3>No courses found</h3>
          {activeTab === "active" ? (
            <>
              <p>You are not enrolled in any courses yet. Browse available courses or enroll using a course code.</p>
              {userRole === "student" ? (
                <button 
                  className="btn-primary mt-4"
                  onClick={() => setShowEnrollModal(true)}
                >
                  <HiOutlinePlus className="mr-2" /> Enroll in Course
                </button>
              ) : (
                <Link 
                  to="/courses" 
                  className="btn-primary mt-4"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/courses', { state: { openAddCourseModal: true } });
                  }}
                >
                  <HiOutlinePlus className="mr-2" /> Create New Course
                </Link>
              )}
            </>
          ) : activeTab === "inactive" ? (
            <p>You don't have any inactive courses.</p>
          ) : (
            <p>You don't have any archived courses.</p>
          )}
        </div>
      );
    }

    return (
      <div className="course-list-table">
        <div className="course-list-header-row">
          <div className="course-column">Course Name</div>
          <div className="description-column">Description</div>
          <div className="section-column">Section</div>
          <div className="semester-column">Semester</div>
          <div className="year-column">Academic Year</div>
          {userRole === "professor" && <div className="enrollment-column">Enrollment Code</div>}
          {userRole === "professor" && <div className="actions-column">Actions</div>}
        </div>
        
        <div className="course-list-body">
          {filteredCourses.map(course => (
            <div key={course.course_id} className="course-row">
              <div className="course-column">
                <Link 
                  to={`/courses/${course.course_id}/stream`} 
                  className="course-name-link"
                >
                  {course.course_name}
                </Link>
              </div>
              <div className="description-column">{course.description || "-"}</div>
              <div className="section-column">{course.section || "-"}</div>
              <div className="semester-column">{course.semester}</div>
              <div className="year-column">{course.academic_year}</div>
              {userRole === "professor" && (
                <div className="enrollment-column">{course.enrollment_code || "-"}</div>
              )}
              {userRole === "professor" && (
                <div className="actions-column">
                  <div className="action-buttons">
                    {course.status !== 'archived' && (
                      <button 
                        className="action-btn edit-btn"
                        onClick={() => startEditing(course)}
                        title="Edit Course"
                      >
                        <FaEdit />
                        <span>Edit</span>
                      </button>
                    )}
                    {course.status === 'active' ? (
                      <button 
                        className="action-btn inactivate-btn"
                        onClick={() => handleStatusChange(course.course_id, 'inactive')}
                        title="Inactivate Course"
                      >
                        <FaBan />
                        <span>Inactivate</span>
                      </button>
                    ) : course.status === 'inactive' ? (
                      <>
                        <button 
                          className="action-btn reactivate-btn"
                          onClick={() => handleStatusChange(course.course_id, 'active')}
                          title="Reactivate Course"
                        >
                          <FaCheck />
                          <span>Reactivate</span>
                        </button>
                        <button 
                          className="action-btn archive-btn"
                          onClick={() => handleArchiveCourse(course.course_id)}
                          title="Archive Course"
                        >
                          <FaArchive />
                          <span>Archive</span>
                        </button>
                      </>
                    ) : null}
                    <button 
                      className="action-btn delete-btn"
                      onClick={() => handleDeleteCourse(course.course_id)}
                      title="Delete Course"
                    >
                      <BsTrash />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Toggle submenu open/close
  const toggleCoursesSubmenu = (e) => {
    e.preventDefault();
    setCoursesSubmenuOpen(!coursesSubmenuOpen);
  };

  return (
    <div className="dashboard-container classroom-page">
      <Sidebar 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobile={isMobile}
        userRole={userRole}
        courses={courses}
        loading={loading}
        userProfile={inputs}
        onLogout={logout}
        activePath={location.pathname}
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="top-bar-right">
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

          {/* Courses List */}
          <div className="course-list-container">
            <div className="course-list-header">
              <h2>Available Courses</h2>
              
              {userRole === 'professor' && (
                <button 
                  className="add-course-btn"
                  onClick={() => {
                    console.log("Add course button clicked");
                    openAddCourseModal();
                  }}
                >
                  <HiOutlinePlus className="mr-2" />
                  <span>New Course</span>
                </button>
              )}
            </div>
            
            <div className="course-controls">
              <div className="course-tabs">
                <button 
                  className={`tab-btn ${activeTab === "active" ? "active" : ""}`}
                  onClick={() => setActiveTab("active")}
                >
                  Active Courses
                </button>
                <button 
                  className={`tab-btn ${activeTab === "inactive" ? "active" : ""}`}
                  onClick={() => setActiveTab("inactive")}
                >
                  Inactive Courses
                </button>
                <button 
                  className={`tab-btn ${activeTab === "archived" ? "active" : ""}`}
                  onClick={() => setActiveTab("archived")}
                >
                  Archived Courses
                </button>
              </div>
              
              <div className="view-controls">
                <button 
                  className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                >
                  <HiOutlineViewGrid size={24} />
                </button>
                <button 
                  className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                >
                  <HiOutlineViewList size={24} />
                </button>
              </div>
            </div>
            
            {viewMode === 'grid' ? renderCourseCards() : renderCourseTable()}
          </div>
        </div>
      </div>

      {/* Course Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => {
          // Close the modal when clicking on the overlay (outside the modal content)
          if (e.target.className === 'modal-overlay') {
            setShowModal(false);
          }
        }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>{isEditing ? "Edit Course" : "Add New Course"}</h2>
              <button className="close-modal" onClick={() => {
                if (isEditing) {
                  handleCancelEdit();
                } else {
                  setShowModal(false);
                }
              }}>
                <HiOutlineX />
              </button>
            </div>
            <form onSubmit={isEditing ? handleEditSubmit : handleAddCourse} className="modal-form">
              <div className="form-group">
                <label htmlFor="course_name">Course Code</label>
                <input
                  id="course_name"
                  type="text"
                  placeholder="Enter course name"
                  value={isEditing ? editingCourse.course_name : newCourse.course_name}
                  onChange={(e) => {
                    if (isEditing) {
                      setEditingCourse({ ...editingCourse, course_name: e.target.value })
                    } else {
                      setNewCourse({ ...newCourse, course_name: e.target.value })
                    }
                  }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="description">Course Name</label>
                <textarea
                  id="description"
                  placeholder="Enter course description"
                  value={isEditing ? editingCourse.description : newCourse.description}
                  onChange={(e) => {
                    if (isEditing) {
                      setEditingCourse({ ...editingCourse, description: e.target.value })
                    } else {
                      setNewCourse({ ...newCourse, description: e.target.value })
                    }
                  }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="section">Section <span className="optional-field">(optional)</span></label>
                <input
                  id="section"
                  type="text"
                  placeholder="e.g. BSCS 3C"
                  value={isEditing ? editingCourse.section || "" : newCourse.section || ""}
                  onChange={(e) => {
                    const value = e.target.value.trim() || null;
                    if (isEditing) {
                      setEditingCourse({ ...editingCourse, section: value })
                    } else {
                      setNewCourse({ ...newCourse, section: value })
                    }
                  }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="semester">Semester</label>
                <select
                  id="semester"
                  value={isEditing ? editingCourse.semester : newCourse.semester}
                  onChange={(e) => {
                    if (isEditing) {
                      setEditingCourse({ ...editingCourse, semester: e.target.value })
                    } else {
                      setNewCourse({ ...newCourse, semester: e.target.value })
                    }
                  }}
                >
                  <option value="1st semester">1st Semester</option>
                  <option value="2nd semester">2nd Semester</option>
                  <option value="summer">Summer</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="academic_year">Academic Year</label>
                <input
                  id="academic_year"
                  type="text"
                  placeholder="YYYY-YYYY"
                  value={isEditing ? editingCourse.academic_year : newCourse.academic_year}
                  onChange={(e) => {
                    if (isEditing) {
                      setEditingCourse({ ...editingCourse, academic_year: e.target.value })
                    } else {
                      setNewCourse({ ...newCourse, academic_year: e.target.value })
                    }
                  }}
                />
                <p className="help-text">Format: YYYY-YYYY (one year gap). Cannot be more than one year in the past.</p>
              </div>
              <div className="modal-actions">
                {isEditing ? (
                  <>
                    <button type="button" className="cancel-btn" onClick={handleCancelEdit}>
                      Cancel
                    </button>
                    <button type="submit" className="submit-btn">
                      Update Course
                    </button>
                  </>
                ) : (
                  <button type="submit" className="submit-btn">
                    Add Course
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Warning Modal */}
      {showArchiveWarningModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <h2>Archive Course?</h2>
              <button 
                className="close-modal" 
                onClick={() => {
                  setShowArchiveWarningModal(false);
                  setCourseToArchive(null);
                }}
              >
                <HiOutlineX />
              </button>
            </div>
            <div className="modal-form">
              <div style={{ marginBottom: "20px", color: "#b91c1c", display: "flex", alignItems: "center", gap: "10px" }}>
                <HiOutlineExclamationCircle size={24} />
                <span style={{ fontWeight: "bold" }}>Warning: This action cannot be undone</span>
              </div>
              
              <p>
                You are about to archive <strong>{courseToArchive?.course_name}</strong>. 
                Once a course is archived:
              </p>
              
              <ul style={{ margin: "16px 0", paddingLeft: "20px", lineHeight: "1.5" }}>
                <li>It <strong>cannot</strong> be reactivated or modified</li>
                <li>It will only be visible in the "Archived" tab</li>
                <li>Students can still view the course content but cannot interact with it</li>
                <li>The only available action will be to delete the course permanently</li>
              </ul>
              
              <p>Are you sure you want to proceed?</p>
              
              <div className="modal-actions">
                <button 
                  className="cancel-btn" 
                  onClick={() => {
                    setShowArchiveWarningModal(false);
                    setCourseToArchive(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="submit-btn" 
                  style={{ backgroundColor: "#b91c1c" }}
                  onClick={confirmArchiveCourse}
                >
                  Archive Course
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Warning Modal */}
      {showDeleteWarningModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <h2>Delete Course?</h2>
              <button 
                className="close-modal" 
                onClick={() => {
                  setShowDeleteWarningModal(false);
                  setCourseToDelete(null);
                }}
              >
                <HiOutlineX />
              </button>
            </div>
            <div className="modal-form">
              <div style={{ marginBottom: "20px", color: "#b91c1c", display: "flex", alignItems: "center", gap: "10px" }}>
                <HiOutlineExclamationCircle size={24} />
                <span style={{ fontWeight: "bold" }}>Warning: This action cannot be undone</span>
              </div>
              
              <p>
                You are about to permanently delete <strong>{courseToDelete?.course_name}</strong>. 
                Once a course is deleted:
              </p>
              
              <ul style={{ margin: "16px 0", paddingLeft: "20px", lineHeight: "1.5" }}>
                <li>All course content will be <strong>permanently deleted</strong></li>
                <li>All student enrollments in this course will be removed</li>
                <li>All assignments, grades, and discussions will be lost</li>
                <li>This action <strong>cannot</strong> be reversed</li>
              </ul>
              
              <p>Are you sure you want to proceed with deletion?</p>
              
              <div className="modal-actions">
                <button 
                  className="cancel-btn" 
                  onClick={() => {
                    setShowDeleteWarningModal(false);
                    setCourseToDelete(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="submit-btn" 
                  style={{ backgroundColor: "#b91c1c" }}
                  onClick={confirmDeleteCourse}
                >
                  Delete Course
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  setError(null);
                }}
              >
                <HiOutlineX />
              </button>
            </div>
            
            <form className="modal-form" onSubmit={(e) => {
              e.preventDefault();
              // Handle enrollment - just close the modal for now 
              setShowEnrollModal(false);
              toast.success("This feature will be implemented soon.");
            }}>
              <div className="form-group">
                <label htmlFor="enrollment_code">Course Enrollment Code</label>
                <input
                  type="text"
                  id="enrollment_code"
                  placeholder="Enter course enrollment code"
                  required
                  autoFocus
                />
                <p className="help-text">Enter the enrollment code provided by your instructor.</p>
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => {
                    setShowEnrollModal(false);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Enroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inactivate Warning Modal */}
      {showInactivateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <h2>Inactivate Course?</h2>
              <button 
                className="close-modal" 
                onClick={() => {
                  setShowInactivateModal(false);
                  setSelectedCourse(null);
                }}
              >
                <HiOutlineX />
              </button>
            </div>
            <div className="modal-form">
              <div style={{ marginBottom: "20px", color: "#b91c1c", display: "flex", alignItems: "center", gap: "10px" }}>
                <HiOutlineExclamationCircle size={24} />
                <span style={{ fontWeight: "bold" }}>Warning: This will limit course access</span>
              </div>
              
              <p>
                You are about to inactivate <strong>{selectedCourse?.course_name}</strong>. 
                When a course is inactivated:
              </p>
              
              <ul style={{ margin: "16px 0", paddingLeft: "20px", lineHeight: "1.5" }}>
                <li>Students will <strong>not</strong> be able to access the course content</li>
                <li>The course will be moved to the "Inactive" tab</li>
                <li>You can reactivate the course later if needed</li>
                <li>This is a reversible action</li>
              </ul>
              
              <p>Are you sure you want to inactivate this course?</p>
              
              <div className="modal-actions">
                <button 
                  className="cancel-btn" 
                  onClick={() => {
                    setShowInactivateModal(false);
                    setSelectedCourse(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="submit-btn" 
                  style={{ backgroundColor: "#b91c1c" }}
                  onClick={confirmInactivateCourse}
                >
                  Inactivate Course
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate Warning Modal */}
      {showReactivateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <h2>Reactivate Course?</h2>
              <button 
                className="close-modal" 
                onClick={() => {
                  setShowReactivateModal(false);
                  setSelectedCourse(null);
                }}
              >
                <HiOutlineX />
              </button>
            </div>
            <div className="modal-form">
              <div style={{ marginBottom: "20px", color: "#28a745", display: "flex", alignItems: "center", gap: "10px" }}>
                <HiOutlineCheck size={24} />
                <span style={{ fontWeight: "bold" }}>This will restore course access</span>
              </div>
              
              <p>
                You are about to reactivate <strong>{selectedCourse?.course_name}</strong>. 
                When a course is reactivated:
              </p>
              
              <ul style={{ margin: "16px 0", paddingLeft: "20px", lineHeight: "1.5" }}>
                <li>Students will <strong>regain access</strong> to the course content</li>
                <li>The course will be moved back to the "Active" tab</li>
                <li>All course content and enrollments will be preserved</li>
                <li>Course activities can resume as normal</li>
              </ul>
              
              <p>Are you sure you want to reactivate this course?</p>
              
              <div className="modal-actions">
                <button 
                  className="cancel-btn" 
                  onClick={() => {
                    setShowReactivateModal(false);
                    setSelectedCourse(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="submit-btn" 
                  style={{ backgroundColor: "#28a745" }}
                  onClick={confirmReactivateCourse}
                >
                  Reactivate Course
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
