import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { 
  FaPlus, 
  FaPaperclip, 
  FaUndo,
  FaPaperPlane,
  FaTimes,
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
  FaEdit,
  FaTrash,
  FaEllipsisV,
  FaLink,
  FaExternalLinkAlt,
  FaRegWindowClose,
  FaKey,
  FaCog,
  FaLock,
  FaCopy,
  FaGraduationCap
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
import Sidebar from '../Sidebar';
import './Stream.css';
import '../dashboard.css';
import LoadingIndicator from '../common/LoadingIndicator';

const Stream = ({ setAuth }) => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [courseDetails, setCourseDetails] = useState(null);
  const [stream, setStream] = useState({ announcements: [], materials: [] });
  const [announcementText, setAnnouncementText] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [posting, setPosting] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [showOptions, setShowOptions] = useState({});
  const editorRef = useRef(null);

  // Add state for the edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [announcementToEdit, setAnnouncementToEdit] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Try to get the sidebar state from localStorage
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState === "true";
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [userRole, setUserRole] = useState(null)
  const [inputs, setInputs] = useState({
    first_name: "",
    last_name: "",
    profilePicture: null
  });
  const [isCoursesSubmenuOpen, setIsCoursesSubmenuOpen] = useState(false);
  const { first_name, last_name } = inputs;

  // Add state for link confirmation modal
  const [linkModal, setLinkModal] = useState({
    isOpen: false,
    url: '',
  });
  
  // Add state for link URL modal
  const [linkUrlModal, setLinkUrlModal] = useState({
    isOpen: false,
    url: 'https://',
    selection: null
  });

  // Add state for file preview modal
  const [filePreviewModal, setFilePreviewModal] = useState({
    isOpen: false,
    file: null,
    type: null,
    url: ''
  });

  // Add state for deleted attachments
  const [deletedAttachments, setDeletedAttachments] = useState([]);
  
  // Add state for attachment removal confirmation
  const [attachmentRemovalModal, setAttachmentRemovalModal] = useState({
    isOpen: false,
    attachmentId: null,
    announcementId: null,
    attachmentName: '',
    index: null,
    isInlineEditor: false
  });

  // Add state for enrollment code management
  const [enrollmentCodeStatus, setEnrollmentCodeStatus] = useState({
    isEnabled: true,
    isLoading: false,
    showOptions: false
  });

  // Add state for courses
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

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
        }
        throw new Error("Failed to fetch user role");
      }
          const data = await response.json();
      setUserRole(data.role);
      setIsTeacher(data.role === 'professor');
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
    e.preventDefault()
    try {
      localStorage.removeItem("token")
      if(setAuth) setAuth(false)
      toast.success("Logged out successfully!")
      navigate("/login")
    } catch (err) {
      console.error(err.message)
    }
  }
  
  const toggleCoursesSubmenu = (e) => {
    e.preventDefault();
    setIsCoursesSubmenuOpen(!isCoursesSubmenuOpen);
  };

  // Toggle enrollment code enabled status
  const toggleEnrollmentCode = async (enabled) => {
    if (!isTeacher || courseDetails?.status === 'archived') return;
    
    setEnrollmentCodeStatus(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await axios.put(
        `http://localhost:5000/courses/${courseId}/enrollment-code/status`,
        { enabled },
        { headers: { "jwt_token": localStorage.token, "token": localStorage.token } }
      );
      
      if (response.data) {
        console.log("Enrollment code status updated:", response.data);
        
        // Update the course details with the new status
        setCourseDetails(prev => ({
          ...prev,
          enrollment_code_enabled: enabled
        }));
        
        // Update the enrollment code status state
        setEnrollmentCodeStatus(prev => ({ 
          ...prev, 
          isEnabled: enabled,
          showOptions: false 
        }));
        
        toast.success(`Enrollment code ${enabled ? 'enabled' : 'disabled'} successfully`);
      }
    } catch (error) {
      console.error('Error toggling enrollment code status:', error);
      // Revert the UI state on error
      setEnrollmentCodeStatus(prev => ({ 
        ...prev, 
        isEnabled: !enabled // Revert to previous state
      }));
      toast.error(`Failed to ${enabled ? 'enable' : 'disable'} enrollment code`);
    } finally {
      setEnrollmentCodeStatus(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Generate a new enrollment code
  const regenerateEnrollmentCode = async () => {
    if (!isTeacher || courseDetails?.status === 'archived') return;
    
    setEnrollmentCodeStatus(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await axios.post(
        `http://localhost:5000/courses/${courseId}/enrollment-code/regenerate`,
        {},
        { headers: { "jwt_token": localStorage.token, "token": localStorage.token } }
      );
      
      if (response.data && response.data.enrollment_code) {
        // Update the course details with the new code
        setCourseDetails(prev => ({
          ...prev,
          enrollment_code: response.data.enrollment_code
        }));
        setEnrollmentCodeStatus(prev => ({ ...prev, showOptions: false }));
        
        toast.success('Enrollment code regenerated successfully');
      }
    } catch (error) {
      console.error('Error regenerating enrollment code:', error);
      toast.error('Failed to regenerate enrollment code');
    } finally {
      setEnrollmentCodeStatus(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Toggle enrollment code options menu
  const toggleEnrollmentCodeOptions = () => {
    if (!isTeacher || courseDetails?.status === 'archived') return;
    
    setEnrollmentCodeStatus(prev => ({ 
      ...prev, 
      showOptions: !prev.showOptions 
    }));
  };

  useEffect(() => {
    const fetchCourseDetails = async () => {
      if (!courseId) return;
      setLoading(true);
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
            // Initialize enrollment code status based on course data
            setEnrollmentCodeStatus(prev => ({
              ...prev,
              isEnabled: foundCourse.enrollment_code_enabled !== false
            }));
            setError(null);
            console.log("Fetched courseDetails state:", foundCourse);
          } else {
             console.error('Failed to fetch course details from all sources');
             setError("Failed to load course details.");
             setCourseDetails({
                course_name: "Course",
                section: "Details Unavailable",
                description: "Could not load course description.",
                semester: "N/A",
                academic_year: "N/A",
                enrollment_code: "N/A",
                status: "unknown"
             });
          }
        } else {
          const data = await response.json();
          setCourseDetails(data);
          // Initialize enrollment code status based on course data
          setEnrollmentCodeStatus(prev => ({
            ...prev,
            isEnabled: data.enrollment_code_enabled !== false
          }));
          setError(null);
          console.log("Fetched courseDetails state:", data);
        }
      } catch (error) {
        console.error('Error fetching course details:', error);
        setError("Error loading course details.");
         setCourseDetails({
            course_name: "Course",
            section: "Details Unavailable",
            description: "Could not load course description.",
            semester: "N/A",
            academic_year: "N/A",
            enrollment_code: "N/A",
            status: "unknown"
         });
      } finally {
          console.log("Final courseDetails state:", courseDetails);
      }
    };
    fetchCourseDetails();
  }, [courseId]);

  useEffect(() => {
    const loadUserData = async () => {
      await fetchUserRole();
      await getProfile();
      setLoading(false);
    };
    loadUserData();
  }, [fetchUserRole, getProfile]);

  const fetchStreamData = useCallback(async () => {
    if (!courseId) return;
    try {
      console.log('Fetching stream data for course:', courseId);
      // Add a timestamp parameter to prevent caching
      const timestamp = new Date().getTime();
      const response = await fetch(`http://localhost:5000/stream/${courseId}?nocache=${timestamp}`, {
        method: "GET",
        headers: { 
          "jwt_token": localStorage.token, 
          "token": localStorage.token,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });

      if (!response.ok) {
        console.log('Stream endpoint failed, trying announcements fallback...');
        try {
          const announcementsResponse = await fetch(`http://localhost:5000/announcements/${courseId}?nocache=${timestamp}`, {
            method: "GET",
            headers: { 
              "jwt_token": localStorage.token, 
              "token": localStorage.token,
              "Cache-Control": "no-cache, no-store, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0"
            }
          });
          if (announcementsResponse.ok) {
            const announcements = await announcementsResponse.json();
            const processedAnnouncements = (announcements || []).map(announcement => ({
                ...announcement,
              attachments: Array.isArray(announcement.attachments) ? announcement.attachments
                .filter(att => att && att.file_name && att.file_size && att.file_size > 0)
                .map(att => ({
                      attachment_id: att.attachment_id || `att-${Math.random()}`,
                      file_name: att.file_name || 'file',
                      file_url: att.file_url || null,
                      file_type: att.file_type || 'application/octet-stream',
                      file_size: att.file_size || 0
              })) : []
            }));
            setStream({ announcements: processedAnnouncements, materials: [] });
            return;
          } else {
            console.log('Announcements fallback also failed.');
          }
        } catch (fallbackError) {
          console.error('Announcements fallback error:', fallbackError);
        }
        setStream({ announcements: [], materials: [] });
        return;
      }

      const data = await response.json();
      const processedData = {
        announcements: (data.announcements || []).map(announcement => ({
                ...announcement,
          attachments: Array.isArray(announcement.attachments) ? announcement.attachments
                .filter(att => att && att.file_name && att.file_size && att.file_size > 0)
                .map(att => ({
                      attachment_id: att.attachment_id || `att-${Math.random()}`,
                      file_name: att.file_name || 'file',
                      file_url: att.file_url || null,
                      file_type: att.file_type || 'application/octet-stream',
                      file_size: att.file_size || 0
          })) : []
        })),
        materials: Array.isArray(data.materials) ? data.materials : []
      };
      setStream(processedData);
    } catch (error) {
      console.error('Error fetching stream:', error);
      setStream({ announcements: [], materials: [] });
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) {
      fetchStreamData();
    }
  }, [courseId, fetchStreamData]);

  // Add function to convert URLs to clickable links
  const convertUrlsToLinks = useCallback((text) => {
    if (!text) return '';
    
    // URL regex pattern
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
    
    // Replace URLs with anchor tags
    return text.replace(urlRegex, (url) => {
      // Add https:// prefix if it starts with www.
      const href = url.startsWith('www.') ? `https://${url}` : url;
      // Return anchor tag with proper attributes
      return `<a href="${href}" class="external-link" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
  }, []);

  // Add function to handle link insertion
  const handleInsertLink = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    // Save the current selection
    const range = selection.getRangeAt(0);
    const selectedText = selection.toString();
    
    // Open the link URL modal
    setLinkUrlModal({
      isOpen: true,
      url: 'https://',
      selection: {
        range: range.cloneRange(),
        text: selectedText
      }
    });
  };

  // Function to handle inserting the link after modal confirmation
  const confirmInsertLink = () => {
    if (!linkUrlModal.selection) return;
    
    const { range, text } = linkUrlModal.selection;
    const url = linkUrlModal.url;
    
    // Restore the selection
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Create the link HTML
    const linkText = text || url;
    const linkHtml = `<a href="${url}" class="external-link" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    
    // Insert the link
    document.execCommand('insertHTML', false, linkHtml);
    
    // Close the modal
    setLinkUrlModal({
      isOpen: false,
      url: 'https://',
      selection: null
    });
    
    // Focus back on the editor
    editorRef.current?.focus();
  };

  // Handle external link clicks
  const handleLinkClick = (e) => {
    // Check if the clicked element is a link
    const link = e.target.closest('a');
    if (!link) return;
    
    // Check if it's a file preview link (has class attachment-file or file-preview-link)
    if (link.classList.contains('attachment-file') || link.classList.contains('file-preview-link')) {
      e.preventDefault();
      
      // Get file info
      const url = link.href;
      const fileName = link.textContent || 'File';
      const fileType = getFileTypeFromUrl(url);
      
      // Open file preview modal instead of confirmation
      setFilePreviewModal({
        isOpen: true,
        file: fileName,
        type: fileType,
        url: url
      });
      return;
    }
    
    // For regular external links, show confirmation modal
    if (link.classList.contains('external-link') || link.getAttribute('target') === '_blank') {
      e.preventDefault();
      
      // Show confirmation modal
      setLinkModal({
        isOpen: true,
        url: link.href
      });
    }
  };

  // Helper function to determine file type from URL or filename
  const getFileTypeFromUrl = (url) => {
    const extension = url.split('.').pop().toLowerCase();
    
    // Image types
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) {
      return 'image';
    }
    // PDF
    else if (extension === 'pdf') {
      return 'pdf';
    }
    // Video types
    else if (['mp4', 'webm', 'ogg', 'mov'].includes(extension)) {
      return 'video';
    }
    // Audio types
    else if (['mp3', 'wav', 'ogg', 'aac'].includes(extension)) {
      return 'audio';
    }
    // Text types
    else if (['txt', 'md', 'rtf'].includes(extension)) {
      return 'text';
    }
    // Office document types
    else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) {
      return 'office';
    }
    // Default
    return 'unknown';
  };

  // Function to confirm and navigate to external link
  const confirmNavigation = () => {
    if (linkModal.url) {
      window.open(linkModal.url, '_blank', 'noopener,noreferrer');
    }
    setLinkModal({ isOpen: false, url: '' });
  };

  // Add useEffect to add event listener for link clicks
  useEffect(() => {
    // Add click event listener to stream items container AND the edit modal
    const streamItems = document.querySelector('.stream-items');
    const editModal = document.querySelector('.stream-edit-modal');
    
    const handleLinkClickWrapper = (e) => {
      handleLinkClick(e);
    };
    
    if (streamItems) {
      streamItems.addEventListener('click', handleLinkClickWrapper);
    }
    
    if (editModal) {
      editModal.addEventListener('click', handleLinkClickWrapper);
    }
    
    return () => {
      if (streamItems) {
        streamItems.removeEventListener('click', handleLinkClickWrapper);
      }
      if (editModal) {
        editModal.removeEventListener('click', handleLinkClickWrapper);
      }
    };
  }, [showEditModal]); // Run when modal visibility changes

  const handleFormat = (command, value = null) => {
    // Check for special link command
    if (command === 'insertLink') {
      handleInsertLink();
      return;
    }

    // Check for indent command and apply limit
    if (command === 'indent') {
      const MAX_INDENT_LEVEL = 8; // Define the maximum indentation level
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        let node = selection.getRangeAt(0).startContainer;
        let indentLevel = 0;
        
        // Traverse up the DOM to count blockquote ancestors
        while (node && node !== editorRef.current) {
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
          // Optionally provide user feedback, e.g., toast message
          // toast.warn("Maximum indentation level reached."); 
        }
      }
      editorRef.current?.focus();
      return; // Stop execution after handling indent
    }
    
    // Use the default execCommand for all other commands
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleFontSize = (e) => handleFormat('fontSize', e.target.value);
  const handleFontStyle = (e) => handleFormat('formatBlock', e.target.value);
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      handleFormat('insertText', '    ');
    }
  };

  const handleFileUpload = (e) => {
    const files = e.target.files; // Get the FileList object
    if (!files || files.length === 0) return; // Do nothing if no files are selected

    let attachedCount = 0;
    let errorMessages = [];

    for (const file of files) { // Iterate through all selected files
      // Check if file is empty (0 bytes)
      if (file.size === 0) {
        errorMessages.push(`Cannot attach empty file "${file.name}".`);
        continue; // Skip this file
      }

      // Check if the file is already in the attachments list
      const isDuplicate = attachments.some(attachment => 
          attachment.file && // Check if the attachment object has a file property
          attachment.file.name === file.name &&
          attachment.file.size === file.size &&
          attachment.file.type === file.type &&
          attachment.file.lastModified === file.lastModified
      );

      if (isDuplicate) {
        errorMessages.push(`File "${file.name}" is already attached.`);
        continue; // Skip this file
      }

      // If not a duplicate and not empty, proceed to add
      let thumbnail = null;
      if (file.type.startsWith('image/')) {
        thumbnail = URL.createObjectURL(file);
      }
      setAttachments(prev => [...prev, {
        file: file,       // Store the actual File object
        name: file.name,
        type: file.type,
        size: file.size,
        thumbnail: thumbnail
      }]);
      attachedCount++;
    }

    // Show feedback to the user
    if (attachedCount > 0) {
      toast.success(`${attachedCount} file${attachedCount > 1 ? 's' : ''} attached`);
    }
    if (errorMessages.length > 0) {
      // Combine error messages into one toast or show multiple
      toast.error(errorMessages.join('\n')); 
    }
    
    // Reset the file input value to allow re-selecting the *same file(s)* 
    // if the user removes them and wants to add them back immediately.
    e.target.value = null;
  };

  const getWordCount = () => {
    const text = editorRef.current?.innerText || '';
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const debugObject = (obj, name = 'Object') => {
    try {
      console.log(`${name}:`, JSON.stringify(obj, null, 2));
    } catch (err) {
      console.log(`${name} (circular reference):`, obj);
    }
  };

  const toggleOptions = (announcementId) => {
    setShowOptions(prev => ({ ...prev, [announcementId]: !prev[announcementId] }));
  };

  const handleEditAnnouncement = (announcement) => {
    setShowOptions({});
    setAnnouncementToEdit(announcement);
    setAnnouncementTitle(announcement.title || '');
    
    // Make a deep copy of attachments to track original state
    const originalAttachments = (announcement.attachments || []).map(att => ({
      ...att,
      isOriginal: true  // Flag to identify this as an original attachment
    }));
    
    setAttachments(originalAttachments);
    setDeletedAttachments([]);  // Reset deleted attachments array
    setShowEditModal(true);
    
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = announcement.content || '';
      }
    }, 50);
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    setShowOptions({});
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    
    try {
      await axios.delete(`http://localhost:5000/announcements/${announcementId}`, {
        headers: { "jwt_token": localStorage.token, "token": localStorage.token }
      });
      toast.success("Announcement deleted successfully");
      await fetchStreamData();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      const errorMessage = error.response?.data?.message || "Error deleting announcement";
      toast.error(errorMessage);
    }
  };

  // Function to perform the actual attachment removal after confirmation
  const performAttachmentRemoval = async (params) => {
    const { attachmentId, announcementId, index } = params;
    
    // Case 1: Remove from editor (index is provided)
    if (index !== null && index >= 0) {
      const attachmentToRemove = attachments[index];
      
      // Get the attachment element for visual feedback
      const attachmentElements = document.querySelectorAll('.file-attachment');
      const attachmentEl = attachmentElements[index];
      
      // If we found the element, add visual feedback
      if (attachmentEl) {
        attachmentEl.classList.add('deleting');
        // Add loading spinner
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'attachment-loading-overlay';
        const spinner = document.createElement('div');
        spinner.className = 'attachment-spinner';
        loadingOverlay.appendChild(spinner);
        attachmentEl.appendChild(loadingOverlay);
      }
      
      // Remove from UI first to provide immediate feedback
      setAttachments(prev => prev.filter((_, i) => i !== index));
      
      // If we're in edit mode, also update the announcementToEdit state
      if (announcementToEdit && attachmentToRemove.attachment_id) {
        // Create a copy with the attachment removed
        const updatedAnnouncement = {
          ...announcementToEdit,
          attachments: (announcementToEdit.attachments || [])
            .filter(att => att.attachment_id !== attachmentToRemove.attachment_id)
        };
        setAnnouncementToEdit(updatedAnnouncement);
      }
      
      // If this is an existing attachment (has an attachment_id), try to delete from server
      if (attachmentToRemove.attachment_id) {
        try {
          // Call API to delete attachment from server with multiple retries
          let success = false;
          let attempts = 0;
          const maxAttempts = 3;
          
          while (!success && attempts < maxAttempts) {
            try {
              attempts++;
              const response = await axios.delete(
                `http://localhost:5000/announcements/attachments/${attachmentToRemove.attachment_id}`,
                { 
                  headers: { 
                    "jwt_token": localStorage.token, 
                    "token": localStorage.token,
                    "Cache-Control": "no-cache" 
                  }
                }
              );
              console.log(`Attachment ${attachmentToRemove.attachment_id} deleted successfully on attempt ${attempts}`);
              success = true;
              
              // If edit modal is open and we're editing an announcement, directly update it on the server
              if (showEditModal && announcementToEdit) {
                try {
                  // Get the current content from the editor
                  const contentHTML = editorRef.current?.innerHTML || announcementToEdit.content || '';
                  
                  // Save changes to announcement immediately after attachment is deleted
                  console.log('Auto-saving announcement after attachment deletion...');
                  await axios.put(
                    `http://localhost:5000/announcements/${announcementToEdit.announcement_id}`,
                    { 
                      content: contentHTML, 
                      title: announcementTitle || null 
                    },
                    { 
                      headers: { 
                        'Content-Type': 'application/json', 
                        "jwt_token": localStorage.token, 
                        "token": localStorage.token 
                      } 
                    }
                  );
                  console.log('Announcement auto-saved after attachment deletion');
                } catch (saveError) {
                  console.error('Error auto-saving announcement after attachment deletion:', saveError);
                  // Don't show error to user since the attachment was still deleted successfully
                }
              }
            } catch (error) {
              console.error(`Error deleting attachment on attempt ${attempts}:`, error);
              if (attempts < maxAttempts) {
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 300));
              }
            }
          }
          
          // Also track it in deletedAttachments to prevent re-adding if edit is cancelled
          setDeletedAttachments(prev => [...prev, attachmentToRemove.attachment_id]);
          
          // Instead of trying to fetch a single announcement, refresh all stream data
          // This ensures we have fresh data without needing a specific endpoint
          if (courseId) {
            // Use a delayed fetch to ensure the server has processed the deletion
            setTimeout(() => {
              fetchStreamData();
            }, 300);
          }
          
          toast.success('Attachment removed');
        } catch (error) {
          console.error(`Error deleting attachment ${attachmentToRemove.attachment_id}:`, error);
          // For UI purposes, we still want to consider it deleted, so we'll track it
          setDeletedAttachments(prev => [...prev, attachmentToRemove.attachment_id]);
          
          toast.error('Server error while removing attachment');
        }
      } else {
        // For new attachments that don't have an ID yet, just success message
        toast.success('Attachment removed');
      }
    } 
    // Case 2: Remove from announcement view (attachmentId and announcementId are provided)
    else if (attachmentId && announcementId) {
      try {
        // Find the attachment element for visual feedback 
        const attachmentEl = document.querySelector(`.attachment-list [key*="${attachmentId}"]`);
        if (attachmentEl) {
          attachmentEl.classList.add('deleting');
          // Add loading spinner
          const loadingOverlay = document.createElement('div');
          loadingOverlay.className = 'attachment-loading-overlay';
          const spinner = document.createElement('div');
          spinner.className = 'attachment-spinner';
          loadingOverlay.appendChild(spinner);
          attachmentEl.appendChild(loadingOverlay);
        }
        
        // Call API to delete attachment from server with multiple retries
        let success = false;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!success && attempts < maxAttempts) {
          try {
            attempts++;
            const response = await axios.delete(
              `http://localhost:5000/announcements/attachments/${attachmentId}`,
              { 
                headers: { 
                  "jwt_token": localStorage.token, 
                  "token": localStorage.token,
                  "Cache-Control": "no-cache" 
                }
              }
            );
            console.log(`Attachment ${attachmentId} deleted successfully on attempt ${attempts}`);
            success = true;
            
            // Find the announcement in the stream to update UI
            const announcement = stream.announcements.find(ann => ann.announcement_id === announcementId);
            
            if (announcement) {
              // Update the announcement in the stream (UI update only)
              setStream(prevStream => {
                // Find the announcement and update its attachments
                const updatedAnnouncements = prevStream.announcements.map(ann => {
                  if (ann.announcement_id === announcementId) {
                    return {
                      ...ann,
                      attachments: ann.attachments.filter(att => att.attachment_id !== attachmentId)
                    };
                  }
                  return ann;
                });
                
                return {
                  ...prevStream,
                  announcements: updatedAnnouncements
                };
              });
            }
            
            toast.success('Attachment removed');
            
            // Force a refresh of the stream data after a delay to ensure server and client are in sync
            setTimeout(() => {
              fetchStreamData();
            }, 500);
            
          } catch (error) {
            console.error(`Error deleting attachment on attempt ${attempts}:`, error);
            if (attempts < maxAttempts) {
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 300));
            } else {
              // Show error after all attempts fail
              if (attachmentEl) {
                // Remove deleting class and loading overlay
                attachmentEl.classList.remove('deleting');
                const overlay = attachmentEl.querySelector('.attachment-loading-overlay');
                if (overlay) overlay.remove();
              }
              toast.error('Failed to delete attachment. Please try again.');
            }
          }
        }
      } catch (error) {
        console.error('Error deleting attachment:', error);
        toast.error('Failed to delete attachment. Please try again.');
      }
    }
  };

  const handlePost = async (e) => {
    e.preventDefault();
    // Use innerText for validation check
    const textContent = editorRef.current?.innerText || '';
    
    // NEW VALIDATION: Require either text content or attachments
    if (!textContent.trim() && attachments.length === 0) {
      toast.error("Please provide content or attach a file for the announcement.");
      return;
    }
    
    // Get the actual HTML content for posting AFTER validation
    const contentHTML = editorRef.current?.innerHTML || '';

    // Filter out any invalid attachments before posting
    const validAttachments = attachments.filter(att => 
      att && 
      ((att.file instanceof File && att.file.size > 0) || 
       (att.file_size && att.file_size > 0 && att.file_name))
    );

    setAttachments(validAttachments);
    setPosting(true);
    
    try {
      // Check if we are editing (use announcementToEdit state)
      if (announcementToEdit) {
        console.log('Editing announcement:', announcementToEdit.announcement_id);
        console.log('Original attachments:', announcementToEdit.attachments);
        console.log('Current attachments:', validAttachments);
        console.log('Deleted attachments:', deletedAttachments);
        
        // First, explicitly process any deleted attachments that might not have been fully processed
        // This is a safety check to ensure all deletions are properly processed
        if (deletedAttachments.length > 0) {
          for (const attachmentId of deletedAttachments) {
            try {
              console.log(`Ensuring deletion of attachment ${attachmentId}...`);
              await axios.delete(
                `http://localhost:5000/announcements/attachments/${attachmentId}`,
                { 
                  headers: { 
                    "jwt_token": localStorage.token, 
                    "token": localStorage.token,
                    "Cache-Control": "no-cache" 
                  }
                }
              );
            } catch (deleteError) {
              // Log but continue - the important part is we tried to delete it again
              console.error(`Additional deletion attempt failed for ${attachmentId}:`, deleteError);
            }
          }
        }
        
        // Update the announcement content
        console.log('Updating announcement text...');
        const updateTextResponse = await axios.put(
          `http://localhost:5000/announcements/${announcementToEdit.announcement_id}`,
          { content: contentHTML, title: announcementTitle || null },
          { headers: { 'Content-Type': 'application/json', "jwt_token": localStorage.token, "token": localStorage.token } }
        );
        console.log('Announcement text updated:', updateTextResponse.data);
        
        // Upload new attachments (files that don't have attachment_id)
        const newFiles = validAttachments.filter(att => att.file instanceof File);
        console.log('New files to upload:', newFiles.length);

        if (newFiles.length > 0) {
          const formData = new FormData();
          newFiles.forEach(attachment => {
            formData.append(`files`, attachment.file);
          });

          console.log('Uploading new attachments for announcement:', announcementToEdit.announcement_id);
          try {
            const uploadResponse = await axios.post(
              `http://localhost:5000/announcements/${announcementToEdit.announcement_id}/attachments/multiple`,
              formData,
              { headers: { "jwt_token": localStorage.token, "token": localStorage.token } }
            );
            console.log('New attachments uploaded:', uploadResponse.data);
          } catch (uploadError) {
            console.error('Error uploading new attachments:', uploadError);
            toast.error("Failed to upload new attachments. Please try again.");
          }
        }
        
        // Clear edit state and close modal after successful update
        setShowEditModal(false);
        setAnnouncementToEdit(null);
        setDeletedAttachments([]); // Reset deleted attachments array
        toast.success("Announcement updated successfully!");
        
        // Force a more thorough refresh after updating with multiple attempts
        let retryCount = 0;
        const maxRetries = 3;
        
        const refreshData = async () => {
          try {
            // Clear any cached data
            await fetch(`http://localhost:5000/stream/${courseId}?clear=1&t=${new Date().getTime()}`, {
              method: "HEAD",
              headers: { 
                "jwt_token": localStorage.token, 
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
              }
            }).catch(err => console.log('Cache clearing request:', err));
            
            // Now fetch fresh data
            await fetchStreamData();
          } catch (refreshError) {
            console.error('Error during refresh attempt:', refreshError);
            
            if (retryCount < maxRetries) {
              retryCount++;
              setTimeout(refreshData, 500);
            }
          }
        };
        
        // Start the refresh process with some delay
        setTimeout(refreshData, 1000);
      } else {
        // --- Logic for creating a new announcement (remains the same) ---
        let announcementId = null;
        // Create announcement text/title first
        console.log('Creating new announcement text/title...');
        const announcementResponse = await axios.post(
          `http://localhost:5000/announcements/${courseId}`,
          { content: contentHTML, title: announcementTitle || null, course_id: parseInt(courseId, 10), author_id: userProfile?.user_id }, // Send HTML content
          { headers: { 'Content-Type': 'application/json', "jwt_token": localStorage.token, "token": localStorage.token } }
        );
        console.log('Announcement created (step 1): ', announcementResponse.data);
        announcementId = announcementResponse.data.announcement_id || announcementResponse.data.id;

        if (!announcementId) {
          throw new Error("Created announcement but received no ID for attachments.");
        }
        
        // Check if there are attachments to upload
        const filesToUpload = validAttachments.filter(att => att.file instanceof File); // Should be all attachments in create mode

        if (filesToUpload.length > 0) {
            console.log(`Found ${filesToUpload.length} files to upload for new announcement.`);
            const formData = new FormData();
            filesToUpload.forEach(attachment => {
                formData.append(`files`, attachment.file); // Use 'files' field name
            });

            console.log('Uploading attachments for new announcement:', announcementId);
            const uploadResponse = await axios.post(
                `http://localhost:5000/announcements/${announcementId}/attachments/multiple`,
                formData,
                { headers: { "jwt_token": localStorage.token, "token": localStorage.token } }
            );
            console.log('Attachments uploaded:', uploadResponse.data);
            toast.success("Announcement with attachments posted successfully!");
        } else {
             // Only show success for text post if no files were involved
            toast.success("Announcement posted successfully!");
        }
        // Clear create state after successful creation
        setShowEditor(false); 
        setEditingAnnouncement(null); // Clear legacy state
      }

      // --- Common cleanup logic ---
      await fetchStreamData(); // Refresh the stream data
      if (editorRef.current) editorRef.current.innerHTML = ''; // Clear editor
      setAnnouncementTitle(''); // Clear title
      setAttachments([]); // Clear attachments state
      // Reset relevant states regardless of create/update

    } catch (error) {
      console.error('Failed to post/update announcement:', error);
      let errorMessage = "Failed to save announcement.";
      if (error.response?.data) {
        errorMessage = typeof error.response.data === 'string' ? error.response.data : (error.response.data.error || error.response.data.message || errorMessage);
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    } finally {
      setPosting(false);
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'Date unavailable';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
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

  // Add useEffect for paste handling
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handlePaste = (event) => {
      event.preventDefault(); // Stop the default paste behavior

      // Get plain text from clipboard
      const text = (event.clipboardData || window.clipboardData).getData('text/plain');

      const selection = window.getSelection();
      if (!selection.rangeCount) return; 

      const range = selection.getRangeAt(0);
      range.deleteContents(); 

      // Create a new span element to wrap the text
      const span = document.createElement('span');
      // Apply styles directly and forcefully
      span.style.color = 'black';
      span.style.backgroundColor = 'transparent';
      // Optionally add !important if needed, though direct style often suffices
      span.style.setProperty('background-color', 'transparent', 'important');
      span.style.setProperty('color', 'black', 'important');

      // Add the plain text to the span
      span.textContent = text;

      // Insert the styled span
      range.insertNode(span);

      // Move the cursor to the end of the inserted span
      range.setStartAfter(span);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    };

    editor.addEventListener('paste', handlePaste);

    // Cleanup: remove the event listener when the component unmounts
    return () => {
      if (editor) { // Check if editor still exists before removing listener
        editor.removeEventListener('paste', handlePaste);
      }
    };
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  // Add a function to handle attachment deletion directly from the announcement view
  const handleDeleteAttachmentFromAnnouncement = async (e, announcementId, attachmentId) => {
    // Prevent the click from triggering the attachment download
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Find the attachment name from the stream data
    let attachmentName = 'Attachment';
    const announcement = stream.announcements.find(a => a.announcement_id === announcementId);
    if (announcement && announcement.attachments) {
      const attachment = announcement.attachments.find(a => a.attachment_id === attachmentId);
      if (attachment) {
        attachmentName = attachment.file_name || 'Attachment';
      }
    }
    
    // Show confirmation modal instead of immediately removing
    setAttachmentRemovalModal({
      isOpen: true,
      attachmentId: attachmentId,
      announcementId: announcementId,
      attachmentName: attachmentName,
      index: null,
      isInlineEditor: false
    });
    
    // The actual removal logic will be executed from the modal's confirm button
  };

  // Modify the removeAttachment function to show confirmation modal
  const removeAttachment = async (index) => {
    const attachmentToRemove = attachments[index];
    
    // Show confirmation modal instead of immediately removing
    setAttachmentRemovalModal({
      isOpen: true,
      attachmentId: attachmentToRemove.attachment_id || null,
      announcementId: null,
      attachmentName: attachmentToRemove.name || attachmentToRemove.file_name || 'Attachment',
      index: index,
      isInlineEditor: !showEditModal
    });
  };

  // Add a function to handle direct file preview clicks
  const handleFilePreview = (e, file) => {
    e.preventDefault(); // Prevent default download behavior
    e.stopPropagation(); // Prevent event bubbling
    
    if (!file || !file.file_url) return;
    
    // Open file preview modal
    setFilePreviewModal({
      isOpen: true,
      file: file.file_name,
      type: getFileTypeFromUrl(file.file_url),
      url: file.file_url
    });
  };

  // Fetch user role and courses
  useEffect(() => {
    const fetchCourses = async () => {
      setLoadingCourses(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        let endpoint = '';
        if (userRole === 'professor') {
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
    if (userRole) fetchCourses();
  }, [userRole]);

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
                 <LoadingIndicator text="Loading course details" />
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
    academic_year: "N/A",
    enrollment_code: "N/A"
  };
  
  const tabs = [
    { id: 'stream', label: 'Stream' },
    { id: 'messages', label: 'Messages' },
    { id: 'assignments', label: 'Assignments' },
    { id: 'exams', label: 'Exams' },
    { id: 'people', label: 'People' }
  ];

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

      <div className="stream-content">
        <div className="course-info-panel">
          <h1 className="course-code">{currentCourse.course_name}</h1>
          <h2 className="course-section">{currentCourse.section}</h2>
                      {currentCourse.description && currentCourse.description !== "Course description not available" && currentCourse.description !== "Could not load course description." && (
          <p className="course-description">{currentCourse.description}</p>
                      )} 
          <div className="semester-info">
            <span>{currentCourse.semester}</span>
            <span>{currentCourse.academic_year}</span>
          </div>
          
                      {currentCourse.enrollment_code && currentCourse.enrollment_code !== "N/A" && (
          <div className="enrollment-code-box">
            <div className="enrollment-code-header">
              <h3>Enrollment code:</h3>
              {isTeacher && courseDetails?.status !== 'archived' && (
                <div className="enrollment-code-actions">
                  <button 
                    className="options-toggle" 
                    onClick={toggleEnrollmentCodeOptions}
                    title="Enrollment code options"
                  >
                    <FaEllipsisV />
                  </button>
                  {enrollmentCodeStatus.showOptions && (
                    <div className="options-menu">
                      <button 
                        className={`toggle-button ${enrollmentCodeStatus.isEnabled ? 'enabled' : 'disabled'}`}
                        onClick={() => toggleEnrollmentCode(!enrollmentCodeStatus.isEnabled)}
                        disabled={enrollmentCodeStatus.isLoading}
                      >
                        {enrollmentCodeStatus.isEnabled ? <HiOutlineBan /> : <HiOutlineAnnotation />}
                        {enrollmentCodeStatus.isEnabled ? 'Disable Code' : 'Enable Code'}
                      </button>
                      <button 
                        className="regenerate-button"
                        onClick={regenerateEnrollmentCode}
                        disabled={enrollmentCodeStatus.isLoading}
                      >
                        <FaUndo /> Generate New Code
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="code">
              {console.log("Code display state:", { 
                enabled: enrollmentCodeStatus.isEnabled,
                code_enabled_course: courseDetails?.enrollment_code_enabled, 
                code: currentCourse.enrollment_code 
              })}
              {courseDetails?.enrollment_code_enabled === false || enrollmentCodeStatus.isEnabled === false ? (
                <span className="code-disabled">Code disabled</span>
              ) : (
                currentCourse.enrollment_code
              )}
              {enrollmentCodeStatus.isLoading && <span className="loading-spinner"></span>}
            </div>
          </div>
                      )}
        </div>

        <div className="announcements-section">
          {error && <div className="error-message">{error}</div>}
          
          {/* "Create Announcement" Button - shows when editor is hidden */}
          {/* Only show if teacher AND course is not archived */}
          {isTeacher && courseDetails?.status !== 'archived' && !showEditor && (
            <div className="announcement-header-section">
              <button onClick={() => {
                // Reset state specifically for creating
                setAnnouncementToEdit(null); // Make sure we are not in edit mode
                setShowEditModal(false);
                setAnnouncementTitle(''); 
                if (editorRef.current) editorRef.current.innerHTML = '';
                setAttachments([]);
                // Show the inline editor
                setShowEditor(true); 
              }} className="add-announcement-btn">
                <FaPlus /> Create Announcement
              </button>
            </div>
          )}
          
          {/* Inline Editor for Creating Announcements - shown when showEditor is true AND not editing */}
          {/* Only show if teacher AND course is not archived */}
          {isTeacher && courseDetails?.status !== 'archived' && showEditor && !announcementToEdit && (
            <div className="rich-editor-container">
              <div className="editor-header">
                {/* Title is now fixed for creation */}
                <h3>New Announcement</h3> 
                <button onClick={() => {
                  // Hide inline editor and reset create state
                  setShowEditor(false);
                  setAnnouncementTitle('');
                  if (editorRef.current) editorRef.current.innerHTML = '';
                  setAttachments([]); 
                }} className="close-editor">
                  <FaTimes />
                </button>
              </div>
              
              <form onSubmit={handlePost} className="editor-form">
                 {/* Editor components (Title, Toolbar, Content, Footer, Attachments, Actions) */}
                 {/* Make sure the submit button text is correct for creating */}
                 {/* ... (form content as before, but ensure it uses correct state) ... */}
                  <div className="title-input-container">
                    <label htmlFor="announcement-title">Title (optional)</label>
                    <input
                      id="announcement-title"
                      type="text"
                      value={announcementTitle} // Uses state, correct
                      onChange={(e) => setAnnouncementTitle(e.target.value)}
                      placeholder="Enter announcement title"
                      className="title-input"
                    />
                  </div>
                  
                  {/* Editor toolbar with hover tooltips */}
                  <div className="editor-toolbar">
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
                    className="editor-content"
                    ref={editorRef}
                    contentEditable
                    onKeyDown={handleKeyDown}
                    data-placeholder="Announce something to your class..."
                    aria-label="Announcement content"
                    // Add paste handler here too if needed for inline editor
                     onPaste={(e) => { 
                        const handlePaste = (event) => {
                            event.preventDefault();
                            const text = (event.clipboardData || window.clipboardData).getData('text/plain');
                            const selection = window.getSelection();
                            if (!selection.rangeCount) return;
                            const range = selection.getRangeAt(0);
                            range.deleteContents();
                            const span = document.createElement('span');
                            span.style.color = 'black';
                            span.style.backgroundColor = 'transparent';
                            span.style.setProperty('background-color', 'transparent', 'important');
                            span.style.setProperty('color', 'black', 'important');
                            span.textContent = text;
                            range.insertNode(span);
                            range.setStartAfter(span);
                            range.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        };
                        handlePaste(e); 
                    }}
                  ></div>
                  
                  <div className="editor-footer">
                    <div className="editor-actions-left">
                        <label className="attach-btn" title="Attach Files">
                            <FaPaperclip /> Attach Files
                            <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} multiple />
                        </label>
                        <button 
                            type="button" 
                            className="link-btn" 
                            onClick={() => handleFormat('insertLink')}
                            title="Insert Link"
                        >
                            <FaLink /> Add Link
                        </button>
                    </div>
                  </div>
                  
                  {attachments.length > 0 && (
                    <div className="editor-attachments">
                      <h4>Attachments:</h4>
                       {/* ... Attachment list rendering ... */}
                      <div className="attachment-list">
                      {attachments.map((attachment, index) => (
                        <div key={index} className="file-attachment">
                          <span className="file-icon">
                            {attachment.thumbnail ? (
                              <img src={attachment.thumbnail} alt="Preview" className="attachment-preview" />
                            ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M16.5 6V3.5C16.5 2.12 15.38 1 14 1H5.5C4.12 1 3 2.12 3 3.5V18.5C3 19.88 4.12 21 5.5 21H18.5C19.88 21 21 19.88 21 18.5V8.5L16.5 6ZM5.5 3H14V7.5H18.5V18.5H5.5V3ZM7 14H17V16H7V14ZM7 10H17V12H7V10Z"/></svg>
                            )}
                          </span>
                          <span className="attachment-file">
                            {attachment.name}
                          </span>
                          <span className="file-size">
                            ({formatFileSize(attachment.size)})
                          </span>
                          <button 
                            type="button" 
                            className="remove-attachment-btn"
                            onClick={() => removeAttachment(index)}
                            title="Remove attachment"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      ))}
                    </div>
                    </div>
                  )}
                  
                  <div className="editor-actions">
                    <button type="button" onClick={() => {
                       // Cancel specific to create
                       setShowEditor(false);
                       setAnnouncementTitle('');
                       if (editorRef.current) editorRef.current.innerHTML = '';
                       setAttachments([]); 
                    }} className="cancel-btn">
                      Cancel
                    </button>
                    {/* Submit button text should be 'Post' when creating */}
                    <button type="submit" className="post-btn" disabled={posting}>
                      <FaPaperPlane /> {posting ? 'Posting...' : 'Post'}
                    </button>
                  </div>
              </form>
            </div>
          )}

          <div className="stream-items">
                      {(!stream.announcements || stream.announcements.length === 0) && (!stream.materials || stream.materials.length === 0) && (
                        <div className="empty-state">No announcements or materials posted yet.</div>
                      )}

                      {stream.announcements && stream.announcements.length > 0 && stream.announcements
                        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                        .map((announcement) => (
                          <div key={`ann-${announcement.announcement_id || announcement.id}`} className="stream-item announcement-card">
                            {/* Show toggle if teacher OR owner of the post */}
                            {(isTeacher || announcement.author_id === userProfile?.user_id) && (
                              <div className="announcement-actions">
                                <button 
                                  className="options-toggle"
                                  onClick={() => toggleOptions(announcement.announcement_id)}
                                  aria-label="Announcement options"
                                >
                                  <FaEllipsisV />
                                </button>
                                {showOptions[announcement.announcement_id] && (
                                  <div className="options-menu">
                                    {/* Only show Edit/Delete if course is NOT archived */ 
                                    courseDetails?.status !== 'archived' ? (
                                      <>
                                        <button className="edit-button" onClick={() => handleEditAnnouncement(announcement)}><FaEdit /> Edit</button>
                                        <button className="delete-button" onClick={() => handleDeleteAnnouncement(announcement.announcement_id)}><FaTrash /> Delete</button>
                                      </>
                                    ) : (
                                      <span className="archived-message">Actions disabled for archived course</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="announcement-header">
                              {announcement.profile_picture_url ? (
                                  <img src={announcement.profile_picture_url} alt="Profile" className="profile-picture" />
                              ) : (
                                <div className="profile-picture-placeholder">
                                  {announcement.first_name?.[0] || 'U'}{announcement.last_name?.[0] || ''}
                                </div>
                              )}
                              <div className="announcement-meta">
                                <div className="author-name">{announcement.first_name || 'User'} {announcement.last_name || ''}</div>
                                <div className="timestamp">
                                  {formatDate(announcement.created_at)}
                                  {announcement.created_at !== announcement.updated_at && 
                                    <span className="edited">(edited {formatDate(announcement.updated_at)})</span>}
                                </div>
                              </div>
                            </div>
                            {announcement.title && (
                              <h3 className="announcement-title">{announcement.title}</h3>
                            )}
                            {announcement.content && (
                              <div 
                                className="announcement-content"
                                dangerouslySetInnerHTML={{ __html: announcement.content || '' }}
                              ></div>
                            )}
                            
                            {announcement.attachments && announcement.attachments.filter(att => 
                              att && 
                              att.file_name && 
                              att.file_size && 
                              att.file_size > 0
                            ).length > 0 && (
                              <div className="announcement-attachments">
                                <h4>Attachments:</h4>
                                <div className="attachment-list">
                                  {announcement.attachments
                                    .filter(att => att && att.file_name && att.file_size && att.file_size > 0)
                                    .map((attachment) => {
                                    const fileUrl = attachment.file_url || (attachment.file_name ? `http://localhost:5000/uploads/${attachment.file_name}` : '#');
                                    return (
                                      <div key={attachment.attachment_id || `att-${Math.random()}`} className="file-attachment">
                                        <span className="file-icon">
                                          {attachment.file_type?.startsWith('image/') ? 
                                            <img src={fileUrl} alt="Preview" className="attachment-preview" onError={(e) => e.target.style.display='none'} /> :
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M16.5 6V3.5C16.5 2.12 15.38 1 14 1H5.5C4.12 1 3 2.12 3 3.5V18.5C3 19.88 4.12 21 5.5 21H18.5C19.88 21 21 19.88 21 18.5V8.5L16.5 6ZM5.5 3H14V7.5H18.5V18.5H5.5V3ZM7 14H17V16H7V14ZM7 10H17V12H7V10Z"/></svg>
                                          }
                                        </span>
                                        <a 
                                          href={fileUrl}
                                          onClick={(e) => handleFilePreview(e, attachment)}
                                          className="attachment-file file-preview-link"
                                        >
                                          {attachment.file_name || 'Attachment'}
                                        </a>
                                        <span className="file-size">
                                          ({formatFileSize(attachment.file_size || 0)})
                                        </span>
                                        {/* Only show delete button if user is the author or a teacher */}
                                        {(isTeacher || announcement.author_id === userProfile?.user_id) && 
                                          courseDetails?.status !== 'archived' && (
                                          <button 
                                            type="button" 
                                            className="remove-attachment-btn"
                                            onClick={(e) => handleDeleteAttachmentFromAnnouncement(e, announcement.announcement_id, attachment.attachment_id)}
                                            title="Remove attachment"
                                          >
                                            <FaTrash />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      }

                      {stream.materials && stream.materials.length > 0 && stream.materials
                         .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                         .map((material) => (
                            <div key={`mat-${material.material_id}`} className="stream-item material-card">
                              <div className="material-header-combined">
                                <div>
                                  <div className="material-type">{material.type || 'Material'}</div>
                                </div>
                                <div className="material-meta">
                                  <div className="author-name">
                                    {material.first_name || 'Instructor'} {material.last_name || ''}
                                  </div>
                                  <div className="timestamp">
                                    Posted: {formatDate(material.created_at)}
                                  </div>
                                </div>
                              </div>
                              <div className="material-content">
                                <h3>{material.title}</h3>
                                <p dangerouslySetInnerHTML={{ __html: material.content || '' }}></p>
                                {material.due_date && (
                                  <div className="due-date">
                                    Due: {formatDate(material.due_date)}
                                  </div>
                                )}
                                {material.points != null && (
                                  <div className="points">
                                    Points: {material.points}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                </div> 
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Announcement Modal */}
      {showEditModal && announcementToEdit && (
        <div className="modal-overlay stream-modal-overlay" onClick={(e) => {
          // Optional: Close modal if overlay is clicked
          // if (e.target === e.currentTarget) { 
          //   setShowEditModal(false); 
          //   setAnnouncementToEdit(null);
          //   // Reset attachments/title if needed
          //   setAnnouncementTitle('');
          //   setAttachments([]);
          // }
        }}>
          <div className="modal-content stream-edit-modal"> {/* Add a specific class */} 
            <div className="editor-header">
              <h3>Edit Announcement</h3>
              <button onClick={() => {
                setShowEditModal(false);
                setAnnouncementToEdit(null);
                // Reset form states
                setAnnouncementTitle(''); 
                if (editorRef.current) editorRef.current.innerHTML = '';
                setAttachments([]);
              }} className="close-modal">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handlePost} className="modal-form">
              {/* Re-use the editor components inside the modal */}
              <div className="title-input-container">
                <label htmlFor="edit-announcement-title">Title (optional)</label>
                <input
                  id="edit-announcement-title"
                  type="text"
                  value={announcementTitle} // Already managed by state
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="Enter announcement title"
                  className="title-input"
                />
              </div>
              
              {/* Editor toolbar with hover tooltips */}
              <div className="editor-toolbar">
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
                className="editor-content modal-editor-content" // Maybe add specific class if needed
                ref={editorRef} // Use the same ref
                contentEditable
                onKeyDown={handleKeyDown} 
                onPaste={(e) => { /* Ensure paste handler is attached if not global */ 
                    const editor = editorRef.current;
                    const handlePaste = (event) => {
                        event.preventDefault();
                        const text = (event.clipboardData || window.clipboardData).getData('text/plain');
                        const selection = window.getSelection();
                        if (!selection.rangeCount) return;
                        const range = selection.getRangeAt(0);
                        range.deleteContents();
                        const span = document.createElement('span');
                        span.style.color = 'black';
                        span.style.backgroundColor = 'transparent';
                        span.style.setProperty('background-color', 'transparent', 'important');
                        span.style.setProperty('color', 'black', 'important');
                        span.textContent = text;
                        range.insertNode(span);
                        range.setStartAfter(span);
                        range.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    };
                    handlePaste(e); // Call the handler
                }} 
                data-placeholder="Edit announcement content..."
                aria-label="Announcement content"
                // The content is set in handleEditAnnouncement via setTimeout
              ></div>
              
              {/* Attachments handling (consider how to manage updates/deletions) */}
              {/* For simplicity, just show existing and allow adding new for now */}
              <div className="editor-footer">
                <div className="editor-actions-left">
                    <label className="attach-btn" title="Attach Files">
                        <FaPaperclip /> Add Files
                        <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} multiple />
                    </label>
                    <button 
                        type="button" 
                        className="link-btn" 
                        onClick={() => handleFormat('insertLink')}
                        title="Insert Link"
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
                          {/* ... attachment rendering logic ... */}
                          <span className="file-icon">
                            {attachment.thumbnail ? (
                              <img src={attachment.thumbnail} alt="Preview" className="attachment-preview" />
                            ) : (
                              attachment.file_type?.startsWith('image/') ?
                                <img src={attachment.file_url} alt="Preview" className="attachment-preview" onError={(e) => e.target.style.display='none'} /> :
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M16.5 6V3.5C16.5 2.12 15.38 1 14 1H5.5C4.12 1 3 2.12 3 3.5V18.5C3 19.88 4.12 21 5.5 21H18.5C19.88 21 21 19.88 21 18.5V8.5L16.5 6ZM5.5 3H14V7.5H18.5V18.5H5.5V3ZM7 14H17V16H7V14ZM7 10H17V12H7V10Z"/></svg>
                            )}
                          </span>
                          <span 
                            className="attachment-file file-preview-link"
                            onClick={(e) => {
                              e.preventDefault();
                              // Handle different types of attachments
                              if (attachment.file instanceof File) {
                                // For newly added files
                                const tempUrl = URL.createObjectURL(attachment.file);
                                setFilePreviewModal({
                                  isOpen: true,
                                  file: attachment.name || attachment.file.name,
                                  type: getFileTypeFromUrl(attachment.name || attachment.file.name),
                                  url: tempUrl
                                });
                              } else if (attachment.file_url) {
                                // For existing files with URLs
                                setFilePreviewModal({
                                  isOpen: true,
                                  file: attachment.file_name || 'File',
                                  type: getFileTypeFromUrl(attachment.file_url),
                                  url: attachment.file_url
                                });
                              }
                            }}
                          >
                            {attachment.name || attachment.file_name}
                          </span>
                           <span className="file-size">
                             ({formatFileSize(attachment.size || attachment.file_size || 0)})
                          </span>
                          <button 
                            type="button" 
                            className="remove-attachment-btn"
                            onClick={() => removeAttachment(index)}
                            title="Remove attachment"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="modal-actions">
                <button type="button" onClick={() => {
                   setShowEditModal(false);
                   setAnnouncementToEdit(null);
                   setAnnouncementTitle(''); 
                   if (editorRef.current) editorRef.current.innerHTML = '';
                   setAttachments([]);
                 }} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="post-btn" disabled={posting}>
                  <FaPaperPlane /> {posting ? 'Saving...' : 'Update Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link URL Modal */}
      {linkUrlModal.isOpen && (
        <div className="link-confirmation-overlay stream-modal-overlay">
          <div className="modal-content link-url-modal">
            <div className="modal-header">
              <h3>Insert Link</h3>
              <button onClick={() => setLinkUrlModal({...linkUrlModal, isOpen: false})} className="close-modal">
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="link-url-input">Enter link URL:</label>
                <input
                  id="link-url-input"
                  type="text"
                  value={linkUrlModal.url}
                  onChange={(e) => setLinkUrlModal({...linkUrlModal, url: e.target.value})}
                  placeholder="https://"
                  className="link-url-input"
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => setLinkUrlModal({...linkUrlModal, isOpen: false})}
              >
                Cancel
              </button>
              <button 
                className="confirm-btn"
                onClick={confirmInsertLink}
              >
                Insert Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Link Confirmation Modal */}
      {linkModal.isOpen && (
        <div className="link-confirmation-overlay stream-modal-overlay">
          <div className="modal-content link-confirmation-modal">
            <div className="modal-header">
              <h3>External Link</h3>
              <button onClick={() => setLinkModal({ isOpen: false, url: '' })} className="close-modal">
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to leave and visit this external link?</p>
              <div className="link-url">
                <FaExternalLinkAlt />
                <span>{linkModal.url}</span>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => setLinkModal({ isOpen: false, url: '' })}
              >
                Cancel
              </button>
              <button 
                className="confirm-btn"
                onClick={confirmNavigation}
              >
                Continue to Site
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {filePreviewModal.isOpen && (
        <div className="file-preview-overlay stream-modal-overlay">
          <div className="modal-content file-preview-modal">
            <div className="modal-header">
              <h3>{filePreviewModal.file}</h3>
              <button onClick={() => setFilePreviewModal({...filePreviewModal, isOpen: false})} className="close-modal">
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              {filePreviewModal.type === 'image' && (
                <img src={filePreviewModal.url} alt="File Preview" className="file-preview-image" />
              )}
              {filePreviewModal.type === 'pdf' && (
                <iframe src={filePreviewModal.url} title="PDF Preview" className="file-preview-pdf" />
              )}
              {filePreviewModal.type === 'video' && (
                <video src={filePreviewModal.url} controls className="file-preview-video">
                  Your browser does not support video playback.
                </video>
              )}
              {filePreviewModal.type === 'audio' && (
                <audio src={filePreviewModal.url} controls className="file-preview-audio">
                  Your browser does not support audio playback.
                </audio>
              )}
              {filePreviewModal.type === 'text' && (
                <iframe src={filePreviewModal.url} title="Text Preview" className="file-preview-text">
                  Unable to preview text content.
                </iframe>
              )}
              {(filePreviewModal.type === 'office' || filePreviewModal.type === 'unknown') && (
                <div className="file-preview-not-available">
                  <div className="file-icon-large">
                    {filePreviewModal.type === 'office' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64">
                        <path fill="#1a73e8" d="M19,3H5C3.9,3,3,3.9,3,5v14c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V8L14,2z M9.8,13.4H8V17H6V7h2v4.2h1.8V7h2v10h-2V13.4z M18,17h-1.5l-0.9-3.2h-2L12.7,17h-1.5l2.3-10H15L18,17z"/>
                        <rect fill="#1a73e8" x="14.3" y="10.2" width="1" height="1"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64">
                        <path fill="#757575" d="M14,2H6C4.9,2,4,2.9,4,4v16c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V8L14,2z M16,18H8v-2h8V18z M16,14H8v-2h8V14z M13,9V3.5L18.5,9H13z"/>
                      </svg>
                    )}
                  </div>
                  <p className="preview-message">Preview not available for this file type</p>
                  <a 
                    href={filePreviewModal.url} 
                    download={filePreviewModal.file}
                    className="download-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="download-btn"
                onClick={() => {
                  const { url, file } = filePreviewModal;
                  const fullUrl = url.startsWith('http') ? url : `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`;
                  
                  // Create a download link
                  const link = document.createElement('a');
                  
                  // Set properties for download
                  link.href = fullUrl;
                  link.setAttribute('download', file);
                  
                  // For file types that browsers typically try to open, force the download
                  // by using a Blob if it's from the same origin (CORS restrictions apply)
                  if (fullUrl.startsWith(window.location.origin) || fullUrl.startsWith('http://localhost:')) {
                    // Show loading toast
                    const toastId = toast.loading(`Preparing download for ${file}...`);
                    
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
                        
                        // Update toast
                        toast.success(`Downloading ${file}`, { id: toastId });
                      })
                      .catch(err => {
                        console.error('Error creating blob for download:', err);
                        // Fall back to simple download
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        // Update toast
                        toast.success(`Downloading ${file}`, { id: toastId });
                      });
                  } else {
                    // For cross-origin URLs, use the simple approach
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    toast.success(`Downloading ${file}`);
                  }
                }}
              >
                <FaPaperclip /> Download File
              </button>
              <button
                className="close-btn"
                onClick={() => setFilePreviewModal({...filePreviewModal, isOpen: false})}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Removal Confirmation Modal */}
      {attachmentRemovalModal.isOpen && (
        <div className="modal-overlay stream-modal-overlay">
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
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M16.5 6V3.5C16.5 2.12 15.38 1 14 1H5.5C4.12 1 3 2.12 3 3.5V18.5C3 19.88 4.12 21 5.5 21H18.5C19.88 21 21 19.88 21 18.5V8.5L16.5 6ZM5.5 3H14V7.5H18.5V18.5H5.5V3ZM7 14H17V16H7V14ZM7 10H17V12H7V10Z"/>
                </svg>
                <span>{attachmentRemovalModal.attachmentName || 'Attachment'}</span>
              </div>
              <p className="warning-text">This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => setAttachmentRemovalModal({...attachmentRemovalModal, isOpen: false})}
              >
                Cancel
              </button>
              <button 
                className="confirm-btn danger-btn"
                onClick={() => {
                  const { attachmentId, announcementId, index } = attachmentRemovalModal;
                  // Close modal first
                  setAttachmentRemovalModal({
                    isOpen: false,
                    attachmentId: null,
                    announcementId: null,
                    attachmentName: '',
                    index: null
                  });
                  // Then perform the removal
                  performAttachmentRemoval({ attachmentId, announcementId, index });
                }}
              >
                <FaTrash /> Remove Attachment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stream; 