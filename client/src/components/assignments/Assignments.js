import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import { 
  FaPlus, 
  FaPaperclip, 
  FaUndo,
  FaPaperPlane,
  FaTimes,
  FaEdit,
  FaTrash,
  FaEllipsisV,
  FaCheck,
  FaFileUpload,
  FaFileDownload,
  FaGraduationCap,
  FaBold,
  FaItalic,
  FaUnderline,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
  FaListUl,
  FaListOl,
  FaIndent,
  FaOutdent,
  FaLink,
  FaFolder,
  FaCog,
  FaInfoCircle,
  FaFilePdf,
  FaFileImage,
  FaFileWord,
  FaFile
} from 'react-icons/fa';
import { 
  HiOutlineBell,
  HiOutlineMenu,
  HiOutlineX,
  HiOutlineHome,
  HiOutlineAcademicCap,
  HiOutlineChatAlt2,
  HiOutlineCog,
  HiOutlineLogout,
  HiOutlineArchive,
  HiOutlineBan,
  HiOutlineChevronDown,
  HiOutlineClipboardList,
  HiOutlineUserGroup,
  HiOutlineCalendar,
  HiOutlineAnnotation,
  HiOutlineNewspaper,
  HiOutlinePencilAlt,
  HiOutlineSearch,
  HiOutlinePresentationChartBar 
} from "react-icons/hi";
import './Assignments.css';
import '../dashboard.css';
import Sidebar from '../Sidebar';

// Add a simple toast debounce mechanism to prevent duplicate toasts
// Add this near the top of your component
const toastDebounce = {
  messages: new Set(),
  timeouts: new Map(),
  
  // Show toast only if not already shown recently
  show(type, message, options = {}) {
    const key = `${type}:${message}`;
    
    // If we've shown this message already, don't show it again
    if (this.messages.has(key)) {
      return;
    }
    
    // Add this message to our set of shown messages
    this.messages.add(key);
    
    // Show the toast
    const toastId = toast[type](message, options);
    
    // Set a timeout to remove the message from our set after a delay
    const timeout = setTimeout(() => {
      this.messages.delete(key);
      this.timeouts.delete(key);
    }, 3000); // Don't show the same message again for 3 seconds
    
    this.timeouts.set(key, timeout);
    
    return toastId;
  },
  
  // Clear all debounce timeouts on component unmount
  cleanup() {
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.messages.clear();
    this.timeouts.clear();
  }
};

const Assignments = ({ setAuth }) => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [courseDetails, setCourseDetails] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [assignmentToEdit, setAssignmentToEdit] = useState(null);
  const [showOptions, setShowOptions] = useState({});
  const [submissions, setSubmissions] = useState({});
  const [grading, setGrading] = useState({});
  const [expandedAssignments, setExpandedAssignments] = useState({});
  const [showDetails, setShowDetails] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [activeTab, setActiveTab] = useState('instruction');
  const [acceptingSubmissions, setAcceptingSubmissions] = useState(true); // Add state for toggling submission acceptance
  const [hamburgerMenuOpen, setHamburgerMenuOpen] = useState({});
  // --- Add state for grading modal ---
  const [gradingModal, setGradingModal] = useState({
    isOpen: false,
    submissionIndex: 0,
    submissions: [],
    assignment: null
  });
  
  // State for tooltip visibility
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Refs for the contentEditable divs
  const descriptionEditorRef = useRef(null);
  const editDescriptionEditorRef = useRef(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [points, setPoints] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [submissionFiles, setSubmissionFiles] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [grade, setGrade] = useState('');

  // State for tracking deleted attachments during edit
  const [deletedAttachments, setDeletedAttachments] = useState([]);
  // State for attachment removal confirmation modal
  const [attachmentRemovalModal, setAttachmentRemovalModal] = useState({
    isOpen: false,
    attachmentId: null, // ID of attachment to delete (if existing)
    index: null,        // Index in the current attachments array
    attachmentName: ''
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [userRole, setUserRole] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Try to get the sidebar state from localStorage
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState === "true";
  });
  const [inputs, setInputs] = useState({
    first_name: "",
    last_name: "",
    profilePicture: null
  });
  const [isCoursesSubmenuOpen, setIsCoursesSubmenuOpen] = useState(false);
  const { first_name, last_name } = inputs;
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Add state for course students
  const [courseStudents, setCourseStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentError, setStudentError] = useState(null);

  // Add state for the file preview modal
  const [filePreviewModal, setFilePreviewModal] = useState({
    isOpen: false,
    fileName: '',
    fileUrl: '',
    fileType: ''
  });

  // Add new state for filter dropdown
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [submissionFilter, setSubmissionFilter] = useState('all');

  // Track if grade was changed after return
  const [gradeChanged, setGradeChanged] = useState({});

  // Add state for editing points
  const [editingPoints, setEditingPoints] = useState(false);
  const [newPoints, setNewPoints] = useState('');

  // Add state for sort option
  const [sortOption, setSortOption] = useState('score-asc');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  // Add state for loading grade updates and a dummy state to force re-render
  const [gradeLoading, setGradeLoading] = useState({});
  const [, forceRerender] = useState(0);

  // Add state for missing assignments
  const [missingAssignments, setMissingAssignments] = useState({});

  // Remove the useEffect from its current position

  // Add the cleanup effect near the other useEffects, right after component initialization
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

  // Add debounce cleanup effect
  useEffect(() => {
    // Return cleanup function to clear debounce timeouts when component unmounts
    return () => {
      toastDebounce.cleanup();
    };
  }, []);

  // Add a useEffect to handle clicks outside of hamburger menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if clicked element is a hamburger menu or inside one
      if (!event.target.closest('.grade-hamburger')) {
        // Close all hamburger menus if click is outside
        setHamburgerMenuOpen({});
      }
      
      // Check if clicked element is a filter dropdown or inside one
      if (!event.target.closest('.filter-dropdown')) {
        // Close filter dropdown if click is outside
        setFilterDropdownOpen(false);
      }

      // Check if clicked element is a sorting dropdown or inside one
      if (!event.target.closest('.sorting-dropdown')) {
        // Close sorting dropdown if click is outside
        setSortDropdownOpen(false);
      }

      // Check if clicked element is the options menu toggle or inside the options menu
      if (!event.target.closest('.options-toggle') && !event.target.closest('.options-menu')) {
        // Close all options menus if click is outside
        setShowOptions({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
        throw new Error("Failed to fetch user role");
      }
      const data = await response.json();
      setUserRole(data.role);
      setIsTeacher(data.role === 'professor');
    } catch (err) {
      console.error("Error fetching user role:", err);
    }
  }, []);

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
    }
  }, [userRole]);

  const fetchAssignments = useCallback(async () => {
    if (!courseId) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch(`http://localhost:5000/assignments/${courseId}`, {
        method: "GET",
        headers: { 
          "jwt_token": token
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server response:", errorText);
        throw new Error("Failed to fetch assignments");
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("Invalid response format");
      }

      setAssignments(data);
      setError(null);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      setError(error.message || "Failed to load assignments");
      setAssignments([]);
    }
  }, [courseId]);

  const fetchSubmissions = useCallback(async (assignmentId) => {
    if (!assignmentId) return;
    try {
      console.log(`Fetching submissions for assignment ${assignmentId}`);
      
      const response = await fetch(`http://localhost:5000/assignments/${assignmentId}/submissions`, {
        method: "GET",
        headers: { "jwt_token": localStorage.token }
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        console.error(`Failed to fetch submissions: ${response.status} ${response.statusText}`);
        console.error(`Response body: ${responseText}`);
        throw new Error(`Failed to fetch submissions: ${response.status} ${response.statusText}`);
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error(`Error parsing submissions response: ${e.message}`);
        console.error(`Response body: ${responseText}`);
        throw new Error('Invalid JSON response');
      }
      
      console.log(`Found ${data.length} submissions for assignment ${assignmentId}`);
      
      // Process the submissions to ensure file URLs are correctly formatted and handle links
      const processedData = data.map(submission => {
        // If the submission has files, process them
        if (submission.files && Array.isArray(submission.files)) {
          submission.files = submission.files.map(file => {
            // Check if this is a link attachment
            if (file.mime_type === 'link') {
              return {
                ...file,
                file_url: file.file_path, // For links, the URL is stored in file_path
                isLink: true,
                type: 'link',
                file_type: 'link'
              };
            } else {
              // Handle regular files
              // Make sure file URL is properly formatted
              if (file.file_url) {
                // Extract just the filename from any nested paths
                if (file.file_url.includes('/')) {
                  const pathParts = file.file_url.split('/');
                  const filename = pathParts[pathParts.length - 1];
                  file.file_url = `/uploads/assignments/${filename}`;
                }
                
                // Remove any duplicate /uploads/ segments
                file.file_url = file.file_url.replace(/\/uploads\/uploads\//g, '/uploads/');
              }
              
              return {
                ...file,
                isLink: false,
                type: 'file',
                file_type: file.mime_type
              };
            }
          });
        }
        return submission;
      });
      
      setSubmissions(prev => ({ ...prev, [assignmentId]: processedData }));
      
    } catch (error) {
      console.error(`Error fetching submissions for assignment ${assignmentId}:`, error);
    }
  }, []);

  useEffect(() => {
    const loadUserData = async () => {
      await fetchUserRole();
      await getProfile();
      setLoading(false);
    };
    loadUserData();
  }, [fetchUserRole, getProfile]);

  // Add function to fetch course details
  const fetchCourseDetails = useCallback(async () => {
    if (!courseId) return;
    
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }
      
      // Fetch course details directly
      const response = await fetch(`http://localhost:5000/courses/${courseId}`, {
        method: "GET",
        headers: { "jwt_token": token }
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch course details");
      }
      
      const courseData = await response.json();
      console.log("Fetched course details:", courseData);
      
      // Update course details state with the response
      setCourseDetails(courseData);
      
    } catch (error) {
      console.error("Error fetching course details:", error);
    }
  }, [courseId]);
  
  // Add useEffect to call the course details fetch
  useEffect(() => {
    if (courseId) {
      fetchCourseDetails();
    }
  }, [courseId, fetchCourseDetails]);

  useEffect(() => {
    if (courseId) {
      fetchAssignments();
    }
  }, [courseId, fetchAssignments]);

  // Fetch submissions for all assignments when assignments are loaded
  useEffect(() => {
    if (assignments.length > 0) {
      assignments.forEach(assignment => {
        fetchSubmissions(assignment.assignment_id);
      });
    }
  }, [assignments, fetchSubmissions]);

  // Check for assignment ID in URL params to open modal
  useEffect(() => {
    const assignmentId = searchParams.get('assignmentId');
    const edit = searchParams.get('edit');
    const tab = searchParams.get('tab');
    const action = searchParams.get('action');
    const studentIndexStr = searchParams.get('studentIndex');
    
    if (assignmentId && assignments.length > 0) {
      const assignment = assignments.find(a => a.assignment_id.toString() === assignmentId);
      if (assignment) {
        setSelectedAssignment(assignment);
        setShowDetails(true);
        setAcceptingSubmissions(assignment.accepting_submission !== false);
        
        // If edit parameter is true, open the edit modal with the assignment data
        if (edit === 'true') {
          if (courseDetails?.status === 'archived') {
            toast.error("Cannot edit assignments in archived courses - archived courses are view-only");
          } else if (courseDetails?.status === 'inactive') {
            toast.error("Cannot edit assignments in inactive courses");
          } else {
            setAssignmentToEdit(assignment);
            setTitle(assignment.title);
            
            // Format the due date for datetime-local input
            if (assignment.due_date) {
              const date = new Date(assignment.due_date);
              if (!isNaN(date.getTime())) {
                // Adjust for local timezone
                const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
                const localDate = new Date(date.getTime() - tzOffset);
                setDueDate(localDate.toISOString().slice(0, 16));
              }
            } else {
              setDueDate('');
            }
            
            setPoints(assignment.points || '');
            const existingAttachments = (assignment.attachments || []).map(att => ({ ...att, isOriginal: true }));
            setAttachments(existingAttachments);
            setDeletedAttachments([]);
            setShowEditModal(true);
          }
        }
        
        // Set the active tab based on URL parameter if it exists
        if (tab === 'student-work' && isTeacher) {
          setActiveTab('student-work');
        } else {
          setActiveTab('instruction');
        }
        
        // Handle grading action with student index
        if (action === 'grade' && studentIndexStr && isTeacher) {
          const studentIndex = parseInt(studentIndexStr, 10);
          const assignmentSubmissions = submissions[assignment.assignment_id];
          
          if (assignmentSubmissions && assignmentSubmissions.length > 0) {
            const validIndex = Math.min(Math.max(0, studentIndex), assignmentSubmissions.length - 1);
            
            setGradingModal({
              isOpen: true,
              submissionIndex: validIndex,
              submissions: assignmentSubmissions,
              assignment
            });
            
            setActiveTab('student-work');
          }
        }
      }
    }
  }, [assignments, searchParams, courseDetails?.status, isTeacher, submissions]);

  // Helper function to check if the course is archived and block actions
  const checkArchivedCourse = () => {
    if (courseDetails?.status === 'archived') {
      toast.error("Cannot modify archived courses - archived courses are view-only for everyone");
      return true;
    }
    return false;
  };

  // Helper function to check if the course is inactive and block actions for students
  const checkInactiveCourse = () => {
    if (courseDetails?.status === 'inactive') {
      // For professors, allow grading operations but block other actions
      if (isTeacher) {
        return false; // Allow professors to continue with grading operations
      } else {
        // For students, block submission actions
        toast.error("Cannot submit to inactive courses - inactive courses are view-only for students");
        return true;
      }
    }
    return false;
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    
    // Check if course is inactive
    if (courseDetails?.status === 'inactive') {
      toast.error("Cannot create assignments in inactive courses");
      return;
    }
    
    // Check if course is archived
    if (checkArchivedCourse()) return;
    
    // Validate required fields
    if (!title.trim()) {
      toast.error("Assignment title is required");
      return;
    }
    // Remove the description validation check as it's not required on the backend
    
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      // Get content, clean &nbsp;, and send
      let descriptionContent = descriptionEditorRef.current?.innerHTML || '';
      descriptionContent = descriptionContent.replace(/&nbsp;/g, ' ').trim(); // Clean &nbsp; and trim whitespace
      formData.append('description', descriptionContent);
      if (dueDate) {
        const now = new Date();
        const due = new Date(dueDate);
        if (due < now) {
          toast.error("Due date cannot be in the past");
          return;
        }
        // Add the due date to the formData
        formData.append('due_date', dueDate);
      }
      // Add accepting_submission flag to the formData
      formData.append('accepting_submission', 'true'); // New assignments default to accepting submissions

      if (points) formData.append('points', points);

      // Add files if any
      if (attachments.length > 0) {
        // Handle links separately from files
        const linkAttachments = attachments.filter(attachment => attachment.isLink);
        const fileAttachments = attachments.filter(attachment => !attachment.isLink);
        
        console.log('Processing attachments:', {
          total: attachments.length,
          links: linkAttachments.length,
          files: fileAttachments.length,
          linkData: linkAttachments
        });
        
        // Append links as JSON data
        if (linkAttachments.length > 0) {
          const linksJson = JSON.stringify(linkAttachments.map(link => ({
            url: link.name,
            name: link.name
          })));
          console.log('Adding links to FormData:', linksJson);
          formData.append('links', linksJson);
        }
        
        // Append regular files
        fileAttachments.forEach(attachment => {
          if (attachment.file instanceof File) {
            // If it's a wrapped file object with file property
            formData.append('files', attachment.file);
            console.log(`Appending file: ${attachment.file.name}, size: ${attachment.file.size}`);
          } else if (attachment instanceof File) {
            // If it's a direct File object
            formData.append('files', attachment);
            console.log(`Appending file: ${attachment.name}, size: ${attachment.size}`);
          } else {
            console.warn('Invalid attachment format:', attachment);
          }
        });
      }

      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      console.log('Creating assignment with:', {
        title: title.trim(),
        description: description.trim(),
        dueDate,
        points,
        filesCount: attachments.length
      });

      // Start a loading indicator
      const toastId = toast.loading("Creating assignment...");
      
      // Use axios for better file upload handling
      const response = await axios.post(
        `http://localhost:5000/assignments/${courseId}`,
        formData,
        {
          headers: {
            "jwt_token": token,
            "Content-Type": "multipart/form-data"
          },
          timeout: 300000, // 5-minute timeout
          onUploadProgress: progressEvent => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            // Update loading toast with progress
            toast.loading(`Uploading: ${percentCompleted}%`, { id: toastId });
          }
        }
      );
      
      // Dismiss loading indicator
      toast.dismiss(toastId);

      toast.success("Assignment created successfully");
      setShowCreateForm(false);
      resetForm();
      await fetchAssignments();
    } catch (error) {
      console.error("Error creating assignment:", error);
      
      // More detailed error handling
      if (error.response) {
        // The request was made and the server responded with a status code
        console.error('Server response error:', error.response.data);
        toast.error(error.response.data.error || error.response.data.details || 
                   `Server error: ${error.response.status}`);
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received:', error.request);
        toast.error("No response from server. Please check your connection.");
      } else {
        // Something happened in setting up the request that triggered an Error
      toast.error(error.message || "Failed to create assignment");
      }
    }
  };

  const handleEditAssignment = async (e) => {
    e.preventDefault();
    if (!assignmentToEdit) return;
    
    // Check if course is archived
    if (checkArchivedCourse()) return;

    // Validate required fields
    if (!title.trim()) {
      toast.error("Assignment title is required");
      return;
    }
    
    let editDescriptionContent = editDescriptionEditorRef.current?.innerHTML || '';
    editDescriptionContent = editDescriptionContent.replace(/&nbsp;/g, ' ').trim();
    
    // Remove the description validation check
    
    try {
      // Start a loading indicator
      const toastId = toast.loading("Updating assignment...");
      
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', editDescriptionContent);
      
      // Handle dates and points (ensure empty strings are not sent if not required)
      if (dueDate) {
        const now = new Date();
        const due = new Date(dueDate);
        if (due < now) {
          toast.error("Due date cannot be in the past");
          return;
        }
        // Add the due date to the formData
        formData.append('due_date', dueDate);
      }
      // Don't append anything if there's no due date - let the server use NULL
      // Preserve the current accepting_submission state if present, otherwise default to true
      formData.append('accepting_submission', assignmentToEdit.accepting_submission !== false ? 'true' : 'false');

      if (points) formData.append('points', points);

      // Filter out deleted attachments before sending
      // Send only the files that are currently in the `attachments` state
      const currentFiles = attachments.filter(att => att.file instanceof File); // New files
      const existingAttachments = attachments.filter(att => !(att.file instanceof File) && att.attachment_id); // Existing files kept
      const linkAttachments = attachments.filter(att => att.isLink && !att.attachment_id); // New links
      
      console.log('Editing assignment. Current Files:', currentFiles.length, 'Existing Kept:', existingAttachments.length, 'Links:', linkAttachments.length);

      // Append new files for upload
      currentFiles.forEach(fileWrapper => {
        formData.append('files', fileWrapper.file); // Append the actual File object
      });
      
      // Append new links as JSON data
      if (linkAttachments.length > 0) {
        formData.append('links', JSON.stringify(linkAttachments.map(link => ({
          url: link.name,
          name: link.name
        }))));
      }

      // If we have deleted attachments, add them to the request
      if (deletedAttachments.length > 0) {
        formData.append('delete_attachments', JSON.stringify(deletedAttachments));
      }

      const response = await axios.put(
        `http://localhost:5000/assignments/${assignmentToEdit.assignment_id}`,
        formData,
        {
          headers: {
            "jwt_token": localStorage.token,
            "Content-Type": "multipart/form-data"
          },
          timeout: 300000, // 5-minute timeout
          onUploadProgress: progressEvent => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            // Update loading toast with progress
            toast.loading(`Uploading: ${percentCompleted}%`, { id: toastId });
          }
        }
      );

      // Dismiss loading indicator and show success
      toast.dismiss(toastId);
      toast.success("Assignment updated successfully");
      
      // First fetch the updated assignments
      await fetchAssignments();
      
      // If we have a selectedAssignment, update it with the new data
      if (selectedAssignment && selectedAssignment.assignment_id === assignmentToEdit.assignment_id) {
        // Find the updated assignment in the assignments array
        const updatedAssignment = assignments.find(
          a => a.assignment_id === assignmentToEdit.assignment_id
        );
        if (updatedAssignment) {
          setSelectedAssignment(updatedAssignment);
        }
      }
      
      // Close the edit modal and reset form
      setShowEditModal(false);
      resetForm();
      setDeletedAttachments([]); // Clear deleted tracking after successful save
    } catch (error) {
      console.error("Error updating assignment:", error);
      toast.error(error.response?.data?.error || "Failed to update assignment");
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    // Check if course is archived
    if (checkArchivedCourse()) return;
    
    // Check if course is inactive
    if (courseDetails?.status === 'inactive') {
      toast.error("Cannot delete assignments in inactive courses");
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this assignment?')) return;

    try {
      await axios.delete(`http://localhost:5000/assignments/${assignmentId}`, {
        headers: { "jwt_token": localStorage.token }
      });

      toast.success("Assignment deleted successfully");
      await fetchAssignments();
    } catch (error) {
      console.error("Error deleting assignment:", error);
      toast.error("Failed to delete assignment");
    }
  };

  const handleSubmitAssignment = async (assignmentId) => {
    // Check if course is archived
    if (checkArchivedCourse()) return;
    
    // Check if course is inactive (for students only)
    if (checkInactiveCourse()) return;
    
    // Check if the assignment is accepting submissions
    if (!selectedAssignment.accepting_submission) {
      toast.error("This assignment is not accepting submissions at this time");
      return;
    }

    // Only check due date if the assignment is not explicitly accepting submissions
    // This allows instructors to override due dates by toggling "accepting submissions"
    if (selectedAssignment.due_date && isPastDue(selectedAssignment.due_date) && !selectedAssignment.accepting_submission) {
      toast.error("The due date for this assignment has passed");
      return;
    }

    if (submissionFiles.length === 0) {
      toast.error("Please attach your submission files or links");
      return;
    }

    // Start loading indicator
    const toastId = toast.loading("Submitting assignment...");
    
    try {
      const formData = new FormData();
      
      // Separate files and links
      const fileSubmissions = submissionFiles.filter(file => !file.isLink);
      const linkSubmissions = submissionFiles.filter(file => file.isLink);
      
      console.log('Submitting:', {
        files: fileSubmissions.length,
        links: linkSubmissions.length,
        linkData: linkSubmissions
      });
      
      // Properly append the actual File objects to formData
      fileSubmissions.forEach(fileWrapper => {
        // Check if it's a wrapped file object or direct File object
        if (fileWrapper.file instanceof File) {
          formData.append('files', fileWrapper.file);
          console.log(`Appending submission file: ${fileWrapper.file.name}, size: ${fileWrapper.file.size}`);
        } else if (fileWrapper instanceof File) {
          formData.append('files', fileWrapper);
          console.log(`Appending submission file: ${fileWrapper.name}, size: ${fileWrapper.size}`);
        } else {
          console.warn('Invalid file format in submission:', fileWrapper);
        }
      });

      // Add links if any
      if (linkSubmissions.length > 0) {
        const linksJson = JSON.stringify(linkSubmissions.map(link => ({
          url: link.link_url || link.name,
          name: link.link_url || link.name
        })));
        console.log('Adding submission links to FormData:', linksJson);
        formData.append('links', linksJson);
      }

      // Implement retry logic
      let attempts = 0;
      const maxAttempts = 3;
      let success = false;
      let error = null;
      let responseData = null;
      
      while (!success && attempts < maxAttempts) {
        try {
          attempts++;
          const response = await axios.post(
            `http://localhost:5000/assignments/${assignmentId}/submit`,
            formData,
            {
              headers: {
                "jwt_token": localStorage.token,
                "token": localStorage.token, // Add both formats for compatibility
                "Content-Type": "multipart/form-data"
              },
              // Add upload progress tracking if desired
              onUploadProgress: progressEvent => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                // Update loading toast with progress
                toast.loading(`Uploading: ${percentCompleted}%`, { id: toastId });
              }
            }
          );
          
          responseData = response.data;
          success = true;
        } catch (err) {
          console.error(`Submission attempt ${attempts} failed:`, err);
          error = err;
          
          // Wait before retrying
          if (attempts < maxAttempts) {
            toast.loading(`Retrying submission (${attempts}/${maxAttempts})...`, { id: toastId });
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // Always dismiss the toast, whether successful or not
      toast.dismiss(toastId);
      
      if (success) {
        toast.success("Assignment submitted successfully");
        
        // Create new submission object with file and link information to update the local state
        const newSubmission = {
          student_id: userProfile.user_id,
          submitted_at: new Date().toISOString(),
          submission_id: responseData?.submission_id || Date.now().toString(), // Use the returned ID if available
          files: submissionFiles.map(fileWrapper => {
            if (fileWrapper.isLink) {
              // For links, create a link attachment
              return {
                file_name: fileWrapper.link_url || fileWrapper.name,
                file_size: 0,
                mime_type: 'link',
                file_url: fileWrapper.link_url || fileWrapper.name,
                isLink: true,
                type: 'link'
              };
            } else {
              // For files, create a file attachment
              const file = fileWrapper.file || fileWrapper;
              return {
                file_name: file.name,
                file_size: file.size,
                mime_type: file.type,
                // Create a temporary URL for the file that can be used immediately
                file_url: `/uploads/assignments/${file.name}`,
                isLink: false,
                type: 'file'
              };
            }
          })
        };
        
        // Immediately update the submissions state
        setSubmissions(prev => {
          const updatedAssignmentSubmissions = [...(prev[assignmentId] || [])];
          // Remove any existing submission from this student
          const filteredSubmissions = updatedAssignmentSubmissions.filter(
            sub => sub.student_id !== userProfile.user_id
          );
          // Add the new submission
          filteredSubmissions.push(newSubmission);
          
          return {
            ...prev,
            [assignmentId]: filteredSubmissions
          };
        });
        
        // Clear the submission files
        setSubmissionFiles([]);
        
        // Close the details modal after successful submission
        setShowDetails(false);
        
        // Also refresh submissions to get the actual server data
        await fetchSubmissions(assignmentId);
      } else {
        throw error || new Error("Submission failed after multiple attempts");
      }
    } catch (error) {
      // Ensure the toast is dismissed in case of error
      toast.dismiss(toastId);
      
      console.error("Error submitting assignment:", error);
      
      // Detailed error handling
      if (error.response) {
        // The request was made and the server responded with a status code
        const errorMessage = error.response.data?.error || error.response.data?.message || 
                            `Server error: ${error.response.status}`;
        toast.error(`Submission failed: ${errorMessage}`);
      } else if (error.request) {
        // The request was made but no response was received
        toast.error("No response from server. Please check your connection.");
      } else {
        // Something happened in setting up the request that triggered an Error
        toast.error(error.message || "Failed to submit assignment");
      }
    }
  };

  const handleGradeSubmission = async (submissionId) => {
    if (!grade || !feedback) {
      toast.error("Please provide both grade and feedback");
      return;
    }

    try {
      const response = await axios.post(
        `http://localhost:5000/assignments/submissions/${submissionId}/grade`,
        { grade, feedback },
        {
          headers: {
            "jwt_token": localStorage.token,
            "Content-Type": "application/json"
          }
        }
      );

      toast.success("Grade submitted successfully");
      setGrading(prev => ({ ...prev, [submissionId]: false }));
      setGrade('');
      setFeedback('');
      await fetchSubmissions(submissionId);
    } catch (error) {
      console.error("Error grading submission:", error);
      toast.error("Failed to grade submission");
    }
  };

  const handleReturnGrades = async () => {
    // Check if course is archived
    if (checkArchivedCourse()) return;
    
    // Get selected students from checkboxes
    const selectedCheckboxes = document.querySelectorAll('.student-select:checked');
    const selectedStudentIds = Array.from(selectedCheckboxes).map(checkbox => {
      const studentEntry = checkbox.closest('.student-entry');
      return studentEntry.getAttribute('data-student-id');
    });

    // If no students are selected, show a message
    if (selectedStudentIds.length === 0) {
      toast.success("Please select at least one student to return grades to");
      return;
    }

    // Get the batch grade from the top textbox
    let batchGrade = newPoints;
    const maxPoints = selectedAssignment?.points || 100;
    if (batchGrade === '' || isNaN(Number(batchGrade)) || Number(batchGrade) < 0 || Number(batchGrade) > maxPoints) {
      toast.error(`Batch grade must be a number between 0 and ${maxPoints}`);
      return;
    }
    batchGrade = Math.min(Number(batchGrade), maxPoints).toString();

    try {
      const toastId = toast.loading(`Returning grade '${batchGrade}' to ${selectedStudentIds.length} student(s)...`);
      
      // Find all submission IDs for the selected students
      const submissionIds = [];
      for (const studentId of selectedStudentIds) {
        // Find submission for this student
        const studentSubmission = submissions[selectedAssignment?.assignment_id]?.find(
          sub => sub.student_id === studentId || sub.student_id === studentId
        );
        if (studentSubmission) {
          submissionIds.push(studentSubmission.submission_id);
        }
      }
      
      if (submissionIds.length === 0) {
        toast.dismiss(toastId);
        toast.error("No valid submissions found for the selected students");
        return;
      }
      
      // Use the batch grade endpoint
      const response = await axios.post(
        "http://localhost:5000/assignments/submissions/batch-grade",
        { 
          submissionIds: submissionIds, 
          grade: batchGrade, 
          feedback: "Batch grade returned by instructor" 
        },
        {
          headers: {
            "jwt_token": localStorage.token,
            "Content-Type": "application/json"
          }
        }
      );
      
      toast.dismiss(toastId);
      const results = response.data.results || { success: [], failed: [] };
      
      if (results.success.length > 0) {
        toast.success(`Successfully returned grade '${batchGrade}' to ${results.success.length} student(s)`);
        if (results.failed.length > 0) {
          toast.error(`Failed to return grade for ${results.failed.length} student(s)`);
        }
        if (selectedAssignment) {
          await fetchSubmissions(selectedAssignment.assignment_id);
        }
      } else {
        toast.error("Failed to return any grades. Please try again.");
      }
    } catch (error) {
      toast.error("Failed to return grades: " + (error.message || "Unknown error"));
    }
  };

  // Add function to handle individual student grade return
  const handleReturnIndividualGrade = async (studentId, explicitValue = null) => {
    // Check if course is archived
    if (checkArchivedCourse()) return;
    
    setGradeLoading(prev => ({ ...prev, [studentId]: true }));
    
    console.log(`Processing grade return for student ${studentId}, explicit value: ${explicitValue}`);
    
    const assignmentId = selectedAssignment?.assignment_id;
    const studentSubmission = submissions[assignmentId]?.find(
      sub => sub.student_id === studentId || sub.student_id === studentId
    );
    const maxPoints = selectedAssignment?.points || 100;
    
    // Use explicit value if provided, otherwise try to get from DOM, then fallback to submission
    let gradeValue;
    if (explicitValue !== null && explicitValue !== '') {
      gradeValue = explicitValue;
    } else {
      const inputValue = document.querySelector(`input.grade-input[data-student-id='${studentId}']`)?.value;
      gradeValue = (inputValue !== undefined && inputValue !== '') ? inputValue : studentSubmission?.grade || '0';
    }
    
    console.log(`Final grade value to be used: ${gradeValue}`);
    
    if (!studentSubmission) {
      toast.error("No submission found for this student");
      setGradeLoading(prev => ({ ...prev, [studentId]: false }));
      return;
    }
    
    if (gradeValue === '' || isNaN(Number(gradeValue)) || Number(gradeValue) < 0 || Number(gradeValue) > maxPoints) {
      toast.error(`Grade must be a number between 0 and ${maxPoints}`);
      setGradeLoading(prev => ({ ...prev, [studentId]: false }));
      return;
    }
    
    try {
      console.log(`Submitting grade ${gradeValue} to backend for student ${studentId}`);
      
      await axios.post(
        `http://localhost:5000/assignments/submissions/${studentSubmission.submission_id}/grade`,
        { grade: gradeValue, feedback: studentSubmission.feedback || '' },
        {
          headers: {
            "jwt_token": localStorage.token,
            "Content-Type": "application/json"
          }
        }
      );
      
      console.log(`Backend update successful, refreshing data`);
      toast.success("Grade updated and returned to student");
      
      if (selectedAssignment) {
        await fetchSubmissions(selectedAssignment.assignment_id);
        
        // Find the next ungraded student
        const allSubmissions = submissions[assignmentId] || [];
        let nextStudent = null;
        
        // First try to find an ungraded student
        for (const submission of allSubmissions) {
          if (!submission.grade && !submission.returned && 
              (submission.student_id !== studentId && submission.student_id !== studentId)) {
            nextStudent = submission;
            break;
          }
        }
        
        // If no ungraded students found, try to find an unreturned student
        if (!nextStudent) {
          for (const submission of allSubmissions) {
            if (!submission.returned && 
                (submission.student_id !== studentId && submission.student_id !== studentId)) {
              nextStudent = submission;
              break;
            }
          }
        }
        
        // If a next student is found, open the grading modal for them
        if (nextStudent) {
          const nextIndex = allSubmissions.findIndex(sub => 
            sub.student_id === nextStudent.student_id || sub.student_id === nextStudent.student_id
          );
          if (nextIndex !== -1) {
            openGradingModal(selectedAssignment, allSubmissions, nextIndex);
          }
        }
        
        forceRerender(n => n + 1);
      }
    } catch (error) {
      console.error(`Error updating grade:`, error);
      toast.error("Failed to update grade");
    }
    
    setGradeLoading(prev => ({ ...prev, [studentId]: false }));
  };

  const handleFormat = (command, value = null) => {
    // Determine which editor is active based on modal visibility
    const editorRef = showEditModal ? editDescriptionEditorRef : descriptionEditorRef;
    
    if (!editorRef.current) return; // Exit if no ref

    // Indentation Limit Logic (from Stream.js)
    if (command === 'indent') {
      const MAX_INDENT_LEVEL = 8; // Define the maximum indentation level
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        let node = selection.getRangeAt(0).startContainer;
        let indentLevel = 0;
        
        // Traverse up the DOM to count blockquote ancestors within the editor
        while (node && node !== editorRef.current) {
          // In simple contentEditable, indent often uses BLOCKQUOTE
          // If a different tag is used, adjust this check
          if (node.nodeName === 'BLOCKQUOTE') { 
            indentLevel++;
          }
          node = node.parentNode;
        }
        
        // Only indent if the current level is below the maximum
        if (indentLevel < MAX_INDENT_LEVEL) {
          document.execCommand(command, false, value);
        } else {
          console.warn("Maximum indentation level reached.");
          toast.error("Maximum indentation level reached."); // User feedback
        }
      }
      editorRef.current.focus(); // Keep focus
      return; // Stop execution after handling indent
    }
    
    // Use the default execCommand for all other commands
    document.execCommand(command, false, value);
    editorRef.current.focus(); // Keep focus on the editor
  };

  const resetForm = () => {
    setTitle('');
    // Clear the contentEditable divs directly
    if (descriptionEditorRef.current) {
      descriptionEditorRef.current.innerHTML = '';
    }
    if (editDescriptionEditorRef.current) {
      editDescriptionEditorRef.current.innerHTML = '';
    }
    setDescription(''); // Also clear the state linked via onInput
    setDueDate('');
    setPoints('');
    setAttachments([]);
    setSubmissionFiles([]);
    setFeedback('');
    setGrade('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date unavailable';
    try {
      const date = new Date(dateString);
      const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Check if it's AM or PM to apply different highlighting
      const isPM = date.getHours() >= 12;
      const timeColor = isPM ? '#14A38B' : '#F2AC57'; // Updated colors: PM is teal, AM is orange
      
      // Find the time portion by looking for the pattern "at XX:XX AM/PM"
      const parts = formattedDate.split(', ');
      if (parts.length > 1) {
        // Split the second part to isolate the time portion (after "at")
        const timeParts = parts[1].split(' at ');
        if (timeParts.length > 1) {
          // Format with highlighted time portion only
          return (
            <>
              {parts[0]}, {timeParts[0]} at{' '}<span style={{ 
                backgroundColor: timeColor, 
                color: 'white', 
                padding: '2px 6px', 
                borderRadius: '4px', 
                fontWeight: 'bold',
                marginLeft: '6px' 
              }}>
                {timeParts[1]}
              </span>
            </>
          );
        }
      }
      
      return formattedDate;
    } catch (e) {
      return dateString;
    }
  };

  const formatFileSize = (sizeInBytes) => {
    if (sizeInBytes == null || isNaN(sizeInBytes) || sizeInBytes < 0) return '0 KB';
    const size = Number(sizeInBytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Add debug trace and modify the handleFileUpload function to more effectively prevent duplicate notifications
  const handleFileUpload = (e, setFiles) => {
    const selectedFiles = Array.from(e.target.files);
    if (!selectedFiles || selectedFiles.length === 0) return; // Do nothing if no files are selected

    console.log(`handleFileUpload called with ${selectedFiles.length} files and setFiles function:`, setFiles.name || 'unknown');

    let attachedCount = 0;
    let errorMessages = [];

    // Check max file size (2GB)
    const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB in bytes

    // For debugging - check what's being uploaded
    console.log('Selected files for upload:', selectedFiles);

    // Use a setTimeout to batch state updates and prevent multiple notifications
    setTimeout(() => {
    // Get current files from state to check for duplicates
    setFiles(prevFiles => {
      const updatedFiles = [...prevFiles];
      
      for (const file of selectedFiles) {
        // Check if file is empty (0 bytes)
        if (file.size === 0) {
          errorMessages.push(`Cannot attach empty file "${file.name}".`);
          continue; // Skip this file
        }

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            errorMessages.push(`File "${file.name}" exceeds the maximum size of 2GB.`);
          continue; // Skip this file
        }

          // Check if the file is already in the current files list (by name and size for better accuracy)
        const isDuplicate = updatedFiles.some(existingFile => 
            (existingFile.name === file.name && existingFile.size === file.size) ||
            (existingFile.file_name === file.name && existingFile.file_size === file.size)
        );

        if (isDuplicate) {
          errorMessages.push(`File "${file.name}" is already attached.`);
          continue; // Skip this file
        }

        // Create file thumbnail for images
        let thumbnail = null;
        if (file.type.startsWith('image/')) {
          thumbnail = URL.createObjectURL(file);
        }

          // Add the file to the updated files array - using a structured wrapper
        updatedFiles.push({
          file: file,       // Store the actual File object
          name: file.name,
          type: file.type,
          size: file.size,
            thumbnail: thumbnail,
            isNew: true       // Flag to identify newly added files
        });
        attachedCount++;
      }

        console.log(`Adding ${attachedCount} files to state, current files: ${prevFiles.length}, new total: ${updatedFiles.length}`);
        
        // Show the single toast notification OUTSIDE the state update function
        return updatedFiles;
      });
      
      // Show feedback to the user - ONE toast for all files
      if (attachedCount > 0) {
        console.log(`Showing success toast for ${attachedCount} files`);
        // Use debounced toast
        toastDebounce.show('success', `${attachedCount} file${attachedCount > 1 ? 's' : ''} attached`);
      }
      
      // Show error messages (if any) in a single toast
      if (errorMessages.length > 0) {
        console.log(`Showing error toast with ${errorMessages.length} messages`);
        // Use debounced toast
        toastDebounce.show('error', errorMessages.join('\n')); 
      }
    }, 0);
    
    // Reset the file input value to allow re-selecting the same file(s)
    e.target.value = null;
  };

  // Updated removeFile to show confirmation modal
  const removeFile = (index, files, setFiles) => {
    // Get the attachment to remove
    const fileToRemove = files[index];
    
    // Determine name and ID (if applicable)
    const name = fileToRemove.name || fileToRemove.file_name || 'Attachment';
    const id = fileToRemove.attachment_id || null;
    
    // Show confirmation modal
    setAttachmentRemovalModal({
      isOpen: true,
      attachmentId: id, 
      index: index,
      attachmentName: name
    });
    // Note: The actual removal happens in performAttachmentRemoval
  };

  // Function to handle removal after confirmation
  const performAttachmentRemoval = () => {
    const { index, attachmentId } = attachmentRemovalModal;

    if (index !== null && index >= 0) {
      try {
        // Determine which state we're modifying based on context
        // Check if this index exists in submissionFiles first
        if (index < submissionFiles.length) {
          // We're removing a submission file
          const fileToRemove = submissionFiles[index] || {};
          
          // Update submissionFiles state
          setSubmissionFiles(prev => prev.filter((_, i) => i !== index));
          
          // Cleanup thumbnail if present
          if (fileToRemove && fileToRemove.thumbnail) {
            try {
              URL.revokeObjectURL(fileToRemove.thumbnail);
            } catch (urlError) {
              console.error('Error revoking object URL:', urlError);
            }
          }
          
          toast.success('File removed from submission.');
        } else {
          // We're removing an attachment from edit/create form
          const fileToRemove = attachments[index] || {};
          
          // Update attachments state
          setAttachments(prev => prev.filter((_, i) => i !== index));
          
          // If it was an existing attachment (has an ID), track it for deletion on save
          if (attachmentId) {
            console.log(`Tracking attachment ${attachmentId} for deletion.`);
            setDeletedAttachments(prev => [...prev, attachmentId]);
          }
          
          // If it's a local file with a thumbnail, clean up the object URL
          if (fileToRemove && fileToRemove.thumbnail && fileToRemove.isNew) {
            try {
              URL.revokeObjectURL(fileToRemove.thumbnail);
            } catch (urlError) {
              console.error('Error revoking object URL:', urlError);
            }
          }
          
          toast.success('Attachment removed from list.');
        }
      } catch (error) {
        console.error('Error removing file:', error);
        toast.error('Error removing file. Please try again.');
      }
    }
    
    // Close the modal
    setAttachmentRemovalModal({
      isOpen: false,
      attachmentId: null,
      index: null,
      attachmentName: ''
    });
  };

  // Function to delete attachment directly from server (for immediate deletion)
  const deleteAttachmentFromServer = async (attachmentId) => {
    if (!attachmentId) return;
    
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Authentication required");
      return;
    }
    
    try {
      // Use loading toast for operation feedback
      const toastId = toast.loading('Deleting attachment...');
      
      // Implement retry mechanism
      let attempts = 0;
      const maxAttempts = 3;
      let success = false;
      
      while (!success && attempts < maxAttempts) {
        try {
          attempts++;
          const response = await axios.delete(
            `http://localhost:5000/assignments/attachments/${attachmentId}`,
            { 
              headers: { 
                "jwt_token": token,
                "token": token,
                "Cache-Control": "no-cache" 
              }
            }
          );
          
          console.log(`Attachment ${attachmentId} deleted successfully on attempt ${attempts}`);
          success = true;
        } catch (error) {
          console.error(`Error deleting attachment on attempt ${attempts}:`, error);
          if (attempts < maxAttempts) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      // Update toast based on outcome
      toast.dismiss(toastId);
      if (success) {
        toast.success('Attachment deleted');
      } else {
        toast.error('Failed to delete attachment after multiple attempts');
      }
    } catch (error) {
      console.error('Error in attachment deletion:', error);
      toast.error('Failed to delete attachment: ' + (error.message || 'Server error'));
    }
  };

  // Add useEffect to set initial content for edit modal
  useEffect(() => {
    if (showEditModal && assignmentToEdit && editDescriptionEditorRef.current) {
      // Set initial content when modal opens and ref is available
      editDescriptionEditorRef.current.innerHTML = assignmentToEdit.description || '';
      // Also update the state to match, in case onInput doesn't fire initially
      setDescription(assignmentToEdit.description || ''); 
    }
  }, [showEditModal, assignmentToEdit]);

  // Add useEffect for paste handling in editors
  useEffect(() => {
    const setupPasteHandler = (editorRefInstance) => {
      if (!editorRefInstance) return;

      const handlePaste = (event) => {
        event.preventDefault();
        const text = (event.clipboardData || window.clipboardData).getData('text/plain');
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        
        // Insert plain text directly (browser default formatting)
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        
        // Move cursor after inserted text
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      };

      editorRefInstance.addEventListener('paste', handlePaste);
      return () => editorRefInstance.removeEventListener('paste', handlePaste);
    };

    const cleanupCreate = setupPasteHandler(descriptionEditorRef.current);
    const cleanupEdit = setupPasteHandler(editDescriptionEditorRef.current);

    // Return cleanup function
    return () => {
      if (cleanupCreate) cleanupCreate();
      if (cleanupEdit) cleanupEdit();
    };
  }, [descriptionEditorRef.current, editDescriptionEditorRef.current]); // Re-run if refs change

  // Add function to fetch course students
  const fetchCourseStudents = useCallback(async () => {
    if (!courseId) return;
    
    try {
      setLoadingStudents(true);
      setStudentError(null);
      
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      try {
        // First try the /enrollment/course-members endpoint (used by People.js)
        // This is the proper backend endpoint according to server code
        const response = await fetch(`http://localhost:5000/enrollment/course-members/${courseId}`, {
          method: "GET",
          headers: { 
            "jwt_token": token
          }
        });

        if (response.ok) {
          const data = await response.json();
          // Extract students from the response
          if (data && data.students && Array.isArray(data.students)) {
            console.log(`Found ${data.students.length} students in course ${courseId}`);
            setCourseStudents(data.students);
            return; // Exit early if API call succeeded
          }
        }
        
        // If course-members endpoint didn't work, try alternate endpoint
        const alternateResponse = await fetch(`http://localhost:5000/courses/${courseId}/students`, {
          method: "GET",
          headers: { 
            "jwt_token": token
          }
        });

        if (alternateResponse.ok) {
          const data = await alternateResponse.json();
          if (Array.isArray(data)) {
            console.log(`Found ${data.length} students in course ${courseId} (alternate endpoint)`);
            setCourseStudents(data);
            return; // Exit early if alternate API call succeeded
          }
        }
        
        // If we get here, no API endpoint worked
        throw new Error("Could not fetch students from any API endpoint");
      } catch (apiError) {
        console.log("API endpoints not available, using mock data instead:", apiError);
        // Continue to fallback if API fails
      }

      // Fallback - Generate mock student data if API endpoint doesn't exist
      console.log("Using mock student data for demonstration");
      const mockStudents = [
        {
          student_id: "1",
          user_id: "1",
          first_name: "John",
          last_name: "Robert",
          profile_picture_url: null,
          email: "john.robert@example.com"
        },
        {
          student_id: "2",
          user_id: "2",
          first_name: "Alice",
          last_name: "Smith",
          profile_picture_url: null,
          email: "alice.smith@example.com"
        },
        {
          student_id: "3",
          user_id: "3",
          first_name: "Michael",
          last_name: "Johnson",
          profile_picture_url: null,
          email: "michael.j@example.com"
        },
        {
          student_id: "4",
          user_id: "4",
          first_name: "Sarah",
          last_name: "Williams",
          profile_picture_url: null,
          email: "sarah.w@example.com"
        },
        {
          student_id: "5",
          user_id: "5",
          first_name: "David",
          last_name: "Brown",
          profile_picture_url: null,
          email: "david.b@example.com"
        }
      ];
      
      // Add mock submission statuses for some students
      const mockSubmissions = selectedAssignment ? {
        [selectedAssignment.assignment_id]: [
          {
            student_id: "1",
            grade: "95",
            submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString() // 2 days ago
          },
          {
            student_id: "2",
            // No grade, just submitted
            submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() // 12 hours ago
          },
          {
            student_id: "4",
            grade: "85",
            submitted_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString() // 36 hours ago
          }
        ]
      } : {};
      
      // Update state with mock data
      setCourseStudents(mockStudents);
      
      // If we're also missing submission data, add mock submission data
      if (selectedAssignment && (!submissions[selectedAssignment.assignment_id] || 
          submissions[selectedAssignment.assignment_id].length === 0)) {
        setSubmissions(prev => ({
          ...prev,
          ...mockSubmissions
        }));
      }
    } catch (error) {
      console.error("Error fetching course students:", error);
      setStudentError(error.message || "Failed to load students");
      setCourseStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [courseId, selectedAssignment, submissions]);

  // Add useEffect to load students when tab changes
  useEffect(() => {
    if (activeTab === 'student-work' && selectedAssignment) {
      fetchCourseStudents();
    }
  }, [activeTab, selectedAssignment, fetchCourseStudents]);
  
  // Add effect to apply body style when grading modal is open
  useEffect(() => {
    if (gradingModal.isOpen) {
      // Add inline style to body to create a new stacking context
      document.body.style.position = 'relative';
      document.body.style.zIndex = '1';
    } else {
      // Reset when closed
      document.body.style.position = '';
      document.body.style.zIndex = '';
    }
    
    // Cleanup when unmounted
    return () => {
      document.body.style.position = '';
      document.body.style.zIndex = '';
    };
  }, [gradingModal.isOpen]);

  // Add server route check to check all files in uploads/assignments
  const findMatchingFilesInDirectory = async (attachmentId, fileName) => {
    try {
      console.log(`Looking for files in uploads/assignments related to attachment ID ${attachmentId}`);
      const token = localStorage.getItem("token");
      // This would require a server endpoint to list files in the directory
      const serverUrl = "http://localhost:5000";
      
      // Request format - ask the server for all files in the directory
      // This assumes you have an endpoint to list directory contents
      try {
        const response = await axios.get(
          `${serverUrl}/uploads/list/assignments`, 
          { 
            headers: { "jwt_token": token, "token": token }
          }
        );
        
        // If we get a list of files
        if (response.data && response.data.files) {
          const files = response.data.files;
          console.log(`Found ${files.length} files in directory`);
          
          // Look for files that might match based on name or ID
          const originalExt = getFileExtension(fileName);
          
          // Use the ID to try to find the file
          // Sometimes the ID might be part of filename
          let possibleMatches = files.filter(file => {
            return file.includes(attachmentId.toString());
          });
          
          if (possibleMatches.length > 0) {
            console.log(`Found possible matches by ID: ${possibleMatches.join(', ')}`);
            return possibleMatches;
          }
          
          // If no match by ID, try to match by name or extension
          possibleMatches = files.filter(file => {
            return file.toLowerCase().includes(fileName.toLowerCase()) || 
                   (originalExt && file.toLowerCase().endsWith(originalExt.toLowerCase()));
          });
          
          if (possibleMatches.length > 0) {
            console.log(`Found possible matches by name: ${possibleMatches.join(', ')}`);
            return possibleMatches;
          }
          
          // If we still don't have matches, return all files and we'll try them
          return files;
        }
      } catch (error) {
        console.error("Error listing directory:", error);
        // If we can't list the directory, return empty array
        return [];
      }
      
      return [];
    } catch (error) {
      console.error("Error in findMatchingFilesInDirectory:", error);
      return [];
    }
  };

  // Update downloadAttachment function to work with UUID file storage
  const downloadAttachment = async (attachmentId, fileName, fileUrl) => {
    try {
      if (!attachmentId) {
        toast.error("Cannot download: Missing file ID");
        return;
      }
      
      // Start loading indicator
      const toastId = toast.loading(`Preparing ${fileName}...`);
      
      console.log(`Attempting to download: ${fileName} (ID: ${attachmentId})`);
      
      // Try to create a direct URL to the file using our helper
      let directUrl;
      if (fileUrl) {
        directUrl = ensureProperFileUrl(fileUrl, fileName);
      } else {
        // Extract the file extension from the filename
        const fileExtension = getFileExtension(fileName);
        // Try to construct a UUID-based URL
        directUrl = `http://localhost:5000/uploads/assignments/${attachmentId}${fileExtension}`;
      }
      
      // Check if this is a preview request (if called from the assignment-attachments area)
      const isPreviewRequest = window.event && (window.event.shiftKey || window.event.metaKey || window.event.ctrlKey);
      
      if (isPreviewRequest) {
        // For preview (e.g., user clicked with modifier key), show in modal
        console.log('Previewing attachment instead of downloading');
        toast.dismiss(toastId);
        
        // Get file extension for mime type
        const fileExtension = getFileExtension(fileName).toLowerCase();
        const mimeType = getMimeType(fileName);
        
        // Show in preview modal
        showFilePreviewModal(fileName, directUrl, mimeType);
      } else {
        // For regular click, trigger download
        toast.dismiss(toastId);
        handleFileDownload(fileName, directUrl);
      }
    } catch (error) {
      console.error("Error in download process:", error);
      toast.error("Download failed: " + (error.message || "Unknown error"));
    }
  };

  // Helper function to handle successful download response
  const handleSuccessfulDownload = async (response, fileName, toastId) => {
    // Determine if file is previewable
    const isPreviewable = isFilePreviewable(fileName);
    
    // Create blob URL from response
    const blob = new Blob([response.data], { 
      type: response.headers['content-type'] || getMimeType(fileName)
    });
    const blobUrl = window.URL.createObjectURL(blob);
    
    toast.dismiss(toastId);
    
    if (isPreviewable && window.innerWidth > 768) {
      // For previewable files, show preview modal
      showFilePreviewModal(fileName, blobUrl, blob.type);
      toast.success(`Previewing ${fileName}`);
    } else {
      // For non-previewable files or on small screens, download directly
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success(`Downloading ${fileName}`);
    }
  };

  // Add helper functions for file handling
  // Determine if a file can be previewed
  const isFilePreviewable = (fileName) => {
    const ext = getFileExtension(fileName).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.pdf'].includes(ext);
  };

  // Get file extension from filename
  const getFileExtension = (fileName) => {
    return fileName.substring(fileName.lastIndexOf('.')) || '';
  };

  // Get mime type based on file extension
  const getMimeType = (fileName) => {
    const ext = getFileExtension(fileName).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  };

  // Add a function to close the file preview modal and clean up resources
  const closeFilePreviewModal = () => {
    // Revoke object URL to prevent memory leaks
    if (filePreviewModal.fileUrl) {
      try {
        URL.revokeObjectURL(filePreviewModal.fileUrl);
      } catch (error) {
        console.error("Error revoking object URL:", error);
      }
    }
    
    // Reset the modal state
    setFilePreviewModal({
      isOpen: false,
      fileName: '',
      fileUrl: '',
      fileType: ''
    });
  };

  // Function to show file preview modal
  const showFilePreviewModal = (fileName, fileUrl, fileType) => {
    // If there's already a preview open, close it first to clean up resources
    if (filePreviewModal.isOpen && filePreviewModal.fileUrl) {
      try {
        URL.revokeObjectURL(filePreviewModal.fileUrl);
      } catch (error) {
        console.error("Error revoking object URL:", error);
      }
    }
    
    // Open new preview
    setFilePreviewModal({
      isOpen: true,
      fileName,
      fileUrl,
      fileType
    });
  };

  // Add a debug function to help identify server URL patterns
  const inspectFileUrl = (attachmentId, fileName) => {
    // Create a list of possible file URLs based on common patterns
    const possibleUrls = [
      `http://localhost:5000/assignments/attachments/${attachmentId}`,
      `http://localhost:5000/uploads/files/${attachmentId}/${fileName}`,
      `http://localhost:5000/uploads/${fileName}`,
      `http://localhost:5000/uploads/${attachmentId}/${fileName}`,
      `http://localhost:5000/files/${attachmentId}/${fileName}`,
      `http://localhost:5000/assignments/${attachmentId}/download`
    ];
    
    // Show a dialog with URLs to check
    const urlToCheck = prompt(
      'Select a URL to check in your browser:', 
      possibleUrls.join('\n')
    );
    
    if (urlToCheck) {
      window.open(urlToCheck, '_blank');
    }
  };

  // Update toggle function for accepting submissions
  const toggleAcceptingSubmissions = async () => {
    // Check if course is archived
    if (checkArchivedCourse()) return;
    
    // Check if course is inactive and user is not a teacher
    if (courseDetails?.status === 'inactive') {
      toast.error("Cannot modify submission settings in inactive courses");
      return;
    }
    
    // Show loading toast
    const toastId = toast.loading(`${!acceptingSubmissions ? 'Enabling' : 'Disabling'} submissions...`);
    
    try {
      const newStatus = !acceptingSubmissions;
      
      // Update the assignment's accepting_submission status on the server
      const response = await axios.put(
        `http://localhost:5000/assignments/${selectedAssignment.assignment_id}/toggle-accepting`,
        { accepting_submission: newStatus },
        {
          headers: {
            "jwt_token": localStorage.token,
            "Content-Type": "application/json"
          }
        }
      );
      
      // Clear loading toast
      toast.dismiss(toastId);
      
      // Update local state if the request succeeded
      if (response.status === 200) {
        // Update local state
        setAcceptingSubmissions(newStatus);
        
        // Update the selected assignment object
        setSelectedAssignment(prev => ({
          ...prev,
          accepting_submission: newStatus
        }));
        
        // Show success message
        toast.success(`Submissions are now ${newStatus ? 'being accepted' : 'not being accepted'}`);
      } else {
        // If we got a response but not 200, show appropriate error
        toast.error(`Failed to update submission status: ${response.statusText}`);
      }
    } catch (error) {
      // Always dismiss the loading toast when there's an error
      toast.dismiss(toastId);
      
      // Log the error details
      console.error("Error toggling submission acceptance:", error);
      
      // Display a user-friendly error message
      let errorMessage = "Failed to update submission status";
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage += `: ${error.response.data.error}`;
      }
      
      toast.error(errorMessage);
    }
  };

  // --- Function to open grading modal ---
  const openGradingModal = (assignment, submissions, index = 0) => {
    // Validate inputs to prevent runtime errors
    if (!assignment || !submissions || !Array.isArray(submissions)) {
      toast.error("Cannot open grading modal: Missing required data");
      return;
    }
    
    // Ensure the index is valid
    const validIndex = Math.min(Math.max(0, index), submissions.length - 1);
    
    // Open the modal with validated data
    setGradingModal({
      isOpen: true,
      submissionIndex: validIndex,
      submissions,
      assignment
    });
    
    // Add URL parameters
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('assignmentId', assignment.assignment_id);
    newSearchParams.set('action', 'grade');
    newSearchParams.set('studentIndex', validIndex.toString());
    setSearchParams(newSearchParams);
  };

  // --- Function to close grading modal ---
  const closeGradingModal = () => {
    setGradingModal({
      isOpen: false,
      submissionIndex: 0,
      submissions: [],
      assignment: null
    });
    
    // Remove grading-related URL parameters
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete('action');
    newSearchParams.delete('studentIndex');
    // Keep assignmentId to stay on the assignment details page
    setSearchParams(newSearchParams);
  };

  // --- Function to handle grade/feedback change in modal ---
  const handleGradingModalChange = (field, value) => {
    // Check if course is archived
    if (checkArchivedCourse()) return;
    
    setGradingModal(prev => {
      const updatedSubmissions = [...prev.submissions];
      updatedSubmissions[prev.submissionIndex] = {
        ...updatedSubmissions[prev.submissionIndex],
        [field]: value
      };
      return { ...prev, submissions: updatedSubmissions };
    });
  };

  // --- Function to submit grade/feedback and mark as returned ---
  const handleReturnGradeModal = async () => {
    // Check if course is archived
    if (checkArchivedCourse()) return;
    
    const { submissions, submissionIndex } = gradingModal;
    const submission = submissions[submissionIndex];
    if (!submission) return;
    const maxPoints = gradingModal.assignment?.points || 100;
    if (!submission.grade) {
      toast.error('Please enter a grade.');
      return;
    }
    if (isNaN(Number(submission.grade)) || Number(submission.grade) < 0 || Number(submission.grade) > maxPoints) {
      toast.error(`Grade must be a number between 0 and ${maxPoints}`);
      return;
    }
    if (submission.returned && !gradeChanged[submission.submission_id]) {
      toast("Grade already returned. Edit the grade to return again.");
      return;
    }
    try {
      await axios.post(
        `http://localhost:5000/assignments/submissions/${submission.submission_id}/grade`,
        { grade: submission.grade, feedback: submission.feedback || '' },
        {
          headers: {
            "jwt_token": localStorage.token,
            "Content-Type": "application/json"
          }
        }
      );
      toast.success('Grade returned!');
      // Refresh submissions for this assignment
      if (gradingModal.assignment) {
        await fetchSubmissions(gradingModal.assignment.assignment_id);
      }
      // Mark as returned in local state
      setGradingModal(prev => {
        const updatedSubmissions = [...prev.submissions];
        updatedSubmissions[submissionIndex] = {
          ...updatedSubmissions[submissionIndex],
          returned: true
        };
        return { ...prev, submissions: updatedSubmissions };
      });
    } catch (error) {
      toast.error('Failed to return grade.');
    }
    setGradeChanged(prev => ({ ...prev, [submission.submission_id]: false }));
    
    // Find the next ungraded submission first
    let nextIndex = -1;
    for (let i = 0; i < submissions.length; i++) {
      if (!submissions[i].grade && !submissions[i].returned) {
        nextIndex = i;
        break;
      }
    }
    
    // If no ungraded submissions found, try to find the next unreturned submission
    if (nextIndex === -1) {
      for (let i = 0; i < submissions.length; i++) {
        if (!submissions[i].returned) {
          nextIndex = i;
          break;
        }
      }
    }
    
    // If still no submission found, go to the next submission in sequence
    if (nextIndex === -1 && submissionIndex + 1 < submissions.length) {
      nextIndex = submissionIndex + 1;
    }
    
    // If found, advance; else close modal
    if (nextIndex !== -1) {
      setGradingModal(prev => ({ ...prev, submissionIndex: nextIndex }));
      // Update URL parameters to reflect the new student index
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('studentIndex', nextIndex.toString());
      setSearchParams(newSearchParams);
    } else {
      closeGradingModal();
    }
  };

  // --- Function to navigate between submissions in modal ---
  const navigateGradingModal = (direction) => {
    setGradingModal(prev => {
      // Ensure we have valid submissions to navigate through
      if (!prev.submissions || prev.submissions.length === 0) {
        return prev;
      }
      
      // Calculate new index with bounds checking
      let newIndex = prev.submissionIndex + direction;
      if (newIndex < 0) newIndex = 0;
      if (newIndex >= prev.submissions.length) newIndex = prev.submissions.length - 1;
      
      // Only update if the index actually changed
      if (newIndex === prev.submissionIndex) {
        return prev;
      }
      
      // Update URL parameters to reflect the new student index
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('studentIndex', newIndex.toString());
      setSearchParams(newSearchParams);
      
      return { ...prev, submissionIndex: newIndex };
    });
  };

  // Add state for selected students
  const [selectedStudents, setSelectedStudents] = useState({});
  const [assignedSelections, setAssignedSelections] = useState({});
  const [isAssignedChecked, setIsAssignedChecked] = useState(false);

  // Update handleSelectAllStudents
  const handleSelectAllStudents = (e) => {
    const checked = e.target.checked;
    const allStudentIds = courseStudents.map(s => s.student_id || s.user_id);
    
    if (checked) {
      // When checking "All Students", update both selection states
      const newSelected = {};
      const newAssigned = {};
      
      allStudentIds.forEach(id => {
        const submission = submissions[selectedAssignment?.assignment_id]?.find(
          sub => sub.student_id === id
        );
        
        // If student has no grade, put them in assignedSelections
        if (!submission?.grade) {
          newAssigned[id] = true;
        } else {
          // If student has a grade, put them in selectedStudents
          newSelected[id] = true;
        }
      });
      
      setSelectedStudents(newSelected);
      setAssignedSelections(newAssigned);
    } else {
      // When unchecking "All Students", clear both states
      setSelectedStudents({});
      setAssignedSelections({});
    }
  };

  // Helper: is all students checked?
  const allStudentsChecked = useCallback(() => {
    if (!courseStudents.length) return false;
    
    return courseStudents.every(student => {
      const studentId = student.student_id || student.user_id;
      const submission = submissions[selectedAssignment?.assignment_id]?.find(
        sub => sub.student_id === studentId
      );
      
      // Check if the student is selected in the appropriate state based on their grade status
      if (!submission?.grade) {
        return assignedSelections[studentId];
      } else {
        return selectedStudents[studentId];
      }
    });
  }, [courseStudents, selectedAssignment, submissions, assignedSelections, selectedStudents]);

  // Helper: is assigned section all checked?
  const assignedSectionChecked = useCallback(() => {
    const ungradeStudents = courseStudents.filter(student => {
      const submission = submissions[selectedAssignment?.assignment_id]?.find(
        sub => sub.student_id === student.student_id || sub.student_id === student.user_id
      );
      return !submission?.grade;
    });
    
    return ungradeStudents.length > 0 && 
           ungradeStudents.every(student => 
             assignedSelections[student.student_id || student.user_id]
           );
  }, [courseStudents, selectedAssignment, submissions, assignedSelections]);

  // Helper: is graded section all checked?
  const gradedSectionChecked = useCallback(() => {
    const gradedStudents = courseStudents.filter(student => {
      const submission = submissions[selectedAssignment?.assignment_id]?.find(
        sub => sub.student_id === student.student_id || sub.student_id === student.user_id
      );
      return submission?.grade;
    });
    
    return gradedStudents.length > 0 && 
           gradedStudents.every(student => 
             selectedStudents[student.student_id || student.user_id]
           );
  }, [courseStudents, selectedAssignment, submissions, selectedStudents]);

  const handleSelectAssignedStudents = (e) => {
    const isChecked = e.target.checked;
    setIsAssignedChecked(isChecked);
    
    // Get all students who haven't been graded yet
    const ungradeStudents = courseStudents.filter(student => {
      const submission = submissions[selectedAssignment?.assignment_id]?.find(
        sub => sub.student_id === student.student_id || sub.student_id === student.user_id
      );
      return !submission?.grade;
    });

    // Update assigned selections
    const newAssignedSelections = { ...assignedSelections };
    ungradeStudents.forEach(student => {
      const studentId = student.student_id || student.user_id;
      if (isChecked) {
        newAssignedSelections[studentId] = true;
      } else {
        delete newAssignedSelections[studentId];
      }
    });
    setAssignedSelections(newAssignedSelections);
  };

  const handleSelectGradedStudents = (e) => {
    const checked = e.target.checked;
    // Find all students in the "Graded" category
    const gradedStudents = courseStudents.filter(student => {
      const submission = submissions[selectedAssignment?.assignment_id]?.find(
        sub => sub.student_id === student.student_id || sub.student_id === student.user_id
      );
      return submission && submission.grade;
    });

    // Update the selectedStudents state for all graded students
    const newSelected = { ...selectedStudents };
    gradedStudents.forEach(student => {
      if (checked) {
        newSelected[student.student_id || student.user_id] = true;
      } else {
        delete newSelected[student.student_id || student.user_id];
      }
    });
    setSelectedStudents(newSelected);
  };

  // Update individual student checkbox handler
  const handleStudentCheckboxChange = (e, studentId) => {
    const isChecked = e.target.checked;
    const submission = submissions[selectedAssignment?.assignment_id]?.find(
      sub => sub.student_id === studentId
    );
    
    // If the student hasn't been graded, update assigned selections
    if (!submission?.grade) {
      setAssignedSelections(prev => {
        const newState = { ...prev };
        if (isChecked) {
          newState[studentId] = true;
        } else {
          delete newState[studentId];
        }
        return newState;
      });
    } else {
      // For graded students, use the regular selection state
      setSelectedStudents(prev => {
        const newState = { ...prev };
        if (isChecked) {
          newState[studentId] = true;
        } else {
          delete newState[studentId];
        }
        return newState;
      });
    }
  };

  // Add new function for unsubmitting assignments
  const handleUnsubmitAssignment = async (assignmentId, submissionId) => {
    // Check if course is archived - view only
    if (courseDetails?.status === 'archived') {
      toast.error("Cannot modify submissions in archived courses - archived courses are view-only");
      return;
    }
    
    // Check if course is inactive (for students)
    if (courseDetails?.status === 'inactive' && !isTeacher) {
      toast.error("Cannot modify submissions in inactive courses - inactive courses are view-only for students");
      return;
    }
    
    if (!window.confirm('Are you sure you want to unsubmit this assignment? This action cannot be undone.')) {
      return;
    }

    // Start loading indicator first
    const toastId = toast.loading("Unsubmitting assignment...");
    
    try {
      // Get the auth token, show an error if not found
      const token = localStorage.getItem("token");
      if (!token) {
        toast.dismiss(toastId);
        toast.error("Authentication required. Please login again.");
        return;
      }
      
      // Delete the submission
      const response = await axios.delete(
        `http://localhost:5000/assignments/${assignmentId}/submissions/${submissionId}`,
        {
          headers: {
            "jwt_token": token,
            "Content-Type": "application/json"
          }
        }
      );

      toast.dismiss(toastId);
      toast.success("Assignment unsubmitted successfully");
      
      // Update local state
      setSubmissions(prev => {
        const updatedSubmissions = { ...prev };
        if (updatedSubmissions[assignmentId]) {
          updatedSubmissions[assignmentId] = updatedSubmissions[assignmentId].filter(
            sub => sub.submission_id !== submissionId
          );
        }
        return updatedSubmissions;
      });

      // Refresh submissions
      await fetchSubmissions(assignmentId);
    } catch (error) {
      // Always dismiss the loading toast when there's an error
      toast.dismiss(toastId);
      
      console.error("Error unsubmitting assignment:", error);
      
      let errorMessage = "Failed to unsubmit assignment. Please try again later.";
      
      if (error.response) {
        // If we have a response error with message
        if (error.response.data && error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.status === 401 || error.response.status === 403) {
          errorMessage = "Authentication error. Please login again.";
          // Optionally force logout on auth error
          localStorage.removeItem("token");
          setTimeout(() => {
            window.location.href = "/login";
          }, 1500);
        }
      }
      
      toast.error(errorMessage);
    }
  };

  // Helper function to ensure file URLs are properly formatted
  const ensureProperFileUrl = (fileUrl, fileName) => {
    // If it's already a full URL, return it
    if (fileUrl.startsWith('http')) {
      return fileUrl;
    }
    
    // Extract just the filename if it's a path
    let filename;
    if (fileUrl.includes('/')) {
      const parts = fileUrl.split('/');
      filename = parts[parts.length - 1];
    } else {
      filename = fileUrl;
    }
    
    // If we have a UUID pattern, use that as the filename
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]+$/i;
    if (fileUrl.match(uuidPattern)) {
      filename = fileUrl.match(uuidPattern)[0];
    }
    
    // Construct the full URL to the static file server
    return `http://localhost:5000/uploads/assignments/${filename}`;
  };

  // Add a function to handle file download from preview modal
  const handleFileDownload = (fileName, fileUrl) => {
    try {
      // Ensure the file URL is properly formatted
      const fullUrl = ensureProperFileUrl(fileUrl, fileName);
      
      console.log(`Downloading file: ${fileName} from ${fullUrl}`);
      
      // Create an invisible anchor element for download
      const link = document.createElement('a');
      
      // Set properties for download - IMPORTANT: Don't use target="_blank" as it can cause a new window
      link.href = fullUrl; 
      link.setAttribute('download', fileName);
      
      // For file types that browsers typically try to open, force the download
      // by using a Blob if it's from the same origin (CORS restrictions apply)
      if (fullUrl.startsWith(window.location.origin) || fullUrl.startsWith('http://localhost:')) {
        // Fetch the file as a blob
        fetch(fullUrl)
          .then(response => response.blob())
          .then(blob => {
            // Create a blob URL
            const blobUrl = URL.createObjectURL(blob);
            
            // Update the link to use the blob URL which forces download
            link.href = blobUrl;
            
            // Trigger the download
            document.body.appendChild(link);
            link.click();
            
            // Clean up
            setTimeout(() => {
              document.body.removeChild(link);
              URL.revokeObjectURL(blobUrl);
            }, 100);
            
            toast.success(`Downloading ${fileName}`);
          })
          .catch(err => {
            console.error('Error creating blob for download:', err);
            // Fall back to simple download
            simpleLinkDownload();
          });
      } else {
        // For cross-origin URLs, use the simple approach
        simpleLinkDownload();
      }
      
      // Helper function for simple link download
      function simpleLinkDownload() {
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Downloading ${fileName}`);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  // Fix previewSubmissionFile function to properly handle errors
  const previewSubmissionFile = async (submission) => {
    // Show loading toast
    const toastId = toast.loading('Loading preview...');
    
    try {
      if (!submission || !submission.files || submission.files.length === 0) {
        toast.dismiss(toastId);
        toast.error('No files found in this submission');
        return;
      }

      // Instead of just showing the first file, show a file selection modal
      showFileSelectionModal(submission.files);
      toast.dismiss(toastId);
    } catch (error) {
      // Ensure toast is dismissed even if there's an error
      toast.dismiss(toastId);
      console.error('Error previewing file:', error);
      toast.error('Error previewing file');
    }
  };

  // Add a new function to show a file selection modal
  const [fileSelectionModal, setFileSelectionModal] = useState({
    isOpen: false,
    files: []
  });

  // Function to show file selection modal
  const showFileSelectionModal = (files) => {
    setFileSelectionModal({
      isOpen: true,
      files: files
    });
  };

  // Function to close file selection modal
  const closeFileSelectionModal = () => {
    setFileSelectionModal({
      isOpen: false,
      files: []
    });
  };

  // Function to preview a selected file from the selection modal
  const previewSelectedFile = (file) => {
    if (!file || !file.file_url) {
      toast.error('File URL not found');
      return;
    }

    // Handle links differently from files
    if (file.isLink || file.type === 'link' || file.mime_type === 'link') {
      // For links, open in new tab
      const linkUrl = file.file_url || file.file_path || file.file_name;
      window.open(linkUrl, '_blank', 'noopener,noreferrer');
      closeFileSelectionModal();
      return;
    }

    // For files, show preview modal
    // Ensure the file URL is properly formatted
    const fullUrl = ensureProperFileUrl(file.file_url, file.file_name);
    
    // Get file extension for mime type
    const fileExtension = file.file_name.split('.').pop().toLowerCase();
    const mimeType = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif'
    }[fileExtension] || 'application/octet-stream';

    showFilePreviewModal(file.file_name, fullUrl, mimeType);
    closeFileSelectionModal();
  };

  // Fix previewLocalFile function to properly handle errors
  const previewLocalFile = (file) => {
    // Show loading toast
    const toastId = toast.loading('Preparing preview...');
    
    try {
      if (!file) {
        toast.dismiss(toastId);
        toast.error('Cannot preview file');
        return;
      }

      // Create a temporary URL for the local file
      const fileUrl = URL.createObjectURL(file instanceof File ? file : file.file);
      const fileName = file.name || file.file?.name || 'File';
      const fileType = file.type || file.file?.type || getMimeType(fileName);

      // Show the preview modal
      showFilePreviewModal(fileName, fileUrl, fileType);
      toast.dismiss(toastId);
    } catch (error) {
      // Ensure toast is dismissed even if there's an error
      toast.dismiss(toastId);
      console.error('Error previewing file:', error);
      toast.error('Could not preview file');
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
        // Fetch courses
        let endpoint = roleData.role === 'professor'
          ? 'http://localhost:5000/enrollment/professor-courses'
          : 'http://localhost:5000/enrollment/student-courses';
        const coursesRes = await fetch(endpoint, { headers: { jwt_token: token } });
        if (!coursesRes.ok) throw new Error('Failed to fetch courses');
        const coursesData = await coursesRes.json();
        setCourses(Array.isArray(coursesData) ? coursesData : []);
        
        // Check if current course is inactive or archived
        if (Array.isArray(coursesData) && courseId) {
          const currentCourse = coursesData.find(course => course.course_id === parseInt(courseId) || course.course_id === courseId);
          if (currentCourse) {
            console.log('Current course status:', currentCourse.status);
            setCourseDetails(prev => ({ 
              ...prev, 
              status: currentCourse.status // Set status directly from the API response
            }));
          }
        }
      } catch (err) {
        console.error('Error fetching user role and courses:', err);
        setCourses([]);
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchUserRoleAndCourses();
  }, [courseId]); // Add courseId as dependency to refetch when course changes

  // Add a helper function to check if due date has passed
  const isPastDue = (dueDate) => {
    if (!dueDate) return false;
    return new Date() > new Date(dueDate);
  };

  // Helper: get max points for current assignment
  const getMaxPoints = () => selectedAssignment?.points || 100;

  // Add a helper to format grades without leading zeros
  const formatGrade = (grade) => {
    if (grade === undefined || grade === null) return '';
    // Remove leading zeros, but keep '0' if that's the value
    return String(Number(grade));
  };

  // Handler to update points
  const handleUpdatePoints = async () => {
    const pointsValue = Number(newPoints);
    if (isNaN(pointsValue) || pointsValue <= 0) {
      toast.error('Points must be a positive integer');
      return;
    }
    try {
      const response = await axios.put(
        `http://localhost:5000/assignments/${selectedAssignment.assignment_id}/points`,
        { points: pointsValue },
        {
          headers: {
            "jwt_token": localStorage.token,
            "Content-Type": "application/json"
          }
        }
      );
      
      if (response.data) {
        toast.success('Points updated successfully');
        setEditingPoints(false);
        // Update the assignment data
        setSelectedAssignment(prev => ({ ...prev, points: pointsValue }));
        // Update the assignments list
        setAssignments(prev => prev.map(assignment => 
          assignment.assignment_id === selectedAssignment.assignment_id
            ? { ...assignment, points: pointsValue }
            : assignment
        ));
      }
    } catch (err) {
      console.error('Error updating points:', err);
      toast.error(err.response?.data?.error || 'Failed to update points');
    }
  };

  // Sorting logic for students
  const getSortedStudents = (students) => {
    const assignmentId = selectedAssignment?.assignment_id;
    const getScore = (student) => {
      const submission = submissions[assignmentId]?.find(
        sub => sub.student_id === student.student_id || sub.student_id === student.user_id
      );
      return submission && submission.grade ? Number(submission.grade) : -1;
    };
    const getName = (student) => `${student.first_name} ${student.last_name}`.toLowerCase();
    let sorted = [...students];
    if (sortOption === 'score-asc') {
      sorted.sort((a, b) => getScore(a) - getScore(b));
    } else if (sortOption === 'score-desc') {
      sorted.sort((a, b) => getScore(b) - getScore(a));
    } else if (sortOption === 'name-asc') {
      sorted.sort((a, b) => getName(a).localeCompare(getName(b)));
    } else if (sortOption === 'name-desc') {
      sorted.sort((a, b) => getName(b).localeCompare(getName(a)));
    }
    return sorted;
  };

  // Add a function to handle immediate grade update for a student
  const handleImmediateGradeUpdate = async (studentId, value) => {
    // Check if course is archived - view only
    if (courseDetails?.status === 'archived') {
      toast.error("Cannot grade assignments in archived courses - archived courses are view-only");
      return;
    }
    
    setGradeLoading(prev => ({ ...prev, [studentId]: true }));
    const assignmentId = selectedAssignment?.assignment_id;
    const studentSubmission = submissions[assignmentId]?.find(
      sub => sub.student_id === studentId || sub.student_id === studentId
    );
    const maxPoints = selectedAssignment?.points || 100;
    if (!studentSubmission) {
      toast.error("No submission found for this student");
      setGradeLoading(prev => ({ ...prev, [studentId]: false }));
      return;
    }
    if (value === '' || isNaN(Number(value)) || Number(value) < 0 || Number(value) > maxPoints) {
      toast.error(`Grade must be a number between 0 and ${maxPoints}`);
      setGradeLoading(prev => ({ ...prev, [studentId]: false }));
      return;
    }
    try {
      await axios.post(
        `http://localhost:5000/assignments/submissions/${studentSubmission.submission_id}/grade`,
        { grade: value, feedback: studentSubmission.feedback || '' },
        {
          headers: {
            "jwt_token": localStorage.token,
            "Content-Type": "application/json"
          }
        }
      );
      toast.success("Grade updated");
      if (selectedAssignment) {
        await fetchSubmissions(selectedAssignment.assignment_id);
      }
      // Force re-render
      forceRerender(n => n + 1);
    } catch (error) {
      toast.error("Failed to update grade");
    }
    setGradeLoading(prev => ({ ...prev, [studentId]: false }));
  };

  // Add useEffect to sync acceptingSubmissions with selected assignment
  useEffect(() => {
    if (selectedAssignment) {
      // Default to true if the property is undefined (for backward compatibility)
      setAcceptingSubmissions(selectedAssignment.accepting_submission !== false);
    }
  }, [selectedAssignment]);

  // Add a helper function to check if a submission was late
  const isLateSubmission = (submission, assignment) => {
    if (!assignment.due_date || !submission.submitted_at) return false;
    
    const dueDate = new Date(assignment.due_date);
    const submittedDate = new Date(submission.submitted_at);
    
    return submittedDate > dueDate;
  };

  // Helper function to format time with AM/PM indicator
  const formatTimeWithIndicator = (dateString) => {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const isPM = hours >= 12;
      
      // Format the time in 12-hour format
      const hour12 = hours % 12 || 12;
      const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
      const timeStr = `${hour12}:${minutesStr}`;
      
      // Format the date in a readable format
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[date.getMonth()];
      const day = date.getDate();
      const year = date.getFullYear();
      
      return {
        dateFormatted: `${month} ${day}, ${year}`,
        timeFormatted: timeStr,
        isPM: isPM,
        amPmText: isPM ? "PM" : "AM",
        fullDate: date
      };
    } catch (e) {
      console.error("Error formatting date:", e);
      return null;
    }
  };
  
  // Function to get initials from name
  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`;
  };

  // Add effect to apply body style when grading modal is open
  useEffect(() => {
    if (gradingModal.isOpen) {
      // Add inline style to body to create a new stacking context
      document.body.style.position = 'relative';
      document.body.style.zIndex = '1';
    } else {
      // Reset when closed
      document.body.style.position = '';
      document.body.style.zIndex = '';
    }
    
    // Cleanup when unmounted
    return () => {
      document.body.style.position = '';
      document.body.style.zIndex = '';
    };
  }, [gradingModal.isOpen]);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  
  // Function to open the link modal
  const showLinkUrlModal = () => {
    setLinkUrl('');
    setShowLinkModal(true);
  };

  // Function to add link as an attachment
  const handleAddLink = () => {
    if (!linkUrl.trim()) return;
    
    // Basic URL validation
    let processedUrl = linkUrl;
    if (!/^https?:\/\//i.test(processedUrl)) {
      processedUrl = `https://${processedUrl}`;
    }
    
    // Create a link attachment object
    const linkAttachment = {
      id: `link-${Date.now()}`, // Temporary ID
      name: processedUrl,
      file_name: processedUrl,
      file_size: 0, // Links don't have a size
      size: 0, // Also set size for consistency
      type: 'link',
      file_type: 'link',
      isLink: true,
      link_url: processedUrl,
      // Extract domain name for display
      display_name: new URL(processedUrl).hostname.replace(/^www\./, '')
    };
    
    // Add to both attachments list (for forms) and submission files (for assignment modal)
    setAttachments(prevAttachments => [...prevAttachments, linkAttachment]);
    setSubmissionFiles(prevFiles => [...prevFiles, linkAttachment]);
    
    // Close the modal
    setShowLinkModal(false);
  };

  // Just before the return statement, add this:
  // Render the link URL modal
  const renderLinkUrlModal = () => {
    return (
      showLinkModal && (
        <div className="modal-overlay link-url-overlay">
          <div className="modal-content link-url-modal">
            <div className="modal-header">
              <h3>Add Link</h3>
              <button 
                className="close-modal" 
                onClick={() => setShowLinkModal(false)}
                aria-label="Close dialog"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="link-url-input">Enter URL</label>
                <input
                  id="link-url-input"
                  className="link-url-input"
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => setShowLinkModal(false)}
              >
                Cancel
              </button>
              <button
                className="confirm-btn"
                onClick={handleAddLink}
                disabled={!linkUrl.trim()}
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      )
    );
  };

  // Add function to handle marking assignments as missing
  const handleMarkAsMissing = async (studentId, assignmentId) => {
    // Check if course is archived
    if (checkArchivedCourse()) return;
    
    // Get current missing status
    const currentMissingStatus = missingAssignments[studentId]?.[assignmentId] || false;
    
    // Update missing assignments state
    setMissingAssignments(prev => {
      const newState = { ...prev };
      
      // If student doesn't have an entry yet, create one
      if (!newState[studentId]) {
        newState[studentId] = {};
      }
      
      if (currentMissingStatus) {
        // If currently marked as missing, remove the missing status
        delete newState[studentId][assignmentId];
        // If student has no more missing assignments, remove their entry
        if (Object.keys(newState[studentId]).length === 0) {
          delete newState[studentId];
        }
      } else {
        // If not currently missing, mark as missing
        newState[studentId][assignmentId] = true;
      }
      
      return newState;
    });
    
    // Close the hamburger menu
    setHamburgerMenuOpen({});
  };

  // Add function to check for missing assignments based on due date
  const checkMissingAssignments = useCallback(() => {
    if (!selectedAssignment || !selectedAssignment.due_date) return;
    
    const dueDate = new Date(selectedAssignment.due_date);
    const now = new Date();
    
    if (now > dueDate) {
      // Get all students who haven't submitted
      const studentIds = courseStudents.map(student => student.student_id || student.user_id);
      const submittedStudentIds = submissions[selectedAssignment.assignment_id]?.map(sub => sub.student_id) || [];
      
      const missingStudentIds = studentIds.filter(id => !submittedStudentIds.includes(id));
      
      // Mark these students as missing
      const newMissingAssignments = { ...missingAssignments };
      missingStudentIds.forEach(studentId => {
        if (!newMissingAssignments[studentId]) {
          newMissingAssignments[studentId] = {};
        }
        newMissingAssignments[studentId][selectedAssignment.assignment_id] = true;
      });
      
      setMissingAssignments(newMissingAssignments);
    }
  }, [selectedAssignment, courseStudents, submissions, missingAssignments]);

  // Add useEffect to check for missing assignments when assignment changes
  useEffect(() => {
    checkMissingAssignments();
  }, [selectedAssignment, checkMissingAssignments]);

  // Add useEffect to clear grading state when selected assignment changes
  useEffect(() => {
    if (selectedAssignment) {
      // Clear the grading state when switching assignments
      setGrading({});
    }
  }, [selectedAssignment?.assignment_id]); // Only trigger when assignment ID changes

  if (loading) {
      return (
    <div className="dashboard-container dashboard-page assignments-container">
        <div className="loading">Loading assignments...</div>
      </div>
    );
  }
  
  const tabs = [
    { id: 'stream', label: 'Stream' },
    { id: 'messages', label: 'Messages' },
    { id: 'assignments', label: 'Assignments' },
    { id: 'exams', label: 'Exams' },
    { id: 'people', label: 'People' }
  ];

  // Render grading modal outside other elements for proper stacking
  const renderGradeSubmissionModal = () => {
    if (!gradingModal.isOpen || gradingModal.submissions.length === 0) {
      return null;
    }
    
    // Get current submission and assignment
    const currentSubmission = gradingModal.submissions[gradingModal.submissionIndex];
    const currentAssignment = gradingModal.assignment;
    
    if (!currentSubmission) {
      return null;
    }
    
    return (
      <div className="modal-overlay grading-modal-overlay">
        <div className="modal-content grading-modal">
          <div className="modal-header">
            <h3>Grade Submission</h3>
            <button className="close-modal" onClick={closeGradingModal}>×</button>
          </div>
          
          <div className="grading-nav">
            <button 
              onClick={() => navigateGradingModal(-1)} 
              disabled={gradingModal.submissionIndex === 0}
            >
              &lt; Previous
            </button>
            <span>{gradingModal.submissionIndex + 1} / {gradingModal.submissions.length}</span>
            <button 
              onClick={() => navigateGradingModal(1)} 
              disabled={gradingModal.submissionIndex === gradingModal.submissions.length - 1}
            >
              Next &gt;
            </button>
          </div>
          
          <div className="modal-body">
            <div className={`student-info-section ${isLateSubmission(currentSubmission, currentAssignment) ? 'late-submission' : ''}`}>
              <div className="student-submission-details">
                <div className="student-avatar-container">
                  {(() => {
                    const student = courseStudents.find(
                      s => s.student_id === currentSubmission.student_id || s.user_id === currentSubmission.student_id
                    );
                    
                    if (student?.profile_picture_url) {
                      return (
                        <img 
                          src={student.profile_picture_url} 
                          alt={`${student.first_name} ${student.last_name}`}
                          className="student-avatar-img"
                        />
                      );
                    } else {
                      return (
                        <div className="student-avatar-img">
                          {getInitials(student?.first_name || currentSubmission.first_name, student?.last_name || currentSubmission.last_name)}
                        </div>
                      );
                    }
                  })()}
                </div>
                
                <div className="student-submission-info">
                  <div className="student-name-text">
                    {(() => {
                      const student = courseStudents.find(
                        s => s.student_id === currentSubmission.student_id || s.user_id === currentSubmission.student_id
                      );
                      return `${student?.first_name || currentSubmission.first_name} ${student?.last_name || currentSubmission.last_name}`;
                    })()}
                  </div>
                  
                  <div className="submission-meta">
                    <div className="submission-detail">
                      <div className="submission-timestamp">
                        {(() => {
                          const timeInfo = formatTimeWithIndicator(currentSubmission.submitted_at);
                          const isLate = isLateSubmission(currentSubmission, currentAssignment);
                          
                          return (
                            <>
                              <span className="detail-label">Submitted:</span>
                              <span className="detail-value">{timeInfo?.dateFormatted}</span>
                              <span className="detail-value">at</span>
                              <span className={`time-indicator ${timeInfo?.isPM ? 'time-pm' : 'time-am'}`}>
                                {timeInfo?.timeFormatted} {timeInfo?.amPmText}
                              </span>
                              {isLate && <span className="late-badge">LATE</span>}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Submission files */}
            {currentSubmission.files && currentSubmission.files.length > 0 && (
              <div className="grading-file-preview">
                <h4>Submission Files:</h4>
                <div className="submission-files-list">
                  {currentSubmission.files.map((file, index) => (
                    <div key={index} className="file-attachment grading-file-item">
                      <div className="file-icon">
                        {file.isLink || file.type === 'link' || file.mime_type === 'link' ? (
                          <FaLink />
                        ) : file.file_name.toLowerCase().endsWith('.pdf') ? (
                          <FaFilePdf />
                        ) : file.file_name.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/) ? (
                          <FaFileImage />
                        ) : file.file_name.toLowerCase().match(/\.(doc|docx)$/) ? (
                          <FaFileWord />
                        ) : (
                          <FaFile />
                        )}
                      </div>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          
                          // Handle links differently from files
                          if (file.isLink || file.type === 'link' || file.mime_type === 'link') {
                            // For links, open in new tab
                            const linkUrl = file.file_url || file.file_path || file.file_name;
                            window.open(linkUrl, '_blank', 'noopener,noreferrer');
                          } else {
                            // For files, show preview modal
                            const fullUrl = ensureProperFileUrl(file.file_url, file.file_name);
                            const mimeType = getMimeType(file.file_name);
                            showFilePreviewModal(file.file_name, fullUrl, mimeType);
                          }
                        }}
                        className="attachment-download-link"
                        title={file.isLink || file.type === 'link' || file.mime_type === 'link' ? "Click to open link" : "Click to preview file"}
                      >
                        {file.file_name}
                      </a>
                      <span className="file-size">
                        {!(file.isLink || file.type === 'link' || file.mime_type === 'link') && `(${formatFileSize(file.file_size || 0)})`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Grading Form */}
            <div className="grading-form">
              <label>Grade (0-{currentAssignment?.points || 100}):
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\\d*"
                  min="0"
                  max={currentAssignment?.points || 100}
                  placeholder={`0–${currentAssignment?.points || 100}`}
                  value={currentSubmission.grade || ''}
                  disabled={courseDetails?.status === 'archived'}
                  onChange={e => {
                    let value = e.target.value.replace(/[^\d]/g, ''); // Only allow digits
                    // Remove leading zeros unless the value is exactly '0'
                    if (value.length > 1) {
                      value = value.replace(/^0+/, '');
                      if (value === '') value = '0';
                    }
                    const maxPoints = currentAssignment?.points || 100;
                    if (value !== '' && Number(value) > maxPoints) {
                      value = maxPoints.toString();
                      toast.error(`Grade cannot exceed ${maxPoints}`);
                    }
                    handleGradingModalChange('grade', value);
                    setGradeChanged(prev => ({
                      ...prev,
                      [currentSubmission.submission_id]: true
                    }));
                  }}
                />
              </label>
              <label>Feedback (private comment):
                <textarea
                  value={currentSubmission.feedback || ''}
                  disabled={courseDetails?.status === 'archived'}
                  onChange={e => handleGradingModalChange('feedback', e.target.value)}
                />
              </label>
              <button 
                onClick={handleReturnGradeModal} 
                className="return-btn" 
                disabled={(currentSubmission.returned && !gradeChanged[currentSubmission.submission_id]) || courseDetails?.status === 'archived'}
              >
                Return
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="dashboard-container dashboard-page assignments-container">
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
        onLogout={() => {
          localStorage.removeItem('token');
          if (setAuth) setAuth(false);
          toast.success('Logged out successfully!');
          navigate('/login');
        }}
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
      
          <div className="course-main-area">
      <nav className="course-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab ${
                    window.location.pathname.endsWith(`/${tab.id}`) || (tab.id === 'stream' && !tabs.slice(1).some(t => window.location.pathname.endsWith(`/${t.id}`)))
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
      
            <div className="assignments-content">
              {error && <div className="error-message">{error}</div>}

              {/* Create Assignment Button - Always visible but disabled for inactive and archived courses */}
              {isTeacher && !showCreateForm && (
                <div className="assignment-header-section">
                                      <div 
                      className="tooltip-container" 
                      style={{ position: 'relative', display: 'inline-block' }}
                      onMouseEnter={() => (courseDetails?.status === 'inactive' || courseDetails?.status === 'archived') && setTooltipVisible(true)}
                      onMouseLeave={() => setTooltipVisible(false)}
                    >
                                          <button
                        onClick={() => {
                          if (courseDetails?.status !== 'inactive' && courseDetails?.status !== 'archived') {
                            resetForm();
                            setShowCreateForm(true);
                          } else if (courseDetails?.status === 'archived') {
                            toast.error("Cannot create assignments in archived courses - archived courses are view-only");
                          } else {
                            toast.error("Cannot create assignments in inactive courses");
                          }
                        }}
                        className={`add-assignment-btn ${courseDetails?.status === 'inactive' ? 'inactive-course-btn' : courseDetails?.status === 'archived' ? 'archived-course-btn' : ''}`}
                        disabled={courseDetails?.status === 'inactive' || courseDetails?.status === 'archived'}
                        style={(courseDetails?.status === 'inactive' || courseDetails?.status === 'archived') ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                      >
                      <FaPlus /> Create Assignment
                    </button>
                    {(courseDetails?.status === 'inactive' || courseDetails?.status === 'archived') && (
                      <div 
                        className="custom-tooltip"
                        style={{
                          visibility: tooltipVisible ? 'visible' : 'hidden',
                          position: 'absolute',
                          zIndex: 100,
                          bottom: '100%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          padding: '8px 12px',
                          backgroundColor: '#333',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '14px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          width: 'auto',
                          minWidth: '250px',
                          maxWidth: '300px',
                          marginBottom: '8px',
                          textAlign: 'center',
                          whiteSpace: 'normal',
                          lineHeight: '1.4'
                        }}
                      >
                        {courseDetails?.status === 'archived' ? 
                          "This course is archived. New assignments cannot be created in view-only mode." : 
                          "This course is currently inactive. New assignments cannot be created."}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Create Assignment Form */}
              {isTeacher && showCreateForm && (
                <div className="assignment-form-container">
                  <div className="form-header">
                    <h3>Create New Assignment</h3>
                    <button
                      onClick={() => {
                        setShowCreateForm(false);
                        resetForm();
                      }}
                      className="close-form"
                    >
                      <FaTimes />
                    </button>
                  </div>
                  <form onSubmit={handleCreateAssignment} className="assignment-form">
                    <div className="form-group">
                      <label htmlFor="title">Title *</label>
                      <input
                        id="title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter assignment title"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="description">Description</label>
                      <div className="formatting-toolbar">
                        <button type="button" onClick={() => handleFormat('bold')} title="Bold"><FaBold /></button>
                        <button type="button" onClick={() => handleFormat('italic')} title="Italic"><FaItalic /></button>
                        <button type="button" onClick={() => handleFormat('underline')} title="Underline"><FaUnderline /></button>
                        <div className="divider"></div>
                        <button type="button" onClick={() => handleFormat('justifyLeft')} title="Align Left"><FaAlignLeft /></button>
                        <button type="button" onClick={() => handleFormat('justifyCenter')} title="Center"><FaAlignCenter /></button>
                        <button type="button" onClick={() => handleFormat('justifyRight')} title="Align Right"><FaAlignRight /></button>
                        <div className="divider"></div>
                        <button type="button" onClick={() => handleFormat('insertUnorderedList')} title="Bullet List"><FaListUl /></button>
                        <button type="button" onClick={() => handleFormat('insertOrderedList')} title="Numbered List"><FaListOl /></button>
                        <button type="button" onClick={() => handleFormat('indent')} title="Indent"><FaIndent /></button>
                        <button type="button" onClick={() => handleFormat('outdent')} title="Outdent"><FaOutdent /></button>
                        <div className="divider"></div>
                        <button type="button" onClick={() => handleFormat('removeFormat')} title="Clear Formatting"><FaUndo /></button>
                      </div>
                      <div
                        id="description"
                        ref={descriptionEditorRef}
                        className="editor-content"
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onInput={(e) => setDescription(e.currentTarget.innerHTML)}
                        data-placeholder="Enter assignment description"
                        aria-label="Assignment description"
                      ></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="dueDate">Due Date</label>
                        <input
                          id="dueDate"
                          type="datetime-local"
                          value={dueDate}
                          min={new Date().toISOString().slice(0, 16)}
                          onChange={(e) => setDueDate(e.target.value)}
                        />
                      </div>



                      
                      <div className="form-group" >
                        
                        <label htmlFor="points">Points</label>
                        <input
                          id="points"
                          type="text"
                          inputMode="numeric"
                          pattern="\d*"
                          min="0"
                          value={points}
                          onChange={(e) => {
                            // Only allow numeric input
                            let value = e.target.value.replace(/[^\d]/g, '');
                            
                            // Handle leading zeros (remove them except if value is just "0")
                            if (value.length > 1 && value.startsWith('0')) {
                              value = value.replace(/^0+/, '');
                            }
                            
                            // Ensure minimum value is 0
                            if (value === '') value = '';
                            
                            setPoints(value);
                          }}
                          placeholder="Enter points"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <div className="attachment-buttons">
                        <label className="attach-btn">
                          <FaPaperclip /> Attach Files
                          <input
                            type="file"
                            onChange={(e) => handleFileUpload(e, setAttachments)}
                            style={{ display: 'none' }}
                            multiple
                            data-form="create-assignment"
                          />
                        </label>
                        <button 
                          type="button" 
                          className="link-btn"
                          onClick={() => showLinkUrlModal()}
                        >
                          <FaLink /> Add Link
                        </button>
                      </div>
                    </div>
                    {attachments.length > 0 && (
                      <div className="editor-attachments">
                        <h4>Attachments:</h4>
                        <div className="attachment-list">
                          {attachments.map((attachment, index) => (
                            <div key={index} className="file-attachment">
                              <span className="file-icon">
                                {attachment.isLink || attachment.type === 'link' || attachment.file_type === 'link' || attachment.mime_type === 'link' ? (
                                  <FaLink className="link-icon" />
                                ) : attachment.thumbnail ? (
                                  <img src={attachment.thumbnail} alt="Preview" className="attachment-preview" />
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                    <path d="M16.5 6V3.5C16.5 2.12 15.38 1 14 1H5.5C4.12 1 3 2.12 3 3.5V18.5C3 19.88 4.12 21 5.5 21H18.5C19.88 21 21 19.88 21 18.5V8.5L16.5 6ZM5.5 3H14V7.5H18.5V18.5H5.5V3ZM7 14H17V16H7V14ZM7 10H17V12H7V10Z"/>
                                  </svg>
                                )}
                              </span>
                              <span className="attachment-file">
                                {attachment.isLink || attachment.type === 'link' || attachment.file_type === 'link' || attachment.mime_type === 'link' ? (
                                  <a href={attachment.name || attachment.file_name} target="_blank" rel="noopener noreferrer">
                                    {attachment.name || attachment.file_name}
                                  </a>
                                ) : (
                                  attachment.name || attachment.file_name
                                )}
                              </span>
                              <span className="file-size">
                                {!(attachment.isLink || attachment.type === 'link' || attachment.file_type === 'link' || attachment.mime_type === 'link') && `(${formatFileSize(attachment.size || attachment.file_size || 0)})`}
                              </span>
                              <button 
                                type="button" 
                                className="remove-attachment-btn"
                                onClick={(e) => {
                                  e.preventDefault();
                                  removeFile(index, attachments, setAttachments);
                                }}
                                title="Remove attachment"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="form-actions">
                      <button type="button" onClick={() => {
                        setShowCreateForm(false);
                        resetForm();
                      }} className="cancel-btn">
                        Cancel
                      </button>
                      <button type="submit" className="submit-btn">
                        Create Assignment
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Assignments List */}
              <div className="assignments-list">
                {assignments.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48">
                        <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                        <path d="M14 17H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                      </svg>
                    </div>
                    <p>No assignments posted yet.</p>
                  </div>
                ) : (
                  assignments.map((assignment) => (
                    <div key={assignment.assignment_id} className={`assignment-card ${expandedAssignments[assignment.assignment_id] ? 'expanded' : 'collapsed'}`}>
                      <div 
                        className="assignment-header" 
                        onClick={() => setExpandedAssignments(prev => ({
                          ...prev,
                          [assignment.assignment_id]: !prev[assignment.assignment_id]
                        }))}
                      >
                        <div className="assignment-icon">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                            <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                            <path d="M14 17H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                          </svg>
                        </div>
                        {/* Child 1: Title */}
                        <div className="assignment-title">
                          <h3>{assignment.title}</h3>
                        </div>
                        {/* Child 2: Meta Info */}
                        <div className="assignment-meta">
                          <div className="date-container">
                            {assignment.due_date ? (
                              <div className="due-date">
                                Due: {formatDate(assignment.due_date)}
                              </div>
                            ) : (
                              <div className="no-due-date">
                                No due date
                              </div>
                            )}
                          </div>
                          <div className="points-container">
                            {assignment.points && (
                              <div className="points">
                                Points: {assignment.points}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Child 3: Actions (moved out of title div) */}
                        {isTeacher && (
                          <div className="assignment-actions">
                            <button
                              className="options-toggle"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent toggling the card
                                // Don't allow options for inactive or archived courses
                                if (courseDetails?.status === 'inactive' || courseDetails?.status === 'archived') {
                                  toast.error(`Cannot modify assignments in ${courseDetails?.status} courses`);
                                  return;
                                }
                                setShowOptions(prev => ({
                                  ...prev,
                                  [assignment.assignment_id]: !prev[assignment.assignment_id]
                                }))
                              }}
                              style={(courseDetails?.status === 'inactive' || courseDetails?.status === 'archived') ? 
                                { opacity: 0.5, cursor: 'not-allowed' } : {}}
                            >
                              <FaEllipsisV />
                            </button>
                            {showOptions[assignment.assignment_id] && (
                              <div className="options-menu">
                                <button
                                  className="edit-btn"
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent toggling the card
                                    setAssignmentToEdit(assignment);
                                    setTitle(assignment.title);
                                    
                                    // Format the due date for datetime-local input (YYYY-MM-DDTHH:MM)
                                    let formattedDueDate = '';
                                    if (assignment.due_date) {
                                      const date = new Date(assignment.due_date);
                                      if (!isNaN(date.getTime())) {
                                        // Adjust for local timezone
                                        const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
                                        const localDate = new Date(date.getTime() - tzOffset);
                                        formattedDueDate = localDate.toISOString().slice(0, 16);
                                      }
                                    }
                                    setDueDate(formattedDueDate);
                                    
                                    setPoints(assignment.points || '');
                                    const existingAttachments = (assignment.attachments || []).map(att => ({ ...att, isOriginal: true }));
                                    setAttachments(existingAttachments);
                                    setDeletedAttachments([]);
                                    setShowEditModal(true);
                                    
                                    // Add edit parameter to URL
                                    const newSearchParams = new URLSearchParams(searchParams);
                                    newSearchParams.set('assignmentId', assignment.assignment_id);
                                    newSearchParams.set('edit', 'true');
                                    setSearchParams(newSearchParams);
                                    
                                    // Keep the details view open when editing
                                  }}
                                >
                                  <FaEdit /> Edit
                                </button>
                                <button
                                  className="delete-btn"
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent toggling the card
                                    handleDeleteAssignment(assignment.assignment_id);
                                  }}
                                >
                                  <FaTrash /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="expand-indicator">
                          {expandedAssignments[assignment.assignment_id] ? 
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
                            </svg> :
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
                            </svg>
                          }
                        </div>
                      </div>
                      
                      <div className={`assignment-content ${expandedAssignments[assignment.assignment_id] ? 'visible' : 'hidden'}`}>
                        {assignment.description && (
                          <div className="assignment-description">
                            <div dangerouslySetInnerHTML={{ __html: assignment.description }} />
                          </div>
                        )}
                        {assignment.attachments && assignment.attachments.length > 0 && (
                          <div className="assignment-attachments">
                            <h4>Attachments:</h4>
                            <div className="attachments-list">
                              {assignment.attachments.map((attachment, index) => {
                                // Check if attachment is a link type
                                if (attachment.type === 'link' || attachment.isLink || 
                                    (attachment.file_type && attachment.file_type === 'link') ||
                                    (attachment.mime_type === 'link') ||
                                    (attachment.file_name && attachment.file_name.startsWith('http'))) {
                                  return (
                                    <div key={index} className="file-attachment">
                                      <a
                                        href={attachment.file_name || attachment.file_url || attachment.name}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="attachment-download-link"
                                      >
                                        <FaLink /> {attachment.file_name || attachment.name}
                                      </a>
                                    </div>
                                  );
                                } else {
                                  // Regular file attachment handling
                                  let fileUrl = attachment.file_url;
                                  if (!fileUrl && attachment.attachment_id) {
                                    fileUrl = `http://localhost:5000/assignments/attachments/${attachment.attachment_id}`;
                                  }
                                  
                                  return (
                                    <div key={index} className="file-attachment">
                                      <a
                                        href="#"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          // Always show preview modal first when clicking on attachments
                                          const fileExtension = getFileExtension(attachment.file_name).toLowerCase();
                                          const mimeType = getMimeType(attachment.file_name);
                                          const directUrl = ensureProperFileUrl(fileUrl, attachment.file_name);
                                          showFilePreviewModal(attachment.file_name, directUrl, mimeType);
                                        }}
                                        className="attachment-download-link"
                                        title="Click to preview file"
                                      >
                                        <FaFileDownload /> {attachment.file_name}
                                      </a>
                                      <span className="file-size">
                                        ({formatFileSize(attachment.file_size || 0)})
                                      </span>
                                    </div>
                                  );
                                }
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className={`assignment-content ${expandedAssignments[assignment.assignment_id] ? 'visible' : 'hidden'}`}>
                        {/* View Details Link */}
                        <div className="view-instructions-section">
                          <button 
                            className="view-instructions-btn"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent toggling card
                              setShowDetails(true);
                              setSelectedAssignment(assignment);
                              // Add assignment ID to URL params without page reload
                              setSearchParams({ assignmentId: assignment.assignment_id });
                              // Initialize the accepting submissions state based on the assignment's setting
                              // Default to true if the property doesn't exist for backward compatibility
                              setAcceptingSubmissions(assignment.accepting_submission !== false);
                              setActiveTab('instruction');
                            }}
                          >
                            View details
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Assignment Modal */}
      {showEditModal && assignmentToEdit && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Assignment</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setAssignmentToEdit(null);
                  resetForm();
                  // Remove edit parameter from URL
                  const newSearchParams = new URLSearchParams(searchParams);
                  newSearchParams.delete('edit');
                  setSearchParams(newSearchParams);
                  // Don't need to do anything with showDetails, keep it as is
                }}
                className="close-modal"
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleEditAssignment} className="assignment-form">
              <div className="form-group">
                <label htmlFor="edit-title">Title *</label>
                <input
                  id="edit-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter assignment title"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-description">Description</label>
                <div className="formatting-toolbar">
                    <button type="button" onClick={() => handleFormat('bold')} title="Bold"><FaBold /></button>
                    <button type="button" onClick={() => handleFormat('italic')} title="Italic"><FaItalic /></button>
                    <button type="button" onClick={() => handleFormat('underline')} title="Underline"><FaUnderline /></button>
                    <div className="divider"></div>
                    <button type="button" onClick={() => handleFormat('justifyLeft')} title="Align Left"><FaAlignLeft /></button>
                    <button type="button" onClick={() => handleFormat('justifyCenter')} title="Center"><FaAlignCenter /></button>
                    <button type="button" onClick={() => handleFormat('justifyRight')} title="Align Right"><FaAlignRight /></button>
                    <div className="divider"></div>
                    <button type="button" onClick={() => handleFormat('insertUnorderedList')} title="Bullet List"><FaListUl /></button>
                    <button type="button" onClick={() => handleFormat('insertOrderedList')} title="Numbered List"><FaListOl /></button>
                    <button type="button" onClick={() => handleFormat('indent')} title="Indent"><FaIndent /></button>
                    <button type="button" onClick={() => handleFormat('outdent')} title="Outdent"><FaOutdent /></button>
                    <div className="divider"></div>
                    <button type="button" onClick={() => handleFormat('removeFormat')} title="Clear Formatting"><FaUndo /></button>
                </div>
                <div
                  id="edit-description"
                  ref={editDescriptionEditorRef}
                  className="editor-content"
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  onInput={(e) => setDescription(e.currentTarget.innerHTML)}
                  data-placeholder="Enter assignment description"
                  aria-label="Assignment description"
                ></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-dueDate">Due Date</label>
                  <input
                    id="edit-dueDate"
                    type="datetime-local"
                    value={dueDate}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="form-group pointscon">
                  <label htmlFor="edit-points">Points</label>
                  <input
                    id="edit-points"
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    min="0"
                    value={points}
                    onChange={(e) => {
                      // Only allow numeric input
                      let value = e.target.value.replace(/[^\d]/g, '');
                      
                      // Handle leading zeros (remove them except if value is just "0")
                      if (value.length > 1 && value.startsWith('0')) {
                        value = value.replace(/^0+/, '');
                      }
                      
                      // Ensure minimum value is 0
                      if (value === '') value = '';
                      
                      setPoints(value);
                    }}
                    placeholder="Enter points"
                  />
                </div>
              </div>
              <div className="form-group">
                <div className="attachment-buttons">
                  <label className="attach-btn">
                    <FaPaperclip /> Add Files
                    <input
                      type="file"
                      onChange={(e) => handleFileUpload(e, setAttachments)}
                      style={{ display: 'none' }}
                      multiple
                      data-form="edit-assignment"
                    />
                  </label>
                  <button 
                    type="button" 
                    className="link-btn"
                    onClick={() => showLinkUrlModal()}
                  >
                    <FaLink /> Add Link
                  </button>
                </div>
              </div>
              {attachments.length > 0 && (
                <div className="editor-attachments">
                  <h4>Attachments:</h4>
                  <div className="attachment-list">
                    {attachments.map((attachment, index) => (
                      <div key={attachment.attachment_id || index} className="file-attachment">
                        <span className="file-icon">
                          {attachment.isLink || attachment.type === 'link' || attachment.file_type === 'link' || attachment.mime_type === 'link' ? (
                            <FaLink className="link-icon" />
                          ) : attachment.thumbnail ? (
                            <img src={attachment.thumbnail} alt="Preview" className="attachment-preview" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                              <path d="M16.5 6V3.5C16.5 2.12 15.38 1 14 1H5.5C4.12 1 3 2.12 3 3.5V18.5C3 19.88 4.12 21 5.5 21H18.5C19.88 21 21 19.88 21 18.5V8.5L16.5 6ZM5.5 3H14V7.5H18.5V18.5H5.5V3ZM7 14H17V16H7V14ZM7 10H17V12H7V10Z"/>
                            </svg>
                          )}
                        </span>
                        <span 
                          className="attachment-file"
                          onClick={() => {
                            // For links, don't show preview modal
                            if (attachment.isLink || attachment.type === 'link' || attachment.file_type === 'link' || attachment.mime_type === 'link') {
                              window.open(attachment.name || attachment.file_name, '_blank', 'noopener,noreferrer');
                              return;
                            }
                            
                            // Handle file preview based on whether it's a new or existing file
                            if (attachment.file instanceof File) {
                              // For new files, use the local file preview
                              previewLocalFile(attachment);
                            } else {
                              // For existing files, use the server URL
                              const fileName = attachment.file_name || attachment.name;
                              const fileUrl = attachment.file_url || '';
                              const fileType = attachment.file_type || getMimeType(fileName);
                              const directUrl = ensureProperFileUrl(fileUrl, fileName);
                              showFilePreviewModal(fileName, directUrl, fileType);
                            }
                          }}
                          style={{ 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title={attachment.isLink || attachment.type === 'link' || attachment.file_type === 'link' || attachment.mime_type === 'link' ? "Open link" : "Click to preview file"}
                        >
                          {!(attachment.isLink || attachment.type === 'link' || attachment.file_type === 'link' || attachment.mime_type === 'link') && <FaFileDownload style={{ marginRight: '5px' }} />}
                          {attachment.name || attachment.file_name}
                        </span>
                        <span className="file-size">
                          {!(attachment.isLink || attachment.type === 'link' || attachment.file_type === 'link' || attachment.mime_type === 'link') && `(${formatFileSize(attachment.size || attachment.file_size || 0)})`}
                        </span>
                        <button 
                          type="button" 
                          className="remove-attachment-btn"
                          onClick={(e) => {
                            e.preventDefault();
                            removeFile(index, attachments, setAttachments);
                          }}
                          title="Remove attachment"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setAssignmentToEdit(null);
                    resetForm();
                    // Remove edit parameter from URL
                    const newSearchParams = new URLSearchParams(searchParams);
                    newSearchParams.delete('edit');
                    setSearchParams(newSearchParams);
                    // Don't need to do anything with showDetails, keep it as is
                  }}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Update Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attachment Removal Confirmation Modal */}
      {attachmentRemovalModal.isOpen && (
        <div className="modal-overlay attachment-removal-overlay" style={{ zIndex: 2500 }}>
          <div className="modal-content attachment-removal-modal">
            <div className="modal-header">
              <h3>Remove Attachment</h3>
              <button onClick={() => setAttachmentRemovalModal({...attachmentRemovalModal, isOpen: false})} className="close-modal">
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to remove this attachment?</p>
              <div className="attachment-name">
                {/* Simple file icon placeholder */}
                <FaPaperclip style={{ marginRight: '8px' }}/> 
                <span>{attachmentRemovalModal.attachmentName || 'Attachment'}</span>
              </div>
              {/* Add warning only if it's an existing attachment */}
              {attachmentRemovalModal.attachmentId && (
                  <p className="warning-text">Removing it here will permanently delete the file upon saving changes. This action cannot be undone.</p>
              )}
            </div>
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => setAttachmentRemovalModal({...attachmentRemovalModal, isOpen: false})}
              >
                Cancel
              </button>
              <button 
                className="confirm-btn danger-btn" // Use danger style
                onClick={() => {
                  performAttachmentRemoval(); // Call the removal handler
                }}
              >
                <FaTrash /> Remove Attachment
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Assignment Details Tabbed Interface */}
      {showDetails && selectedAssignment && (
        <div className="modal-overlay assignment-details-overlay">
          <div className="modal-content assignment-details-modal">
            <div className="modal-header">
              <h3>{selectedAssignment.title || 'Assignment Details'}</h3>
              <button onClick={() => {
                setShowDetails(false);
                // Remove assignmentId and tab from URL when closing modal
                const newSearchParams = new URLSearchParams(searchParams);
                newSearchParams.delete('assignmentId');
                newSearchParams.delete('tab');
                setSearchParams(newSearchParams);
              }} className="close-modal">
                <FaTimes />
              </button>
            </div>
            
            {courseDetails?.status === 'archived' && (
              <div style={{
                backgroundColor: '#e3f2fd',
                color: '#0d47a1',
                padding: '10px 15px',
                margin: '0 20px 15px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderLeft: '4px solid #0d47a1'
              }}>
                <FaInfoCircle size={18} />
                <span>This course is archived. You can view content but cannot make any changes.</span>
              </div>
            )}
            
            {courseDetails?.status === 'inactive' && (
              <div style={{
                backgroundColor: '#fff3cd',
                color: '#856404',
                padding: '10px 15px',
                margin: '0 20px 15px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderLeft: '4px solid #856404'
              }}>
                <FaInfoCircle size={18} />
                <span>
                  {isTeacher 
                    ? "This course is inactive. You can grade student work but cannot modify assignments."
                    : "This course is inactive. You can view content but cannot submit assignments."}
                </span>
              </div>
            )}
            
            {isTeacher ? (
              // Professor View - Tabbed Interface
              <>
                <div className="assignment-tabs">
                  <button 
                    className={`tab-button ${activeTab === 'instruction' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('instruction');
                      // Update URL parameters
                      const newSearchParams = new URLSearchParams(searchParams);
                      newSearchParams.set('assignmentId', selectedAssignment.assignment_id);
                      newSearchParams.delete('tab'); // Remove tab parameter to default to instruction
                      setSearchParams(newSearchParams);
                    }}
                  >
                    Instruction
                  </button>
                  <button 
                    className={`tab-button ${activeTab === 'student-work' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('student-work');
                      // Update URL parameters
                      const newSearchParams = new URLSearchParams(searchParams);
                      newSearchParams.set('assignmentId', selectedAssignment.assignment_id);
                      newSearchParams.set('tab', 'student-work');
                      setSearchParams(newSearchParams);
                    }}
                  >
                    Student work
                  </button>
                </div>
                
                {activeTab === 'instruction' && (
                  <div className="tab-content instruction-tab">
                    <div className="assignment-details">
                      <div className="assignment-header-info">
                        <div className="assignment-meta-info">
                          {selectedAssignment.due_date && (
                            <div className="due-date-info">
                              <span className="meta-label">Due Date:</span>
                              <span className="meta-value">{formatDate(selectedAssignment.due_date)}</span>
                            </div>
                          )}
                          {selectedAssignment.points && (
                            <div className="points-info">
                              <span className="meta-label">Points:</span>
                              <span className="meta-value">{selectedAssignment.points}</span>
                            </div>
                          )}
                          {isTeacher && (
                            <div className="edit-assignment-button-container">
                              <button 
                                 className="edit-assignment-btn"
                                 onClick={() => {
                                   if (courseDetails?.status === 'archived') {
                                     toast.error("Cannot edit assignments in archived courses - archived courses are view-only");
                                     return;
                                   }
                                   
                                   if (courseDetails?.status === 'inactive') {
                                     toast.error("Cannot edit assignments in inactive courses");
                                     return;
                                   }
                                   
                                   setAssignmentToEdit(selectedAssignment);
                                   setTitle(selectedAssignment.title);
                                   
                                   // Format the due date for datetime-local input (YYYY-MM-DDTHH:MM)
                                   let formattedDueDate = '';
                                   if (selectedAssignment.due_date) {
                                     const date = new Date(selectedAssignment.due_date);
                                     if (!isNaN(date.getTime())) {
                                       // Adjust for local timezone
                                       const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
                                       const localDate = new Date(date.getTime() - tzOffset);
                                       formattedDueDate = localDate.toISOString().slice(0, 16);
                                     }
                                   }
                                   setDueDate(formattedDueDate);
                                   
                                   setPoints(selectedAssignment.points || '');
                                   const existingAttachments = (selectedAssignment.attachments || []).map(att => ({ ...att, isOriginal: true }));
                                   setAttachments(existingAttachments);
                                   setDeletedAttachments([]);
                                   setShowEditModal(true);
                                   
                                   // Add edit parameter to URL
                                   const newSearchParams = new URLSearchParams(searchParams);
                                   newSearchParams.set('assignmentId', selectedAssignment.assignment_id);
                                   newSearchParams.set('edit', 'true');
                                   setSearchParams(newSearchParams);
                                   
                                   // Keep the details view open when editing
                                 }}
                                  disabled={courseDetails?.status === 'archived' || courseDetails?.status === 'inactive'}
                                 style={(courseDetails?.status === 'archived' || courseDetails?.status === 'inactive') ? { 
                                   opacity: 0.6, 
                                   cursor: 'not-allowed',
                                   backgroundColor: '#f1f3f4',
                                   display: 'flex',
                                   alignItems: 'center',
                                   gap: '8px',
                                   padding: '8px 16px',
                                   color: '#3c4043',
                                   border: '1px solid #dadce0',
                                   borderRadius: '4px',
                                   fontSize: '14px',
                                   fontWeight: '500'
                                 } : {
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 16px',
                                  backgroundColor: '#f1f3f4',
                                  color: '#3c4043',
                                  border: '1px solid #dadce0',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  fontWeight: '500'
                                }}
                              >
                                <FaEdit /> Edit Assignment
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="instruction-section">
                        <h4>Assignment Instructions</h4>
                        <div className="assignment-description" dangerouslySetInnerHTML={{ __html: selectedAssignment.description }} />
                      </div>
                      
                      {selectedAssignment.attachments && selectedAssignment.attachments.length > 0 && (
                        <div className="assignment-attachments">
                          <h4>Attachments:</h4>
                          <div className="attachments-list">
                            {selectedAssignment.attachments.map((attachment, index) => {
                              // Check if attachment is a link type
                              if (attachment.type === 'link' || attachment.isLink || 
                                  (attachment.file_type && attachment.file_type === 'link') ||
                                  (attachment.mime_type === 'link') ||
                                  (attachment.file_name && attachment.file_name.startsWith('http'))) {
                                return (
                                  <div key={index} className="file-attachment">
                                    <a
                                      href={attachment.file_name || attachment.file_url || attachment.name}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="attachment-download-link"
                                    >
                                      <FaLink /> {attachment.file_name || attachment.name}
                                    </a>
                                  </div>
                                );
                              } else {
                                // Regular file attachment handling
                                const attachmentId = attachment.attachment_id;
                                const fileName = attachment.file_name;
                                const fileUrl = attachment.file_url || '';
                                
                                return (
                                  <div key={index} className="file-attachment">
                                    <a
                                      href="#"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation(); // Prevent toggling when clicking link
                                        // Always show preview modal first
                                        const fileExtension = getFileExtension(fileName).toLowerCase();
                                        const mimeType = getMimeType(fileName);
                                        const directUrl = ensureProperFileUrl(fileUrl, fileName);
                                        showFilePreviewModal(fileName, directUrl, mimeType);
                                      }}
                                      className="attachment-download-link"
                                      title="Click to preview file"
                                    >
                                      <FaFileDownload /> {fileName}
                                    </a>
                                    <span className="file-size">
                                      ({formatFileSize(attachment.file_size)})
                                    </span>
                                  </div>
                                );
                              }
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {activeTab === 'student-work' && (
                  <div className="tab-content student-work-tab">
                    {/* Student Work Interface */}
                    <div className="student-work-interface">
                      <div className="student-work-toolbar">
                        <div className="toolbar-left" style={{ display: 'flex', alignItems: 'center' }}>
                          <button 
                            className="return-btn"
                            onClick={handleReturnGrades}
                            disabled={courseDetails?.status === 'archived'}
                            style={{
                              height: '36px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: courseDetails?.status === 'archived' ? 0.5 : 1,
                              cursor: courseDetails?.status === 'archived' ? 'not-allowed' : 'pointer'
                            }}
                          >
                            Return
                          </button>
                          {isTeacher ? (
                            <input
                              className="points-input"
                              type="text"
                              inputMode="numeric"
                              pattern="\\d*"
                              value={newPoints}
                              placeholder="Insert Batch Grade Here"
                              onChange={e => {
                                let value = e.target.value.replace(/[^\d]/g, '');
                                // Remove leading zeros unless the value is exactly '0'
                                if (value.length > 1) {
                                  value = value.replace(/^0+/, '');
                                  if (value === '') value = '0';
                                }
                                const maxPoints = selectedAssignment?.points || 100;
                                if (value !== '' && Number(value) > maxPoints) value = maxPoints.toString();
                                setNewPoints(value);
                              }}
                              title="Edit total points for this assignment"
                            />
                          ) : (
                            <span style={{ marginLeft: 10 }}>{selectedAssignment?.points || 100} points</span>
                          )}
                        </div>
                        <div className="toolbar-right">
                          {/* Removed settings button as it has no function */}
                        </div>
                      </div>
                      
                      <div className="student-work-content">
                        <div className="student-list-panel">
                          <div className="student-list-header">
                            <label className="select-all-students">
                              <input 
                                type="checkbox"
                                onChange={handleSelectAllStudents}
                                checked={allStudentsChecked()}
                              /> All students
                            </label>
                            <div className="sorting-dropdown">
                              <div 
                                className={`dropdown-trigger ${sortDropdownOpen ? 'active' : ''}`}
                                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                              >
                                <div className="dropdown-trigger-content">
                                  <span className="dropdown-trigger-text">
                                    {sortOption === 'score-asc' ? 'Score (ascending)' : 
                                     sortOption === 'score-desc' ? 'Score (descending)' : 
                                     sortOption === 'name-asc' ? 'Name (A-Z)' : 'Name (Z-A)'}
                                  </span>
                                </div>
                                <div className="dropdown-arrow"></div>
                              </div>
                              
                              <div className={`dropdown-menu ${sortDropdownOpen ? 'open' : ''}`}>
                                <button 
                                  className={`dropdown-option ${sortOption === 'score-asc' ? 'selected' : ''}`}
                                  onClick={() => {
                                    setSortOption('score-asc');
                                    setSortDropdownOpen(false);
                                  }}
                              >
                                  <div className="dropdown-option-content">
                                    <span className="dropdown-option-text">Score (ascending)</span>
                                  </div>
                                  <span className="dropdown-option-check">✓</span>
                                </button>
                                
                                <button 
                                  className={`dropdown-option ${sortOption === 'score-desc' ? 'selected' : ''}`}
                                  onClick={() => {
                                    setSortOption('score-desc');
                                    setSortDropdownOpen(false);
                                  }}
                                >
                                  <div className="dropdown-option-content">
                                    <span className="dropdown-option-text">Score (descending)</span>
                                  </div>
                                  <span className="dropdown-option-check">✓</span>
                                </button>
                                
                                <button 
                                  className={`dropdown-option ${sortOption === 'name-asc' ? 'selected' : ''}`}
                                  onClick={() => {
                                    setSortOption('name-asc');
                                    setSortDropdownOpen(false);
                                  }}
                                >
                                  <div className="dropdown-option-content">
                                    <span className="dropdown-option-text">Name (A-Z)</span>
                                  </div>
                                  <span className="dropdown-option-check">✓</span>
                                </button>
                                
                                <button 
                                  className={`dropdown-option ${sortOption === 'name-desc' ? 'selected' : ''}`}
                                  onClick={() => {
                                    setSortOption('name-desc');
                                    setSortDropdownOpen(false);
                                  }}
                                >
                                  <div className="dropdown-option-content">
                                    <span className="dropdown-option-text">Name (Z-A)</span>
                                  </div>
                                  <span className="dropdown-option-check">✓</span>
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          <div className="student-list">
                            {loadingStudents ? (
                              <div className="loading-students">Loading students...</div>
                            ) : studentError ? (
                              <div className="student-error">{studentError}</div>
                            ) : courseStudents.length === 0 ? (
                              <div className="empty-students">No students enrolled in this course</div>
                            ) : (
                              <>
                                {/* Assigned section - Students with no grade */}
                                <div className="student-category">
                                  <div className="category-header">
                                    <input 
                                      type="checkbox"
                                      onChange={handleSelectAssignedStudents}
                                      checked={assignedSectionChecked()}
                                    />
                                    <span className="category-name">Assigned</span>
                                  </div>
                                  
                                  {getSortedStudents(courseStudents.filter(student => {
                                    const submission = submissions[selectedAssignment?.assignment_id]?.find(
                                      sub => sub.student_id === student.student_id || sub.student_id === student.user_id
                                    );
                                    return !submission || !submission.grade;
                                  })).map((student, index) => {
                                    // Look for student's submission for this assignment
                                    const studentSubmission = submissions[selectedAssignment?.assignment_id]?.find(
                                      sub => sub.student_id === student.student_id || sub.student_id === student.user_id
                                    );
                                    return (
                                      <div 
                                        key={student.student_id || student.user_id} 
                                        className={`student-entry ${studentSubmission && isLateSubmission(studentSubmission, selectedAssignment) ? 'late-submission' : ''} ${missingAssignments[student.student_id || student.user_id]?.[selectedAssignment.assignment_id] ? 'missing-assignment' : ''}`}
                                        data-student-id={student.student_id || student.user_id}
                                      >
                                        <input 
                                          type="checkbox" 
                                          className="student-select"
                                          checked={!!assignedSelections[student.student_id || student.user_id]}
                                          onChange={(e) => handleStudentCheckboxChange(e, student.student_id || student.user_id)}
                                          onClick={(e) => e.stopPropagation()} 
                                        />
                                        <div className="student-avatar">
                                          <img 
                                            src={student.profile_picture_url || "/default-avatar.png"} 
                                            alt={`${student.first_name} ${student.last_name}`} 
                                          />
                                        </div>
                                        <div className="student-info">
                                          <div className={`student-name ${missingAssignments[student.student_id || student.user_id]?.[selectedAssignment.assignment_id] ? 'missing-assignment' : ''}`}>
                                            {student.first_name} {student.last_name}
                                          </div>
                                          <div className="student-score">
                                            {`${formatGrade(studentSubmission?.grade)}/${selectedAssignment.points || 100}`}
                                          </div>
                                        </div>
                                        <div className="student-grading">
                                          <div className="grade-divider"></div>
                                          <div className="grade-input-container">
                                            <input 
                                              type="text" 
                                              className="grade-input" 
                                              data-student-id={student.student_id || student.user_id}
                                              placeholder={studentSubmission?.grade ? String(studentSubmission.grade) : '0'}
                                              max={selectedAssignment?.points || 100}
                                              value={grading[student.student_id || student.user_id] || studentSubmission?.grade || ''}
                                              disabled={!!gradeLoading[student.student_id || student.user_id] || courseDetails?.status === 'archived'}
                                              onChange={e => {
                                                let value = e.target.value;
                                                if (value === '' || /^\d*$/.test(value)) {
                                                  const maxPoints = selectedAssignment?.points || 100;
                                                  if (value !== '' && Number(value) > maxPoints) {
                                                    value = maxPoints.toString();
                                                  }
                                                  setGrading(prev => ({
                                                    ...prev,
                                                    [student.student_id || student.user_id]: value
                                                  }));
                                                }
                                              }}
                                              onBlur={async (e) => {
                                                let value = e.target.value.replace(/[^\d]/g, '');
                                                if (value.length > 1) {
                                                  value = value.replace(/^0+/, '');
                                                  if (value === '') value = '0';
                                                }
                                                const maxPoints = selectedAssignment?.points || 100;
                                                if (value !== '' && Number(value) > maxPoints) value = maxPoints.toString();
                                                if (value !== String(studentSubmission?.grade)) {
                                                  await handleImmediateGradeUpdate(student.student_id || student.user_id, value);
                                                  if (selectedAssignment) {
                                                    await fetchSubmissions(selectedAssignment.assignment_id);
                                                    forceRerender(n => n + 1);
                                                  }
                                                }
                                              }}
                                              onKeyDown={async (e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  let value = e.target.value.replace(/[^\d]/g, '');
                                                  if (value.length > 1) {
                                                    value = value.replace(/^0+/, '');
                                                    if (value === '') value = '0';
                                                  }
                                                  const maxPoints = selectedAssignment?.points || 100;
                                                  if (value !== '' && Number(value) > maxPoints) value = maxPoints.toString();
                                                  if (value !== String(studentSubmission?.grade)) {
                                                    await handleImmediateGradeUpdate(student.student_id || student.user_id, value);
                                                    if (selectedAssignment) {
                                                      await fetchSubmissions(selectedAssignment.assignment_id);
                                                      forceRerender(n => n + 1);
                                                    }
                                                  }
                                                }
                                              }}
                                              onClick={e => e.stopPropagation()}
                                            />
                                            <span className="grade-max">/{selectedAssignment?.points || 100}</span>
                                            <div 
                                              className="grade-hamburger"
                                              onClick={e => {
                                                e.stopPropagation();
                                                setHamburgerMenuOpen(prev => ({
                                                  ...prev,
                                                  [student.student_id || student.user_id]: !prev[student.student_id || student.user_id]
                                                }));
                                              }}
                                            >
                                              <FaEllipsisV />
                                              {hamburgerMenuOpen[student.student_id || student.user_id] && (
                                                <div className="grade-menu">
                                                  <button 
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const studentId = student.student_id || student.user_id;
                                                      const gradeInput = document.querySelector(`input.grade-input[data-student-id='${studentId}']`);
                                                      const currentValue = gradeInput ? gradeInput.value : studentSubmission?.grade || '';
                                                      handleReturnIndividualGrade(studentId, currentValue);
                                                      setHamburgerMenuOpen({});
                                                    }}
                                                    disabled={gradeLoading[student.student_id || student.user_id]}
                                                  >
                                                    Return
                                                    <span className="keyboard-shortcut">Ctrl+Alt+R</span>
                                                  </button>
                                                  <button 
                                                    onClick={e => {
                                                      e.stopPropagation();
                                                      handleMarkAsMissing(student.student_id || student.user_id, selectedAssignment.assignment_id);
                                                    }}
                                                  >
                                                    {missingAssignments[student.student_id || student.user_id]?.[selectedAssignment.assignment_id] ? 'Remove Missing' : 'Mark as Missing'}
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                
                                {/* Graded section - Students with grades */}
                                <div className="student-category">
                                  <div className="category-header">
                                    <input 
                                      type="checkbox"
                                      onChange={handleSelectGradedStudents}
                                      checked={gradedSectionChecked()}
                                    />
                                    <span className="category-name">Graded</span>
              </div>
                                        
                                  {getSortedStudents(courseStudents.filter(student => {
                                    const submission = submissions[selectedAssignment?.assignment_id]?.find(
                                      sub => sub.student_id === student.student_id || sub.student_id === student.user_id
                                    );
                                    return submission && submission.grade;
                                  })).map(student => {
                                    // Look for student's submission for this assignment
                                    const studentSubmission = submissions[selectedAssignment?.assignment_id]?.find(
                                      sub => sub.student_id === student.student_id || sub.student_id === student.user_id
                                    );
                                    
                                    return (
                                      <div 
                                        key={student.student_id || student.user_id} 
                                        className={`student-entry ${studentSubmission && isLateSubmission(studentSubmission, selectedAssignment) ? 'late-submission' : ''}`}
                                        data-student-id={student.student_id || student.user_id}
                                      >
                                        <input 
                                          type="checkbox" 
                                          className="student-select"
                                          checked={!!selectedStudents[student.student_id || student.user_id]}
                                          onChange={(e) => handleStudentCheckboxChange(e, student.student_id || student.user_id)}
                                          onClick={(e) => e.stopPropagation()} 
                                        />
                                        <div className="student-avatar">
                                          <img 
                                            src={student.profile_picture_url || "/default-avatar.png"} 
                                            alt={`${student.first_name} ${student.last_name}`} 
                                          />
                                        </div>
                                        <div className="student-info">
                                          <div className={`student-name ${missingAssignments[student.student_id || student.user_id]?.[selectedAssignment.assignment_id] ? 'missing-assignment' : ''}`}>
                                            {student.first_name} {student.last_name}
                                          </div>
                                          <div className="student-score">
                                            {`${formatGrade(studentSubmission?.grade)}/${selectedAssignment.points || 100}`}
                                          </div>
                                        </div>
                                        <div className="student-grading">
                                          <div className="grade-divider"></div>
                                          <div className="grade-input-container">
                                                                                          <input 
                                              type="text" 
                                              className="grade-input" 
                                              data-student-id={student.student_id || student.user_id}
                                              value={grading[student.student_id || student.user_id] || studentSubmission.grade || ''}
                                              disabled={courseDetails?.status === 'archived'}
                                              onChange={(e) => {
                                                let value = e.target.value;
                                                // Only allow numbers, no letters or symbols
                                                if (value === '' || /^\d+$/.test(value)) {
                                                  // Clamp value to max points
                                                  if (value !== '' && Number(value) > getMaxPoints()) value = getMaxPoints().toString();
                                                  setGrading(prev => ({
                                                    ...prev,
                                                    [student.student_id || student.user_id]: value
                                                  }));
                                                }
                                              }}
                                            />
                                            <span className="grade-max">/{selectedAssignment?.points || 100}</span>
                                            <div 
                                              className="grade-hamburger"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setHamburgerMenuOpen(prev => ({
                                                  ...prev,
                                                  [student.student_id || student.user_id]: !prev[student.student_id || student.user_id]
                                                }));
                                              }}
                                            >
                                              <FaEllipsisV />
                                              {hamburgerMenuOpen[student.student_id || student.user_id] && (
                                                <div className="grade-menu">
                                                  <button 
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const studentId = student.student_id || student.user_id;
                                                      const gradeInput = document.querySelector(`input.grade-input[data-student-id='${studentId}']`);
                                                      const currentValue = gradeInput ? gradeInput.value : studentSubmission?.grade || '';
                                                      handleReturnIndividualGrade(studentId, currentValue);
                                                      setHamburgerMenuOpen({});
                                                    }}
                                                    disabled={gradeLoading[student.student_id || student.user_id]}
                                                  >
                                                    Return
                                                    <span className="keyboard-shortcut">Ctrl+Alt+R</span>
                                                  </button>
                                                  <button 
                                                    onClick={e => {
                                                      e.stopPropagation();
                                                      handleMarkAsMissing(student.student_id || student.user_id, selectedAssignment.assignment_id);
                                                    }}
                                                  >
                                                    {missingAssignments[student.student_id || student.user_id]?.[selectedAssignment.assignment_id] ? 'Remove Missing' : 'Mark as Missing'}
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="submission-panel">
                          <div className="submission-header">
                            <div className="title-section">
                              <h4>{selectedAssignment.title || 'Assignment Details'}</h4>
                                                              {courseDetails?.status === 'archived' && (
                                  <div 
                                    style={{
                                      backgroundColor: '#e3f2fd', 
                                      color: '#0d47a1',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '13px',
                                      fontWeight: 'bold',
                                      display: 'inline-block',
                                      marginLeft: '10px',
                                      marginRight: '10px'
                                    }}
                                  >
                                    ARCHIVED COURSE (VIEW ONLY)
                                  </div>
                                )}
                                {courseDetails?.status === 'inactive' && (
                                  <div 
                                    style={{
                                      backgroundColor: '#fff3cd', 
                                      color: '#856404',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '13px',
                                      fontWeight: 'bold',
                                      display: 'inline-block',
                                      marginLeft: '10px',
                                      marginRight: '10px'
                                    }}
                                  >
                                    INACTIVE COURSE {isTeacher ? "(GRADING ONLY)" : "(VIEW ONLY)"}
                                  </div>
                                )}
                                
                            <div className="submission-stats">
                              {(() => {
                                // Calculate counts
                                const totalStudents = courseStudents.length;
                                const submittedCount = submissions[selectedAssignment?.assignment_id]?.length || 0;
                                const gradedCount = submissions[selectedAssignment?.assignment_id]?.filter(sub => sub.grade)?.length || 0;
                                
                                return (
                                  <>
                                    <div className="stat-item">
                                      <span className="stat-value">{submittedCount}</span>
                                      <span className="stat-label">Turned in</span>
                                    </div>
                                    <div className="stat-item">
                                      <span className="stat-value">{totalStudents}</span>
                                      <span className="stat-label">Assigned</span>
                                    </div>
                                    <div className="stat-item">
                                      <span className="stat-value">{gradedCount}</span>
                                      <span className="stat-label">Graded</span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          
                          {/* Adding filter dropdown to the submission panel (inside the submission-filter div) */}
                          <div className="submission-filter">
                            <div className="filter-dropdown">
                            <div 
                                className={`dropdown-trigger ${filterDropdownOpen ? 'active' : ''}`}
                              onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                            >
                                <div className="dropdown-trigger-content">
                                  <span className="dropdown-trigger-text">
                              {submissionFilter === 'all' 
                                ? 'All' 
                                : submissionFilter === 'graded' 
                                  ? 'Graded' 
                                        : 'Not Graded'}
                                  </span>
                                </div>
                                <div className="dropdown-arrow"></div>
                              </div>
                              
                              <div className={`filter-options-dropdown ${filterDropdownOpen ? 'open' : ''}`}>
                                  <button 
                                    className={submissionFilter === 'all' ? 'active' : ''}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSubmissionFilter('all');
                                      setFilterDropdownOpen(false);
                                    }}
                                  >
                                  <div className="dropdown-option-content">
                                    <span className="dropdown-option-text">All</span>
                                  </div>
                                  <span className="dropdown-option-check">✓</span>
                                  </button>
                                  <button 
                                    className={submissionFilter === 'graded' ? 'active' : ''}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSubmissionFilter('graded');
                                      setFilterDropdownOpen(false);
                                    }}
                                  >
                                  <div className="dropdown-option-content">
                                    <span className="dropdown-option-text">Graded</span>
                                  </div>
                                  <span className="dropdown-option-check">✓</span>
                                  </button>
                                  <button 
                                    className={submissionFilter === 'not-graded' ? 'active' : ''}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSubmissionFilter('not-graded');
                                      setFilterDropdownOpen(false);
                                    }}
                                  >
                                  <div className="dropdown-option-content">
                                    <span className="dropdown-option-text">Not Graded</span>
                                  </div>
                                  <span className="dropdown-option-check">✓</span>
                                  </button>
                                </div>
                            </div>
                            <div className="submission-status">
                                  <span 
                                   className={`status-indicator ${acceptingSubmissions ? 'accepting' : 'not-accepting'} ${courseDetails?.status === 'archived' || courseDetails?.status === 'inactive' ? 'disabled' : ''}`}
                                    onClick={(courseDetails?.status !== 'archived' && courseDetails?.status !== 'inactive') ? 
                                      toggleAcceptingSubmissions : undefined}
                                    style={(courseDetails?.status === 'archived' || courseDetails?.status === 'inactive') ? {
                                      opacity: 0.6,
                                      cursor: 'not-allowed',
                                      pointerEvents: 'none'
                                    } : {}}
                                  >
                                    {acceptingSubmissions ? <FaCheck /> : <FaTimes />}
                                    {acceptingSubmissions ? 'Accepting submission' : 'Not accepting submission'}
                                    {courseDetails?.status === 'archived' && ' (Locked)'}
                                    {courseDetails?.status === 'inactive' && !isTeacher && ' (Locked)'}
                                  </span>
                                </div>
                            </div>
                          </div>
                          
                          <div className="submissions-grid">
                            {submissions[selectedAssignment?.assignment_id]?.length > 0 ? (
                              submissions[selectedAssignment.assignment_id]
                                .filter(submission => {
                                  // Apply filter based on the selected filter option
                                  if (submissionFilter === 'all') {
                                    return true; // Show all submissions
                                  } else if (submissionFilter === 'graded') {
                                    return submission.grade != null; // Show only graded submissions
                                  } else if (submissionFilter === 'not-graded') {
                                    return submission.grade == null; // Show only non-graded submissions
                                  }
                                  return true; // Default: show all
                                })
                                .map((submission) => {
                                // Find student for this submission
                                const student = courseStudents.find(
                                  s => s.student_id === submission.student_id || s.user_id === submission.student_id
                                );
                                
                                if (!student) return null;
                                
                                // Format the submission time
                                const timeInfo = formatTimeWithIndicator(submission.submitted_at);
                                const isLate = isLateSubmission(submission, selectedAssignment);
                                
                                return (
                                  <div 
                                    key={submission.submission_id}
                                    className={`student-submission-details ${isLate ? 'late-submission' : ''}`}
                                    onClick={() => {
                                      // Find the index of this submission in the submissions array
                                      const subIndex = submissions[selectedAssignment?.assignment_id]?.findIndex(
                                        sub => sub.student_id === submission.student_id
                                      );
                                      if (subIndex >= 0) {
                                        openGradingModal(selectedAssignment, submissions[selectedAssignment.assignment_id], subIndex);
                                      }
                                    }}
                                  >
                                    <div className="student-avatar-container">
                                      {student.profile_picture_url ? (
                                        <img 
                                          src={student.profile_picture_url} 
                                          alt={`${student.first_name} ${student.last_name}`}
                                          className="student-avatar-img"
                                        />
                                      ) : (
                                        <div className="student-avatar-img">
                                          {getInitials(student.first_name, student.last_name)}
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="student-submission-info">
                                      <div className="student-name-text">
                                        {student.first_name} {student.last_name}
                                      </div>
                                      
                                      <div className="submission-meta">
                                        <div className="submission-detail">
                                          <div className="submission-timestamp">
                                            <span className="detail-label">Submitted:</span>
                                            <span className="detail-value">{timeInfo?.dateFormatted}</span>
                                            <span className="detail-value">at</span>
                                            <span className={`time-indicator ${timeInfo?.isPM ? 'time-pm' : 'time-am'}`}>
                                              {timeInfo?.timeFormatted} {timeInfo?.amPmText}
                                            </span>
                                            {isLate && <span className="late-badge">LATE</span>}
                                          </div>
                                        </div>
                                        
                                        {submission.grade && (
                                          <div className="submission-detail">
                                            <span className="detail-label">Grade:</span>
                                            <span className="detail-value">
                                              {submission.grade}/{selectedAssignment.points || 100}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="no-submissions">No submissions yet</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Student View - Single View with Submission
              <div className="tab-content instruction-tab">
                <div className="assignment-details">
                  <div className="assignment-header-info">
                    <div className="assignment-meta-info">
                      {selectedAssignment.due_date && (
                        <div className="due-date-info">
                          <span className="meta-label">Due Date:</span>
                          <span className="meta-value">{formatDate(selectedAssignment.due_date)}</span>
                        </div>
                      )}
                      {selectedAssignment.points && (
                        <div className="points-info">
                          <span className="meta-label">Points:</span>
                          <span className="meta-value">{selectedAssignment.points}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="instruction-section">
                    <h4>Assignment Instructions</h4>
                    <div className="assignment-description" dangerouslySetInnerHTML={{ __html: selectedAssignment.description }} />
                  </div>
                  
                  {selectedAssignment.attachments && selectedAssignment.attachments.length > 0 && (
                    <div className="assignment-attachments">
                      <h4>Attachments:</h4>
                      <div className="attachments-list">
                        {selectedAssignment.attachments.map((attachment, index) => {
                          // Check if attachment is a link type
                          if (attachment.type === 'link' || attachment.isLink || 
                              (attachment.file_type && attachment.file_type === 'link') ||
                              (attachment.file_name && attachment.file_name.startsWith('http'))) {
                            return (
                              <div key={index} className="file-attachment">
                                <a
                                  href={attachment.file_name || attachment.file_url || attachment.name}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="attachment-download-link"
                                >
                                  <FaLink /> {attachment.file_name || attachment.name}
                                </a>
                              </div>
                            );
                          }
                          
                          // Regular file attachment handling
                          return (
                            <div key={index} className="file-attachment">
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  const fileName = attachment.file_name;
                                  const fileUrl = attachment.file_url;
                                  // Replace the debug function with proper preview functionality
                                  const fileExtension = getFileExtension(fileName).toLowerCase();
                                  const mimeType = getMimeType(fileName);
                                  // Ensure we have a proper URL
                                  const directUrl = ensureProperFileUrl(fileUrl || `http://localhost:5000/assignments/attachments/${attachment.attachment_id}`, fileName);
                                  showFilePreviewModal(fileName, directUrl, mimeType);
                                }}
                                className="attachment-download-link"
                              >
                                <FaFileDownload /> {attachment.file_name}
                              </a>
                              <span className="file-size">
                                ({formatFileSize(attachment.file_size || 0)})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Student Submission Section */}
                  <div className="instruction-section your-submission">
                    <h4>Your Submission</h4>
                    {(() => {
                      // Get student's submission if any
                      const studentSubmission = submissions[selectedAssignment.assignment_id]?.find(
                        sub => sub.student_id === userProfile.user_id
                      );
                      
                      // Check if submission exists
                      if (studentSubmission) {
                        // If student has already submitted
                        return (
                          <div className={`submission-files-list ${isLateSubmission(studentSubmission, selectedAssignment) ? 'late-submission' : ''}`}>
                            {/* Show late submission indicator if appropriate */}
                            {isLateSubmission(studentSubmission, selectedAssignment) && (
                              <div className="late-submission-indicator">
                                Late Submission
                              </div>
                            )}
                            <h5>
                              Submitted: {new Date(studentSubmission.submitted_at).toLocaleString()}
                            </h5>
                            <div className="submitted-file-item">
                              <div className="submitted-file-info">
                                <div className="submitted-file-icon">
                                  {userProfile?.profile_picture_url ? (
                                    <img 
                                      src={userProfile.profile_picture_url}
                                      alt={`${userProfile.first_name} ${userProfile.last_name}`}
                                      className="student-avatar-img"
                                      style={{ width: "32px", height: "32px" }}
                                    />
                                  ) : (
                                    <div className="student-avatar-img" style={{ width: "32px", height: "32px", fontSize: "14px" }}>
                                      {getInitials(userProfile?.first_name, userProfile?.last_name)}
                                    </div>
                                  )}
                                </div>
                                <div className="submitted-file-details">
                                  <div className="submitted-file-name">Your submission</div>
                                  <div className="submission-timestamp">
                                    {(() => {
                                      const timeInfo = formatTimeWithIndicator(studentSubmission.submitted_at);
                                      const isLate = isLateSubmission(studentSubmission, selectedAssignment);
                                      
                                      return (
                                        <>
                                          <span className="detail-label">Submitted:</span>
                                          <span className="detail-value">{timeInfo?.dateFormatted}</span>
                                          <span className="detail-value">at</span>
                                          <span className={`time-indicator ${timeInfo?.isPM ? 'time-pm' : 'time-am'}`}>
                                            {timeInfo?.timeFormatted} {timeInfo?.amPmText}
                                          </span>
                                          {isLate && <span className="late-badge">LATE</span>}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="submission-actions">
                                {studentSubmission.files && studentSubmission.files.length > 0 && (
                                  <>
                                    <button 
                                      className="preview-btn"
                                      onClick={() => previewSubmissionFile(studentSubmission)}
                                    >
                                      <FaFileDownload /> View Files ({studentSubmission.files.length})
                                    </button>
                                    <div className="submission-files-preview">
                                      {studentSubmission.files.map((file, index) => (
                                        <div key={index} className="submission-file-badge" title={file.file_name}>
                                          {file.isLink || file.type === 'link' || file.mime_type === 'link' ? 
                                            '🔗' : 
                                            file.file_name.split('.').pop().toUpperCase()
                                          }
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                                {/* Only allow unsubmit if submissions are being accepted and not graded */}
                                {selectedAssignment.accepting_submission && !studentSubmission.grade && !studentSubmission.returned && (
                                  <button 
                                    className="unsubmit-btn"
                                    onClick={() => handleUnsubmitAssignment(selectedAssignment.assignment_id, studentSubmission.submission_id)}
                                  >
                                    <FaUndo /> Unsubmit
                                  </button>
                                )}
                              </div>
                              
                              {studentSubmission.grade ? (
                                <div className="submission-grade">
                                  <div className="grade-value">{studentSubmission.grade}/{selectedAssignment.points || 100}</div>
                                  {studentSubmission.feedback && (
                                    <div className="feedback">
                                      <span className="feedback-label">Feedback: </span>
                                      {studentSubmission.feedback}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="submission-status">
                                  <span className="status-text">Not Graded</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      } else if (selectedAssignment.due_date && isPastDue(selectedAssignment.due_date) && !selectedAssignment.accepting_submission) {
                        // If due date has passed and not explicitly accepting submissions
                        return (
                          <div className="no-submission">
                            <p>The due date for this assignment has passed. You can no longer submit files.</p>
                          </div>
                        );
                      } else if (!selectedAssignment.accepting_submission) {
                        // If assignment is not accepting submissions
                        return (
                          <div className="no-submission">
                            <p>This assignment is not accepting submissions at this time.</p>
                          </div>
                        );
                      } else {
                        // Student has not submitted yet and can still submit
                        return (
                          <>
                                                      <div className="no-submission">
                            <p>You haven't submitted anything yet.</p>
                            {selectedAssignment.due_date && isPastDue(selectedAssignment.due_date) && 
                              courseDetails?.status !== 'inactive' && courseDetails?.status !== 'archived' && (
                              <p className="past-due-note">Note: The due date has passed, but the instructor is still accepting submissions.</p>
                            )}
                            {courseDetails?.status === 'archived' && (
                              <div style={{ 
                                marginTop: '10px',
                                padding: '8px 12px',
                                backgroundColor: '#e3f2fd',
                                borderRadius: '4px',
                                borderLeft: '4px solid #0d47a1'
                              }}>
                                <p style={{ margin: '0', fontWeight: 'bold', color: '#0d47a1' }}>
                                  This course has been archived. You can no longer submit assignments.
                                </p>
                              </div>
                            )}
                            {courseDetails?.status === 'inactive' && (
                              <div style={{ 
                                marginTop: '10px',
                                padding: '8px 12px',
                                backgroundColor: '#fff3cd',
                                borderRadius: '4px',
                                borderLeft: '4px solid #856404'
                              }}>
                                <p style={{ margin: '0', fontWeight: 'bold', color: '#856404' }}>
                                  This course is inactive. You can view content but cannot submit assignments.
                                </p>
                              </div>
                            )}
                          </div>
                          
                          {courseDetails?.status !== 'archived' && courseDetails?.status !== 'inactive' ? (
                            <div className="upload-submission">
                              <div className="attachment-buttons">
                                <label className="upload-btn">
                                  <FaFileUpload /> Add Files
                                  <input 
                                    type="file" 
                                    onChange={(e) => handleFileUpload(e, setSubmissionFiles)} 
                                    style={{ display: 'none' }} 
                                    multiple 
                                    data-form="submission"
                                  />
                                </label>
                                
                                <button 
                                  type="button" 
                                  className="link-btn"
                                  onClick={() => showLinkUrlModal()}
                                >
                                  <FaLink /> Add Link
                                </button>
                              </div>
                              
                              {submissionFiles.length > 0 && (
                                <div className="selected-files">
                                  {submissionFiles.map((file, index) => (
                                    <div key={index} className={`selected-file ${file.isLink ? 'link-file' : ''}`}>
                                      <div 
                                        className="file-name"
                                        onClick={() => {
                                          if (file.isLink) {
                                            window.open(file.link_url, '_blank');
                                          } else {
                                            previewLocalFile(file);
                                          }
                                        }}
                                        style={{ cursor: 'pointer' }}
                                        title={file.isLink ? "Click to open link" : "Click to preview file"}
                                      >
                                        {file.isLink ? (
                                          <FaLink style={{ marginRight: '5px' }} />
                                        ) : (
                                          <FaFileDownload style={{ marginRight: '5px' }} />
                                        )}
                                        {file.isLink ? file.display_name || file.name || file.file_name : (file.name || file.file?.name)}
                                      </div>
                                      <div className="file-size">
                                        {file.isLink ? '' : `(${formatFileSize(file.size || file.file?.size)})`}
                                      </div>
                                      <button 
                                        className="remove-file" 
                                        onClick={() => removeFile(index, submissionFiles, setSubmissionFiles)}
                                      >
                                        <FaTimes />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {submissionFiles.length > 0 && (
                                <button 
                                  className="submit-assignment-btn" 
                                  onClick={() => handleSubmitAssignment(selectedAssignment.assignment_id)}
                                >
                                  <FaPaperPlane /> Submit Assignment
                                </button>
                              )}
                            </div>
                          ) : null}
                          </>
                        );
                      }
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* File Preview Modal */}
      {filePreviewModal.isOpen && (
        <div className="modal-overlay file-preview-overlay" onClick={closeFilePreviewModal}>
          <div className="modal-content file-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{filePreviewModal.fileName}</h3>
              <div className="modal-actions">
                <button 
                  className="download-btn"
                  onClick={() => handleFileDownload(filePreviewModal.fileName, filePreviewModal.fileUrl)}
                >
                  <FaFileDownload /> Download
                </button>
                <button 
                  onClick={closeFilePreviewModal} 
                  className="close-modal"
                >
                  <FaTimes />
                </button>
              </div>
            </div>
            
            <div className="modal-body">
              {filePreviewModal.fileType.startsWith('image/') ? (
                <img 
                  src={filePreviewModal.fileUrl} 
                  alt={filePreviewModal.fileName} 
                  className="file-preview-image" 
                />
              ) : filePreviewModal.fileType === 'application/pdf' ? (
                <embed 
                  src={filePreviewModal.fileUrl} 
                  type="application/pdf" 
                  width="100%" 
                  height="600px" 
                  className="file-preview-pdf" 
                />
              ) : (
                <div className="file-preview-unavailable">
                  <p>Preview not available for this file type.</p>
                  <p>Please download the file to view it.</p>
                  <div className="file-preview-icon">
                    <FaFileDownload size={48} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* File Selection Modal */}
      {fileSelectionModal.isOpen && (
        <div className="modal-overlay file-selection-overlay">
          <div className="modal-content file-selection-modal">
            <div className="modal-header">
              <h3>Select File to Preview</h3>
              <button onClick={closeFileSelectionModal} className="close-modal">
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="file-list">
                {fileSelectionModal.files.map((file, index) => (
                  <div key={index} className="file-selection-item" onClick={() => previewSelectedFile(file)}>
                    <div className="file-icon">
                      {file.isLink || file.type === 'link' || file.mime_type === 'link' ? (
                        <FaLink />
                      ) : (
                        <FaFileDownload />
                      )}
                    </div>
                    <div className="file-details">
                      <div className="file-name">{file.file_name}</div>
                      <div className="file-size">
                        {!(file.isLink || file.type === 'link' || file.mime_type === 'link') && formatFileSize(file.file_size || 0)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Render the grade submission modal at the root level outside other DOM elements */}
      {renderGradeSubmissionModal()}
      
      {/* Render the link URL modal at the root level */}
      {renderLinkUrlModal()}
    </div>
  );
};

export default Assignments;