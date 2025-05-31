import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import EmojiPicker from 'emoji-picker-react';
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
  HiOutlinePresentationChartBar,
  HiOutlinePaperAirplane,
  HiOutlineUserCircle,
  HiOutlinePlusCircle,
  HiOutlineDotsVertical,
  HiOutlinePencil,
  HiOutlinePhotograph,
  HiOutlineEmojiHappy,
  HiOutlineThumbUp
} from "react-icons/hi";
import './Messages.css';
import './PrivateMessages.css'; // Import for emoji picker styles
import '../dashboard.css';
import '../common/Loaders.css';
import { io } from 'socket.io-client';
import { createCourseChat } from './messagingHelpers';
import Sidebar from '../Sidebar';
import LoadingIndicator from '../common/LoadingIndicator';

// Update the CSS for optimal message container layout
const messageContainerStyle = document.createElement('style');
messageContainerStyle.textContent = `
  /* Fix message container to properly fit screen */
  .dashboard-container {
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .main-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 56px); /* Adjust for header height */
  }
  
  .content-wrapper {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 0; /* Remove padding to maximize space */
  }
  
  .top-bar {
    flex-shrink: 0;
    padding: 8px 16px; /* Reduce padding */
    height: 50px; /* Fixed height */
  }
  
  .course-main-area {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    margin: 0; /* Remove margins */
  }
  
  .course-nav {
    flex-shrink: 0;
    height: 42px; /* Fixed height for nav */
    display: flex;
    align-items: center;
  }
  
  .nav-tab {
    padding: 8px 12px; /* Reduce padding */
  }
  
  .messages-container {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-radius: 0; /* Remove border radius */
    margin: 0; /* Remove margins */
  }
  
  .messages-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    margin: 0; /* Remove margins */
    padding: 0; /* Remove padding */
  }
  
  .messages-view {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    margin: 0; /* Remove margins */
    padding: 0; /* Remove padding */
    max-height: calc(100vh - 150px); /* Adjust height */
  }
  
  .active-conversation-header {
    flex-shrink: 0;
    padding: 8px 12px; /* Reduce padding */
    border-bottom: 1px solid #e0e0e0;
    background-color: white;
    height: 48px; /* Fixed height */
    display: flex;
    align-items: center;
  }
  
  .messages-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px; /* Reduce padding */
    background-color: #f5f7fb;
    margin: 0; /* Remove margins */
  }
  
  .message-input-wrapper {
    flex-shrink: 0;
    padding: 8px 12px; /* Reduce padding */
    border-top: 1px solid #e0e0e0;
    background-color: white;
  }
  
  /* Message item styling - make more compact */
  .message-item {
    margin-bottom: 6px; /* Reduce spacing */
    max-width: 80%; /* Allow wider messages */
  }
  
  .message-item.sent {
    margin-left: auto;
    margin-right: 8px; /* Reduce margin */
  }
  
  .message-item.received {
    margin-right: auto;
    margin-left: 8px; /* Reduce margin */
  }
  
  /* Message bubble styling */
  .message-bubble {
    padding: 8px 10px; /* Reduce padding */
    border-radius: 16px;
    background-color: #f0f2f5;
    position: relative;
  }
  
  .message-text {
    font-size: 14px; /* Smaller font size */
    line-height: 1.4; /* Tighter line height */
  }
  
  .deleted-message-text {
    font-style: italic;
    color: #888;
    font-size: 14px;
  }
  
  .message-time {
    font-size: 11px; /* Smaller font size */
    margin-top: 2px;
    opacity: 0.7;
  }
  
  .message-sender {
    font-size: 12px; /* Smaller font size */
    margin-bottom: 2px;
    font-weight: 500;
  }
  
  .message-item.sent .message-bubble {
    color: white;
  }
  
  /* Date separator */
  .date-separator {
    text-align: center;
    margin: 8px 0;
    position: relative;
  }
  
  .date-separator span {
    background-color: rgba(245, 247, 251, 0.8);
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    color: #65676B;
  }
  
  /* Adjust message input container */
  .message-input-container {
    display: flex;
    align-items: center;
    background-color: #f0f2f5;
    border-radius: 18px; /* Smaller radius */
    padding: 6px 12px; /* Reduce padding */
    margin: 0; /* Remove margin */
  }
  
  .message-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    padding: 6px 0; /* Reduce padding */
    font-size: 14px; /* Smaller font */
  }
  
  /* Emoji button */
  .emoji-button {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px; /* Reduce padding */
    border-radius: 50%;
    margin-left: 6px; /* Reduce margin */
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .emoji-icon {
    font-size: 1.2rem; /* Smaller icon */
  }
  
  /* Send button */
  .send-button {
    background-color: #0084ff;
    color: white;
    border: none;
    border-radius: 50%;
    width: 32px; /* Smaller size */
    height: 32px; /* Smaller size */
    margin-left: 6px; /* Reduce margin */
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  
  .send-icon {
    transform: rotate(90deg);
    font-size: 1.1rem; /* Smaller icon */
  }
  
  /* Scroll button */
  .scroll-to-bottom-button {
    position: absolute;
    bottom: 65px;
    right: 15px;
    width: 36px; /* Smaller size */
    height: 36px; /* Smaller size */
    border-radius: 50%;
    background-color: #000000; /* Changed to black */
    border: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    opacity: 0.85;
    transition: opacity 0.2s, transform 0.2s;
  }
  
  .scroll-to-bottom-button:hover {
    opacity: 1;
    transform: scale(1.05);
  }
  
  .scroll-to-bottom-button svg {
    color: #ffffff; /* Changed to white */
    fill: #ffffff; /* Ensure fill is also white */
  }
  
  /* Typing indicator */
  .typing-indicator {
    padding: 4px 8px;
    font-size: 12px;
    color: #65676B;
    font-style: italic;
  }
  
  /* Ensure the message container takes exactly the available height */
  @media screen and (min-height: 600px) {
    .messages-view {
      max-height: calc(100vh - 150px);
    }
  }
  
  @media screen and (min-height: 800px) {
    .messages-view {
      max-height: calc(100vh - 160px);
    }
  }
  
  @media screen and (min-height: 1000px) {
    .messages-view {
      max-height: calc(100vh - 180px);
    }
  }
  
  /* Archived course styles */
  .archived-course-notification {
    padding: 12px;
    margin-bottom: 8px;
    background-color: #e3f2fd;
    border-radius: 8px;
    border-left: 4px solid #1976d2;
  }
  
  .archived-message {
    color: #1976d2;
    font-size: 14px;
    font-weight: 500;
    text-align: center;
  }
  
  .user-item.disabled,
  .group-chat-option.disabled {
    opacity: 0.6;
    cursor: not-allowed !important;
    pointer-events: auto;
  }
  
  .image-upload-button.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }
  
  .reaction-badge.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
document.head.appendChild(messageContainerStyle);

const Messages = ({ setAuth }) => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [courseDetails, setCourseDetails] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Try to get the sidebar state from localStorage
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState === "true";
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [userRole, setUserRole] = useState(null);
  const [inputs, setInputs] = useState({
    first_name: "",
    last_name: "",
    profilePicture: null
  });
  const [isCoursesSubmenuOpen, setIsCoursesSubmenuOpen] = useState(false);
  const { first_name, last_name } = inputs;

  // Message state
  const [activeConversation, setActiveConversation] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [conversations, setConversations] = useState([]);
  const [courseStudents, setCourseStudents] = useState([]);
  const [newConversationModal, setNewConversationModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Chat settings state
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [newChatImage, setNewChatImage] = useState(null);

  // Add socket state
  const [socket, setSocket] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [typingTimeout, setTypingTimeout] = useState(null);

  // Add message reactions state
  const [messageReactions, setMessageReactions] = useState({});
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  // Common emoji reactions
  const commonReactions = ['👍', '❤️', '😂', '😮', '😢', '👏'];

  // Add a state variable to track if a course chat creation is in progress
  const [isCreatingCourseChat, setIsCreatingCourseChat] = useState(false);

  // Add a ref to track if we've already attempted to create a chat for this course
  const hasAttemptedChatCreation = React.useRef({});

  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  
  // Add a state for checking if the course is archived
  const isArchived = courseDetails?.status === 'archived';
  
  // Add a ref for the messages list container and state for scroll button
  const messagesEndRef = useRef(null);
  const messagesListRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  // Add state for loading optimization (but remove messageCache)
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messageLoadingTimeout = useRef(null);
  
  // Add state for emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);

  // Add state for link confirmation popup
  const [linkConfirmation, setLinkConfirmation] = useState({
    show: false,
    url: '',
    position: null
  });

  // Add message search state variables after the link confirmation state
  const [messageSearchTerm, setMessageSearchTerm] = useState("");
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  // Add file attachment state
  const [fileAttachment, setFileAttachment] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch message reactions for the active conversation
  const fetchMessageReactions = useCallback(async () => {
    if (!activeConversation || !userProfile) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      // Check if the conversation ID is a mock ID (string) or a real ID (number)
      const isNumericId = !isNaN(parseInt(activeConversation));
      
      // Only proceed with real conversations (numeric IDs)
      if (!isNumericId) {
        console.log("Using mock conversation data, not fetching reactions");
        return;
      }

      const response = await fetch(`http://localhost:5000/api/messages/conversations/${activeConversation}/reactions`, {
        method: "GET",
        headers: { jwt_token: token }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch message reactions');
      }

      const reactionsData = await response.json();
      console.log("Fetched message reactions:", reactionsData);
      setMessageReactions(reactionsData);
    } catch (err) {
      console.error("Error fetching message reactions:", err.message);
      // Don't show an error toast for this as it's not critical
    }
  }, [activeConversation, userProfile]);

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
      if (!token) return null;

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
      
      return parseData; // Return the data
    } catch (err) {
      console.error("Error fetching profile:", err.message);
      return null;
    }
  }, [userRole]);

  const fetchCourseMembers = useCallback(async () => {
    if (!courseId) return;
    
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      console.log(`Fetching course members for course ID: ${courseId}`);
      
      // Try to fetch course members using the API endpoint
      const response = await fetch(`http://localhost:5000/api/messages/conversations/courses/${courseId}/participants`, {
        method: "GET",
        headers: { jwt_token: token }
      });

      if (!response.ok) {
        console.warn(`API endpoint not available (${response.status}: ${response.statusText}). Using mock data instead.`);
        // Fall back to mock data for demonstration
        const mockStudents = [
          { user_id: '1', first_name: 'John', last_name: 'Doe', profile_picture_url: null },
          { user_id: '2', first_name: 'Jane', last_name: 'Smith', profile_picture_url: null },
          { user_id: '3', first_name: 'Mike', last_name: 'Wilson', profile_picture_url: null },
          { user_id: '4', first_name: 'Sarah', last_name: 'Johnson', profile_picture_url: null }
        ];
        
        const mockProfessor = { 
          user_id: '5', 
          first_name: 'Professor', 
          last_name: 'Anderson', 
          profile_picture_url: null 
        };

        const allMembers = [...mockStudents, mockProfessor];
        setCourseStudents(allMembers);
        console.log(`Set ${allMembers.length} mock course members`);
        return;
      }

      const data = await response.json();
      setCourseStudents(data);
      console.log(`Successfully loaded ${data.length} course members`);
    } catch (err) {
      console.error("Error fetching course members:", err.message);
      // Use mock data as fallback
      const mockStudents = [
        { user_id: '1', first_name: 'John', last_name: 'Doe', profile_picture_url: null },
        { user_id: '2', first_name: 'Jane', last_name: 'Smith', profile_picture_url: null },
        { user_id: '3', first_name: 'Mike', last_name: 'Wilson', profile_picture_url: null },
        { user_id: '4', first_name: 'Sarah', last_name: 'Johnson', profile_picture_url: null },
        { user_id: '5', first_name: 'Professor', last_name: 'Anderson', profile_picture_url: null }
      ];
      setCourseStudents(mockStudents);
      console.log(`Set ${mockStudents.length} mock course members after error`);
    }
  }, [courseId]);

  const initializeMockConversations = useCallback(() => {
    if (!userProfile || !courseStudents || courseStudents.length === 0) return;

    // Mock course-specific group chat - each course has its own chat
    const courseConversation = {
      conversation_id: 'course_' + courseId, // Make unique by course ID
      name: courseDetails?.name ? `${courseDetails.name} Chat` : `Course ${courseId} Chat`,
      conversation_type: 'group',
      course_id: courseId, // Link to specific course
      participants: [...courseStudents.map(student => ({
        user_id: student.user_id,
        first_name: student.first_name,
        last_name: student.last_name,
        profile_picture_url: student.profile_picture_url
      }))],
      messages: [
        {
          message_id: '1',
          sender_id: '5', // professor
          sender_name: 'Professor Anderson',
          content: `Welcome to the chat for ${courseDetails?.name || 'this course'}! Use this space to discuss topics related to this specific course.`,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
        }
      ]
    };

    // Mock one-on-one chats
    const oneOnOneChats = courseStudents
      .filter(student => student.user_id !== userProfile.user_id)
      .map(student => ({
        conversation_id: `private_${student.user_id}`,
        name: `${student.first_name} ${student.last_name}`,
        conversation_type: 'private',
        participants: [{
          user_id: student.user_id,
          first_name: student.first_name,
          last_name: student.last_name,
          profile_picture_url: student.profile_picture_url
        }, {
          user_id: userProfile.user_id,
          first_name: userProfile.first_name,
          last_name: userProfile.last_name,
          profile_picture_url: userProfile.profile_picture_url
        }],
        messages: []
      }));

    // Example messages in private chats
    if (oneOnOneChats.length > 0) {
      // Add a sample message to the first private chat
      oneOnOneChats[0].messages = [
        {
          message_id: '2',
          sender_id: oneOnOneChats[0].participants[0].user_id,
          sender_name: `${oneOnOneChats[0].participants[0].first_name} ${oneOnOneChats[0].participants[0].last_name}`,
          content: 'Hi there! I had a question about the upcoming assignment.',
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
        },
        {
          message_id: '3',
          sender_id: userProfile.user_id,
          sender_name: `${userProfile.first_name} ${userProfile.last_name}`,
          content: 'Sure, what would you like to know?',
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 11).toISOString(), // 11 hours ago
        }
      ];
    }

    setConversations([courseConversation, ...oneOnOneChats]);
    setActiveConversation('course_' + courseId);
  }, [userProfile, courseStudents, courseId, courseDetails]);

  // Update the createCourseGroupChat function to use the helper
  const createCourseGroupChat = useCallback(async () => {
    if (!courseId || !userProfile || isCreatingCourseChat) return;
    
    // Disable creating course group chats for archived courses
    if (isArchived) {
      toast.error('Cannot create group chats in archived courses - archived courses are view-only');
      return;
    }
    
    // Set flag to prevent multiple simultaneous creations
    setIsCreatingCourseChat(true);
    
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication required");
      }

      // Show a loading toast
      const loadingToast = toast.loading('Creating course chat...');
      
      // First check if chat already exists on server
      const checkResponse = await fetch(`http://localhost:5000/api/messages/conversations`, {
        method: "GET",
        headers: { jwt_token: token }
      });

      if (checkResponse.ok) {
        const existingChats = await checkResponse.json();
        const courseIdStr = String(courseId);
        const existingChat = existingChats.find(
          c => c.conversation_type === 'group' && String(c.course_id) === courseIdStr
        );

        if (existingChat) {
          toast.dismiss(loadingToast);
          setConversations(prev => {
            if (!prev.some(c => c.conversation_id === existingChat.conversation_id)) {
              return [existingChat, ...prev];
            }
            return prev;
          });
          setActiveConversation(existingChat.conversation_id);
          toast.success('Course chat loaded');
          return;
        }
      }

      // If no existing chat found, create new one
      const response = await fetch(`http://localhost:5000/api/messages/conversations`, {
        method: "POST",
        headers: { 
          jwt_token: token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: courseDetails?.name ? `${courseDetails.name} Chat` : `Course ${courseId} Chat`,
          course_id: courseId,
          conversation_type: 'group'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create course chat');
      }

      const newChat = await response.json();
      toast.dismiss(loadingToast);
      
      setConversations(prev => {
        if (!prev.some(c => c.conversation_id === newChat.conversation_id)) {
          return [newChat, ...prev];
        }
        return prev;
      });
      
      setActiveConversation(newChat.conversation_id);
      toast.success('Course chat created!');
    } catch (err) {
      console.error("Error creating course chat:", err.message);
      toast.error(`Could not create course chat: ${err.message}`);
      
      // Fall back to mock data only if we're in development/testing
      if (process.env.NODE_ENV === 'development') {
        initializeMockConversations();
      }
    } finally {
      setIsCreatingCourseChat(false);
    }
  }, [courseId, userProfile, courseDetails, initializeMockConversations, isArchived]);

  // Fix the useEffect that checks/creates course chats by improving the comparison logic
  useEffect(() => {
    // Only run this once per course
    if (!courseId || !userProfile || hasAttemptedChatCreation.current[courseId]) {
      return;
    }
    
    // Mark that we've attempted chat creation for this course
    hasAttemptedChatCreation.current[courseId] = true;
    
    // Don't show UI loading indicator for background operation
    const autoCreateCourseChat = async () => {
      try {
        // IMPORTANT: First check if conversation with this course ID already exists in our state
        const courseIdStr = String(courseId);
        
        console.log(`Checking for course chat for course ${courseIdStr} in current conversations:`, 
          conversations.map(c => ({
            id: c.conversation_id,
            type: c.conversation_type,
            course_id: c.course_id ? `${c.course_id} (${typeof c.course_id})` : 'none'
          }))
        );
        
        const existingChatInState = conversations.find(c => {
          if (c.conversation_type !== 'group') return false;
          if (!c.course_id && c.course_id !== 0) return false;
          
          const convCourseIdStr = String(c.course_id);
          const isMatch = convCourseIdStr === courseIdStr;
          console.log(`Comparing: course chat ${c.conversation_id}, course_id ${convCourseIdStr} === ${courseIdStr}: ${isMatch}`);
          return isMatch;
        });
        
        if (existingChatInState) {
          console.log(`Found existing chat for course ${courseIdStr} in state:`, existingChatInState.conversation_id);
          setActiveConversation(existingChatInState.conversation_id);
          return;
        }
        
        // No existing chat in state, check on server before creating
        console.log(`No chat found in state for course ${courseIdStr}, checking server...`);
        const token = localStorage.getItem("token");
        if (!token) return;
        
        // Query server for existing conversations
        const response = await fetch(`http://localhost:5000/api/messages/conversations`, {
          method: "GET",
          headers: { jwt_token: token }
        });
        
        if (response.ok) {
          const serverConversations = await response.json();
          // Check for existing course chat on server with exact course ID match
          const existingChatOnServer = serverConversations.find(
            c => c.conversation_type === 'group' && String(c.course_id) === courseIdStr
          );
          
          if (existingChatOnServer) {
            console.log(`Found existing chat for course ${courseIdStr} on server:`, existingChatOnServer.conversation_id);
            // Add to state if not already there
            setConversations(prev => {
              if (!prev.some(c => c.conversation_id === existingChatOnServer.conversation_id)) {
                return [existingChatOnServer, ...prev];
              }
              return prev;
            });
            setActiveConversation(existingChatOnServer.conversation_id);
            return;
          }
        }
        
        // If we get here, no chat exists for this course, create one
        console.log(`No chat found for course ${courseIdStr} anywhere, creating new chat...`);
        if (!isCreatingCourseChat) {
          createCourseGroupChat();
        }
      } catch (err) {
        console.error("Error in automatic course chat creation:", err);
        // Don't show errors to user for background operations
      }
    };
    
    autoCreateCourseChat();
  }, [courseId, userProfile, conversations, isCreatingCourseChat, createCourseGroupChat]);

  const fetchUserConversations = useCallback(async () => {
    if (!userProfile) return;

    console.log("⭐ Attempting to fetch user conversations for user:", userProfile.user_id);

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      // Try to fetch conversations using the API endpoint
      const response = await fetch(`http://localhost:5000/api/messages/conversations`, {
        method: "GET",
        headers: { jwt_token: token }
      });

      if (!response.ok) {
        // Fall back to mock data for demonstration
        console.warn("API endpoint not available. Using mock data instead.");
        initializeMockConversations();
        return;
      }

      const data = await response.json();
      console.log(`⭐ Received ${data.length} conversations from server:`, data.map(c => ({
        id: c.conversation_id,
        type: c.conversation_type,
        course_id: c.course_id,
        name: c.name
      })));
      
      // If we're in a course context, make sure we actually show course chats
      // by converting course_id values to strings
      const normalizedData = data.map(conv => {
        // Ensure each conversation has a messages array
        if (!conv.messages) {
          conv.messages = [];
        }
        
        if (conv.course_id !== null && conv.course_id !== undefined) {
          return {
            ...conv,
            course_id: String(conv.course_id) // Ensure course_id is a string
          };
        }
        return conv;
      });
      
      // Sort conversations to pin course chats to the top
      const sortedConversations = [...normalizedData].sort((a, b) => {
        // Course chats come first
        if (a.conversation_type === 'group' && a.course_id && 
            !(b.conversation_type === 'group' && b.course_id)) {
          return -1;
        }
        if (b.conversation_type === 'group' && b.course_id && 
            !(a.conversation_type === 'group' && a.course_id)) {
          return 1;
        }
        
        // For all other conversations or between course chats, sort by updated_at
        return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
      });
      
      // Update state with the sorted conversations
      setConversations(prevConversations => {
        // For each conversation, preserve existing messages if we already have them
        return sortedConversations.map(newConv => {
          const existingConv = prevConversations.find(c => c.conversation_id === newConv.conversation_id);
          if (existingConv && existingConv.messages && existingConv.messages.length > 0) {
            return {
              ...newConv,
              messages: existingConv.messages
            };
          }
          return newConv;
        });
      });
      
      // Set active conversation if none is selected
      if (sortedConversations.length > 0 && !activeConversation) {
        // If we're in a course context, prioritize that course's chat
        if (courseId) {
          const courseIdStr = String(courseId);
          const currentCourseChat = sortedConversations.find(
            c => c.conversation_type === 'group' && String(c.course_id) === courseIdStr
          );
          
          if (currentCourseChat) {
            console.log(`Found and activating course chat for course ${courseIdStr}:`, currentCourseChat.conversation_id);
            setActiveConversation(currentCourseChat.conversation_id);
          } else {
            console.log(`No course chat found for course ${courseIdStr}, setting first conversation active`);
            setActiveConversation(sortedConversations[0].conversation_id);
          }
        } else {
          // No course context, just select the first conversation
          setActiveConversation(sortedConversations[0].conversation_id);
        }
      }
    } catch (err) {
      console.error("Error fetching conversations:", err.message);
      // Use mock data as fallback
      initializeMockConversations();
    }
  }, [userProfile, courseId, activeConversation, initializeMockConversations]);

  // Simplify fetchConversationMessages function without caching
  const fetchConversationMessages = useCallback(async (conversationId) => {
    if (!conversationId || !userProfile) return;
    
    // Check if the conversation ID is a mock ID (string) or a real ID (number)
    const isNumericId = !isNaN(parseInt(conversationId));
    
    // If it's not a numeric ID, it's a mock conversation, so we don't need to fetch from API
    if (!isNumericId) {
      console.log("Using mock conversation data for ID:", conversationId);
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      
      // Important: reset timeout if it exists
      if (messageLoadingTimeout.current) {
        clearTimeout(messageLoadingTimeout.current);
      }
      
      // Set loading state immediately
      setLoadingMessages(true);
      
      // Set a maximum loading time as a fallback in case of issues
      const maxLoadingTimeout = setTimeout(() => {
        setLoadingMessages(false);
        console.log("Maximum loading time reached, forcing loading state to complete");
      }, 8000); // 8 second maximum loading time
      
      // Show loading state for the conversation
      setConversations(prev => 
        prev.map(conv => 
          conv.conversation_id === conversationId 
            ? { ...conv, isLoading: true }
            : conv
        )
      );
      
      // Use AbortController for fetch timeout and cancelation
      const controller = new AbortController();
      const signal = controller.signal;
      
      // Set a timeout for the fetch operation
      const fetchTimeout = setTimeout(() => controller.abort(), 10000);
      
      // Try to fetch messages using the API endpoint
      const response = await fetch(`http://localhost:5000/api/messages/conversations/${conversationId}/messages`, {
        method: "GET",
        headers: { jwt_token: token },
        signal
      });
      
      clearTimeout(fetchTimeout);
      
      if (!response.ok) {
        // Fall back to mock data or existing data
        console.warn(`API endpoint not available (${response.status}: ${response.statusText}). Using existing data instead.`);
        setConversations(prev => 
          prev.map(conv => 
            conv.conversation_id === conversationId 
              ? { ...conv, isLoading: false }
              : conv
          )
        );
        setLoadingMessages(false);
        clearTimeout(maxLoadingTimeout);
        return;
      }
      
      const data = await response.json();
      
      // Ensure minimum loading time for UX consistency
      const minLoadingTime = 500;
      const loadingStartTime = Date.now();
      const timeElapsed = Date.now() - loadingStartTime;
      
      if (timeElapsed < minLoadingTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadingTime - timeElapsed));
      }
      
      // Update the conversation messages
      setConversations(prev => 
        prev.map(conv => 
          conv.conversation_id === conversationId 
            ? { ...conv, messages: data, isLoading: false }
            : conv
        )
      );
      
      setLoadingMessages(false);
      clearTimeout(maxLoadingTimeout);
      
      // Mark messages as read and handle read receipts
      try {
      await fetch(`http://localhost:5000/api/messages/conversations/${conversationId}/read`, {
        method: "PUT",
        headers: { jwt_token: token }
      });
      } catch (readError) {
        console.error("Error marking messages as read:", readError);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log("Fetch operation timed out");
        toast.error('Loading messages timed out. Please try again.');
      } else {
      console.error("Error fetching messages:", err.message);
      }
      
      // Remove loading state
      setConversations(prev => 
        prev.map(conv => 
          conv.conversation_id === conversationId 
            ? { ...conv, isLoading: false }
            : conv
        )
      );
      setLoadingMessages(false);
    }
  }, [userProfile]);

  // Simplify handleSendMessage by removing cache references
  const handleSendMessage = async () => {
    if ((!messageText.trim() && !fileAttachment) || !activeConversation || !userProfile) return;

    // Disable message sending for archived courses
    if (isArchived) {
      toast.error('Cannot send messages in archived courses - archived courses are view-only');
      return;
    }

    try {
      // Optimistically update the UI first
      const tempMessageId = `temp_${Date.now()}`;
      const tempMessage = {
        message_id: tempMessageId,
        conversation_id: activeConversation,
        sender_id: userProfile.user_id,
        sender_name: `${userProfile.first_name} ${userProfile.last_name}`,
        content: messageText.trim(),
        sent_at: new Date().toISOString(),
        profile_picture_url: userProfile.profile_picture_url,
        is_sending: true
      };
      
      // Add file attachment to temp message if exists
      if (fileAttachment) {
        const serverUrl = window.location.origin;
        tempMessage.attachment = {
          file_name: fileAttachment.name,
          file_size: fileAttachment.size,
          mime_type: fileAttachment.type,
          is_image: fileAttachment.type.startsWith('image/'),
          preview_url: filePreview,
          file_url: filePreview // Temporary URL for preview before the real one is available
        };
      }
      
      // Add the new message to the conversation immediately
      setConversations(prev => 
        prev.map(conv => 
          conv.conversation_id === activeConversation 
            ? { 
                ...conv, 
                messages: [...(conv.messages || []), tempMessage],
                // Also update the last_message and updated_at for sorting
                last_message: fileAttachment ? `📎 ${fileAttachment.name}` : tempMessage.content,
                updated_at: tempMessage.sent_at
              }
            : conv
        )
      );
      
      // Clear the input
      const messageToBeSent = messageText.trim();
      setMessageText('');
      
      // Check if the conversation ID is a mock ID (string) or a real ID (number)
      const isNumericId = !isNaN(parseInt(activeConversation));
      
      // If there's a file attachment, handle it first
      if (fileAttachment) {
        const formData = new FormData();
        formData.append('file', fileAttachment);
        
        // Upload file first
        const token = localStorage.getItem("token");
        if (!token) throw new Error('No authentication token found');
        
        try {
          const uploadResponse = await fetch(`http://localhost:5000/api/uploads/message`, {
            method: 'POST',
            headers: { jwt_token: token },
            body: formData
          });
          
          if (!uploadResponse.ok) {
            throw new Error('Failed to upload file');
          }
          
          const uploadResult = await uploadResponse.json();
          console.log("File upload result:", uploadResult);
          
          // Check if upload was successful and contains file data
          if (!uploadResult || uploadResult.error) {
            throw new Error(uploadResult?.error || 'Invalid server response');
          }
          
          // Try to send via WebSocket first if it's a real conversation ID
          if (socket && socket.connected && isNumericId) {
            socket.emit('send_private_message', {
              conversation_id: activeConversation,
              content: messageToBeSent || " ", // Ensure content is never empty
              file_attachment: {
                file_name: uploadResult.file_name || fileAttachment.name,
                file_path: uploadResult.file_path || `/uploads/messages/${Date.now()}-${fileAttachment.name}`,
                file_size: uploadResult.file_size || fileAttachment.size,
                mime_type: uploadResult.mime_type || fileAttachment.type,
                is_image: uploadResult.is_image !== undefined ? 
                  uploadResult.is_image : 
                  fileAttachment.type.startsWith('image/')
              }
            }, (acknowledgement) => {
              // Handle acknowledgement if the socket supports it
              if (acknowledgement && acknowledgement.error) {
                console.error("Socket error:", acknowledgement.error);
                toast.error(`Failed to send message: ${acknowledgement.error}`);
                
                // Update message status to failed
                setConversations(prev => 
                  prev.map(conv => 
                    conv.conversation_id === activeConversation 
                      ? { 
                          ...conv, 
                          messages: conv.messages.map(msg => 
                            msg.message_id === tempMessageId 
                              ? { ...msg, is_sending: false, failed: true }
                              : msg
                          )
                        }
                      : conv
                  )
                );
              } else if (acknowledgement && acknowledgement.success && acknowledgement.message) {
                // Replace temp message with real message from server
                setConversations(prev => 
                  prev.map(conv => 
                    conv.conversation_id === activeConversation 
                      ? { 
                          ...conv, 
                          messages: conv.messages.map(msg => 
                            msg.message_id === tempMessageId 
                              ? { ...acknowledgement.message, is_sending: false }
                              : msg
                          )
                        }
                      : conv
                  )
                );
              }
            });
          } else {
            // Fall back to REST API for file attachment message
            const token = localStorage.getItem("token");
            if (!token) return;
            
            try {
              const response = await fetch(`http://localhost:5000/api/messages/conversations/${activeConversation}/messages`, {
                method: "POST",
                headers: { 
                  jwt_token: token,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  content: messageToBeSent || " ",
                  file_attachment: {
                    file_name: uploadResult.file_name || fileAttachment.name,
                    file_path: uploadResult.file_path || `/uploads/messages/${Date.now()}-${fileAttachment.name}`,
                    file_size: uploadResult.file_size || fileAttachment.size,
                    mime_type: uploadResult.mime_type || fileAttachment.type,
                    is_image: uploadResult.is_image !== undefined ? 
                      uploadResult.is_image : 
                      fileAttachment.type.startsWith('image/')
                  }
                })
              });
              
              if (!response.ok) {
                throw new Error('Failed to send message with attachment');
              }
              
              // Get the real message data from the response
              const sentMessage = await response.json();
              
              // Replace the temp message with the real message
              setConversations(prev => 
                prev.map(conv => 
                  conv.conversation_id === activeConversation 
                    ? { 
                        ...conv, 
                        messages: conv.messages.map(msg => 
                          msg.message_id === tempMessageId ? { ...sentMessage, is_sending: false } : msg
                        )
                      }
                    : conv
                )
              );
            } catch (apiError) {
              console.error("REST API error:", apiError);
              toast.error('Failed to send message with attachment via API');
              
              // Mark the message as failed
              setConversations(prev => 
                prev.map(conv => 
                  conv.conversation_id === activeConversation 
                    ? { 
                        ...conv, 
                        messages: conv.messages.map(msg => 
                          msg.message_id === tempMessageId ? { ...msg, is_sending: false, failed: true } : msg
                        )
                      }
                    : conv
                )
              );
            }
          }
          
          // Clear file attachment state after sending
          setFileAttachment(null);
          setFilePreview(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          
          return; // Exit the function after handling file upload
        } catch (err) {
          console.error("Error uploading file:", err.message);
          toast.error('Failed to upload file');
          
          // Update message status to failed
          setConversations(prev => 
            prev.map(conv => 
              conv.conversation_id === activeConversation 
                ? { 
                    ...conv, 
                    messages: conv.messages.map(msg => 
                      msg.message_id === tempMessageId 
                        ? { ...msg, is_sending: false, failed: true }
                        : msg
                    )
                  }
                : conv
            )
          );
          return; // Exit the function after file upload error
        }
      }
      
      // If we reach here, it's a regular text message without attachment
      // Try to send via WebSocket first if it's a real conversation ID
      if (socket && socket.connected && isNumericId) {
        socket.emit('send_private_message', {
          conversation_id: activeConversation,
          content: messageToBeSent
        }, (acknowledgement) => {
          // Handle acknowledgement if the socket supports it
          if (acknowledgement && acknowledgement.error) {
            console.error("Socket error:", acknowledgement.error);
            toast.error(`Failed to send message: ${acknowledgement.error}`);
            
            // Update message status to failed
            setConversations(prev => 
              prev.map(conv => 
                conv.conversation_id === activeConversation 
                  ? { 
                      ...conv, 
                      messages: conv.messages.map(msg => 
                        msg.message_id === tempMessageId 
                          ? { ...msg, is_sending: false, failed: true }
                          : msg
                      )
                    }
                  : conv
              )
            );
          } else if (acknowledgement && acknowledgement.success && acknowledgement.message) {
            // Replace temp message with real message from server
            setConversations(prev => 
              prev.map(conv => 
                conv.conversation_id === activeConversation 
                  ? { 
                      ...conv, 
                      messages: conv.messages.map(msg => 
                        msg.message_id === tempMessageId 
                          ? { ...acknowledgement.message, is_sending: false }
                          : msg
                      )
                    }
                  : conv
              )
            );
          }
        });
        return;
      }

      // The rest of the existing code for handling text-only messages
      // ... existing code ...
    } catch (err) {
      // ... existing error handling ...
    }
  };

  // Add typing indicator functionality
  const handleMessageInput = (e) => {
    setMessageText(e.target.value);
    
    // Don't send typing indicators for archived courses
    if (isArchived) return;
    
    // Check if the conversation ID is a mock ID (string) or a real ID (number)
    const isNumericId = !isNaN(parseInt(activeConversation));
    
    // Send typing indicator if socket is connected and it's a real conversation
    if (socket && socket.connected && activeConversation && isNumericId) {
      // Clear existing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      
      // Send typing start
      socket.emit('typing_start', { conversation_id: activeConversation });
      
      // Set timeout to send typing end after 2 seconds of inactivity
      const timeout = setTimeout(() => {
        socket.emit('typing_end', { conversation_id: activeConversation });
      }, 2000);
      
      setTypingTimeout(timeout);
    }
  };

  // Mark messages as read when conversation is viewed
  useEffect(() => {
    if (!activeConversation || !userProfile || !socket) return;
    
    // Check if the conversation ID is a mock ID (string) or a real ID (number)
    const isNumericId = !isNaN(parseInt(activeConversation));
    
    // Only proceed with real conversations (numeric IDs)
    if (!isNumericId) return;
    
    // Mark messages as read in this conversation
    socket.emit('mark_as_read', { conversation_id: activeConversation });
    
    // Also make API call as fallback
    const token = localStorage.getItem("token");
    if (token) {
      fetch(`http://localhost:5000/api/messages/conversations/${activeConversation}/read`, {
        method: "PUT",
        headers: { jwt_token: token }
      }).catch(err => console.error("Error marking messages as read:", err));
    }
  }, [activeConversation, userProfile, socket]);

  const startNewConversation = async (user) => {
    if (!user || !userProfile) return;
    
    // Disable creating new conversations for archived courses
    if (isArchived) {
      toast.error('Cannot create new conversations in archived courses - archived courses are view-only');
      return;
    }
    
    // Check if a conversation already exists
    const existingConversation = conversations.find(conv => 
      conv.conversation_type === 'private' && 
      conv.participants && 
      conv.participants.some(p => p.user_id === user.user_id) &&
      conv.participants.some(p => p.user_id === userProfile.user_id)
    );

    if (existingConversation) {
      setActiveConversation(existingConversation.conversation_id);
      setNewConversationModal(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      
      // Create a new conversation via API
      const response = await fetch(`http://localhost:5000/api/messages/conversations`, {
        method: "POST",
        headers: { 
          jwt_token: token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: `${user.first_name} ${user.last_name}`,
          participants: [user.user_id],
          conversationType: 'private'
        })
      });
      
      if (!response.ok) {
        // Fall back to mock mode
        throw new Error('Failed to create conversation');
      }
      
      const data = await response.json();
      
      // Add the new conversation to state
      setConversations(prev => [data, ...prev]);
      setActiveConversation(data.conversation_id);
      setNewConversationModal(false);
      
      toast.success(`Started conversation with ${user.first_name}`);
    } catch (err) {
      console.error("Error creating conversation:", err.message);
      toast.error('Could not create conversation. Using offline mode.');
      
      // Create a mock conversation in offline mode
      const newConversationId = `private_${user.user_id}_${Date.now()}`;
      const newConversation = {
        conversation_id: newConversationId,
        name: `${user.first_name} ${user.last_name}`,
        conversation_type: 'private',
        participants: [{
          user_id: user.user_id,
          first_name: user.first_name,
          last_name: user.last_name,
          profile_picture_url: user.profile_picture_url
        }, {
          user_id: userProfile.user_id,
          first_name: userProfile.first_name,
          last_name: userProfile.last_name,
          profile_picture_url: userProfile.profile_picture_url
        }],
        messages: []
      };
      
      setConversations(prev => [newConversation, ...prev]);
      setActiveConversation(newConversationId);
      setNewConversationModal(false);
    }
  };

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

  useEffect(() => {
    const loadUserData = async () => {
      try {
        await fetchUserRole();
        const profileData = await getProfile();
        
        // Ensure first_name and last_name are set even if getProfile returns undefined
        if (profileData) {
          first_name = profileData.first_name;
          last_name = profileData.last_name;
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading user data:", error);
        setLoading(false);
      }
    };
    
    loadUserData();
  }, [fetchUserRole, getProfile]);

  useEffect(() => {
    if (courseId) {
      fetchCourseMembers();
    }
  }, [courseId, fetchCourseMembers]);

  useEffect(() => {
    if (userProfile) {
      fetchUserConversations();
    }
  }, [userProfile, fetchUserConversations]);

  // When conversations are loaded, set the active conversation if not already set
  useEffect(() => {
    if (conversations.length > 0 && !activeConversation) {
      if (courseId) {
        const courseChat = conversations.find(
          c => c.conversation_type === 'group' && String(c.course_id) === String(courseId)
        );
        if (courseChat) {
          setActiveConversation(courseChat.conversation_id);
        } else {
          setActiveConversation(conversations[0].conversation_id);
        }
      } else {
        setActiveConversation(conversations[0].conversation_id);
      }
    }
  }, [conversations, activeConversation, courseId]);

  // When activeConversation changes, fetch its messages
  useEffect(() => {
    if (activeConversation) {
      fetchConversationMessages(activeConversation);
    }
  }, [activeConversation, fetchConversationMessages]);

  // When activeConversation changes, also fetch message reactions
  useEffect(() => {
    if (activeConversation) {
      fetchMessageReactions();
    }
  }, [activeConversation, fetchMessageReactions]);

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };
  
  const tabs = [
    { id: 'stream', label: 'Stream' },
    { id: 'messages', label: 'Messages' },
    { id: 'assignments', label: 'Assignments' },
    { id: 'exams', label: 'Exams' },
    { id: 'people', label: 'People' }
  ];

  const updateChatName = async () => {
    if (!activeConversation || !newChatName.trim()) return;
    
    // Disable updating chat name for archived courses
    if (isArchived) {
      toast.error('Cannot update chat settings in archived courses - archived courses are view-only');
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      
      // Show loading toast
      const loadingToast = toast.loading('Updating chat name...');
      
      // Check if the conversation ID is a mock ID (string) or a real ID (number)
      const isNumericId = !isNaN(parseInt(activeConversation));
      
      // If it's a mock conversation or we're in development/testing mode, just update the state
      // This is a temporary solution until the backend API is fully implemented
      if (!isNumericId || process.env.REACT_APP_MOCK_API === 'true') {
        console.log("Using mock mode for updating chat name");
        setConversations(prev => 
          prev.map(conv => 
            conv.conversation_id === activeConversation 
              ? { ...conv, name: newChatName.trim() }
              : conv
          )
        );
        toast.dismiss(loadingToast);
        toast.success('Chat name updated!');
        setShowChatSettings(false);
        return;
      }
      
      // Make API call to update chat name for real conversations
      try {
        const response = await fetch(`http://localhost:5000/api/messages/conversations/${activeConversation}`, {
          method: "PATCH",
          headers: { 
            jwt_token: token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: newChatName.trim()
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to update chat name - API not implemented yet');
        }
        
        const data = await response.json();
        
        // Update the conversation in state
        setConversations(prev => 
          prev.map(conv => 
            conv.conversation_id === activeConversation 
              ? { ...conv, name: newChatName.trim() }
              : conv
          )
        );
        
        toast.dismiss(loadingToast);
        toast.success('Chat name updated!');
        setShowChatSettings(false);
      } catch (apiErr) {
        console.error("API not implemented yet, using client-side update:", apiErr.message);
        // Fall back to client-side update
        setConversations(prev => 
          prev.map(conv => 
            conv.conversation_id === activeConversation 
              ? { ...conv, name: newChatName.trim() }
              : conv
          )
        );
        toast.dismiss(loadingToast);
        toast.success('Chat name updated! (Using offline mode)');
        setShowChatSettings(false);
      }
    } catch (err) {
      console.error("Error updating chat name:", err.message);
      toast.error('Failed to update chat name. Using offline mode.');
      
      // Update state anyway in offline mode
      setConversations(prev => 
        prev.map(conv => 
          conv.conversation_id === activeConversation 
            ? { ...conv, name: newChatName.trim() }
            : conv
        )
      );
      setShowChatSettings(false);
    }
  };
  
  const updateChatImage = async (e) => {
    if (!activeConversation || !e.target.files || !e.target.files[0]) return;
    
    // Disable updating chat image for archived courses
    if (isArchived) {
      toast.error('Cannot update chat settings in archived courses - archived courses are view-only');
      return;
    }
    
    try {
      const file = e.target.files[0];
      const token = localStorage.getItem("token");
      if (!token) return;
      
      // Show loading toast
      const loadingToast = toast.loading('Uploading image...');
      
      // Check if the conversation ID is a mock ID (string) or a real ID (number)
      const isNumericId = !isNaN(parseInt(activeConversation));
      
      // For mock conversations or development/testing mode, use FileReader to update UI directly
      // This is a temporary solution until the backend API is fully implemented
      if (!isNumericId || process.env.REACT_APP_MOCK_API === 'true') {
        console.log("Using mock mode for updating chat image");
        const reader = new FileReader();
        reader.onloadend = () => {
          setConversations(prev => 
            prev.map(conv => 
              conv.conversation_id === activeConversation 
                ? { ...conv, profile_picture_url: reader.result }
                : conv
            )
          );
          toast.dismiss(loadingToast);
          toast.success('Chat image updated!');
          setShowChatSettings(false);
        };
        reader.readAsDataURL(file);
        return;
      }
      
      // For real conversations, try to use the API
      try {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch(`http://localhost:5000/api/messages/conversations/${activeConversation}/image`, {
          method: "PUT",
          headers: { 
            jwt_token: token
          },
          body: formData
        });
        
        if (!response.ok) {
          throw new Error('Failed to update chat image - API not implemented yet');
        }
        
        const data = await response.json();
        
        // Use the full image URL if provided by the server, otherwise use the relative path
        const imageUrl = data.fullImageUrl || `http://localhost:5000${data.profile_picture_url}`;
        
        // Update the conversation in state
        setConversations(prev => 
          prev.map(conv => 
            conv.conversation_id === activeConversation 
              ? { ...conv, profile_picture_url: imageUrl }
              : conv
          )
        );
        
        toast.dismiss(loadingToast);
        toast.success('Chat image updated!');
        setShowChatSettings(false);
      } catch (apiErr) {
        console.error("API not implemented yet, using client-side update:", apiErr.message);
        // Fall back to client-side update using FileReader
        const reader = new FileReader();
        reader.onloadend = () => {
          setConversations(prev => 
            prev.map(conv => 
              conv.conversation_id === activeConversation 
                ? { ...conv, profile_picture_url: reader.result }
                : conv
            )
          );
          toast.dismiss(loadingToast);
          toast.success('Chat image updated! (Using offline mode)');
          setShowChatSettings(false);
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error("Error updating chat image:", err.message);
      toast.error('Failed to update chat image. Using offline mode.');
      
      // Create a basic update in offline mode
      if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setConversations(prev => 
            prev.map(conv => 
              conv.conversation_id === activeConversation 
                ? { ...conv, profile_picture_url: reader.result }
                : conv
            )
          );
          setShowChatSettings(false);
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    }
  };

  // Optimize conversation filtering with memoization
  const filterConversationsForCourse = useCallback((conversationsArray) => {
    if (!courseId) {
      return conversationsArray;
    }
    
    const courseIdStr = String(courseId);
    
    // Use a Map for faster lookups
    const filteredMap = new Map();
    
    conversationsArray.forEach(conv => {
      // Always include private conversations
      if (conv.conversation_type === 'private') {
        filteredMap.set(conv.conversation_id, conv);
        return;
      }
      
      // For group conversations, check course ID
      if (conv.conversation_type === 'group' && conv.course_id != null) {
        const convCourseIdStr = String(conv.course_id);
        if (convCourseIdStr === courseIdStr) {
          filteredMap.set(conv.conversation_id, conv);
        }
      }
    });
    
    return Array.from(filteredMap.values());
  }, [courseId]);

  // Optimize conversation search with memoization
  const searchConversations = useCallback((conversationsArray, searchTerm) => {
    if (!searchTerm.trim()) {
      return conversationsArray;
    }
    
    const searchLower = searchTerm.toLowerCase();
    
    return conversationsArray.filter(conv => {
      // Search in conversation name
      if (conv.name?.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Search in last message
      if (conv.last_message?.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Search in participant names
      if (conv.participants) {
        return conv.participants.some(p => 
          p.first_name?.toLowerCase().includes(searchLower) ||
          p.last_name?.toLowerCase().includes(searchLower)
        );
      }
      
      return false;
    });
  }, []);

  // Memoize filtered and searched conversations
  const filteredConversations = useMemo(() => {
    const filtered = filterConversationsForCourse(conversations);
    return searchConversations(filtered, searchTerm);
  }, [conversations, filterConversationsForCourse, searchConversations, searchTerm]);

  // Add useEffect hooks to show chat messages when tab gets activated
  // Add this hook right after the useEffect that loads the user profile
  useEffect(() => {
    if (courseId) {
      console.log(`⭐ Navigation: In course context with course ID: ${courseId} (${typeof courseId})`);
    } else {
      console.log(`⭐ Navigation: Not in a course context`);
    }

    // Clear the activeConversation when course changes to force correct selection
    setActiveConversation(null);
    
    // Clear the hasAttemptedChatCreation for this course so we try again
    if (courseId) {
      hasAttemptedChatCreation.current = {};
    }
  }, [courseId]); // Only run when courseId changes

  // Add a new useEffect to fetch course details if we're in a course context
  useEffect(() => {
    if (!courseId) return;
    
    const fetchCourseDetails = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        
        // Try to fetch course details from API
        const response = await fetch(`http://localhost:5000/api/courses/${courseId}`, {
          method: "GET",
          headers: { jwt_token: token }
        });
        
        if (!response.ok) {
          // Create mock course data if API is not available
          setCourseDetails({
            id: courseId,
            name: `Course ${courseId}`
          });
          return;
        }
        
        const data = await response.json();
        setCourseDetails(data);
      } catch (err) {
        console.error("Error fetching course details:", err.message);
        // Set basic course info as fallback
        setCourseDetails({
          id: courseId,
          name: `Course ${courseId}`
        });
      }
    };
    
    fetchCourseDetails();
  }, [courseId]);

  // Helper: After course creation or enrollment, force re-fetch and set active conversation
  const forceRefreshAndSetActiveCourseChat = useCallback(async (newCourseId) => {
    await fetchUserConversations();
    const token = localStorage.getItem("token");
    if (!token) return;
    const response = await fetch(`http://localhost:5000/api/messages/conversations`, {
      method: "GET",
      headers: { jwt_token: token }
    });
    if (!response.ok) return;
    const conversations = await response.json();
    const newCourseChat = conversations.find(
      c => c.conversation_type === 'group' && String(c.course_id) === String(newCourseId)
    );
    if (newCourseChat) {
      setActiveConversation(newCourseChat.conversation_id);
    }
  }, [fetchUserConversations]);

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
        
        // Check if current course status and set course details
        if (Array.isArray(data) && courseId) {
          const currentCourse = data.find(course => course.course_id === parseInt(courseId) || course.course_id === courseId);
          if (currentCourse) {
            console.log('Messages - Current course status:', currentCourse.status);
            setCourseDetails(prev => ({ 
              ...prev,
              id: currentCourse.course_id,
              name: currentCourse.course_name,
              status: currentCourse.status // Set status directly from the API response
            }));
          }
        }
      } catch (err) {
        setCourses([]);
      } finally {
        setLoadingCourses(false);
      }
    };
    if (userRole) fetchCourses();
  }, [userRole, courseId]); // Add courseId as dependency to refetch when course changes

  // Update socket initialization to add reaction event handlers
  useEffect(() => {
    if (!userProfile) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    // Create socket connection
    const newSocket = io('http://localhost:5000', {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    newSocket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err.message);
      toast.error('Real-time messaging unavailable. Using offline mode.');
    });

    // Listen for new messages with improved handling
    newSocket.on('new_message', (message) => {
      console.log('Received new message via socket:', message);
      
      setConversations(prev => {
        const existingConversation = prev.find(conv => 
          conv.conversation_id === message.conversation_id
        );
        
        if (existingConversation) {
          // Check for duplicate messages more thoroughly
          const isDuplicate = existingConversation.messages?.some(
            msg => 
              // Check for exact message ID match
              msg.message_id === message.message_id ||
              // Or check for temporary message with same content and attachment
              (msg.is_sending && 
               msg.sender_id === message.sender_id &&
               ((msg.content === message.content) ||
                // Special case for file attachments
                (message.attachment && msg.attachment && 
                 msg.attachment.file_name === message.attachment.file_name)))
          );
          
          if (isDuplicate) return prev;
          
          // Find temporary message by content, sender, and file info if present
          const tempMsgIdx = (existingConversation.messages || []).findIndex(
            msg =>
              msg.sender_id === message.sender_id &&
              ((msg.content === message.content) ||
               // Match temp message with attachment by file name
               (message.attachment && msg.attachment && 
                msg.attachment.file_name === message.attachment.file_name)) &&
              (msg.is_sending || (typeof msg.message_id === 'string' && msg.message_id.startsWith('temp_')))
          );
          
          return prev.map(conv =>
            conv.conversation_id === message.conversation_id
              ? {
                  ...conv,
                  messages:
                    tempMsgIdx !== -1
                      ? conv.messages.map((msg, idx) =>
                          idx === tempMsgIdx ? { ...message, is_sending: false } : msg
                        )
                      : [...(conv.messages || []), message],
                  last_message: message.content || (message.attachment ? `📎 ${message.attachment.file_name}` : ''),
                  updated_at: message.sent_at
                }
              : conv
          );
        } else {
          // If conversation doesn't exist yet, fetch it
          const fetchNewConversation = async () => {
            try {
              const token = localStorage.getItem("token");
              const response = await fetch(`http://localhost:5000/api/messages/conversations/${message.conversation_id}`, {
                method: "GET",
                headers: { jwt_token: token }
              });
              
              if (!response.ok) {
                throw new Error('Failed to fetch conversation');
              }
              
              const conversationData = await response.json();
              
              // Add the new conversation with the message
              setConversations(prevConvs => [
                {
                  ...conversationData,
                  messages: [message]
                },
                ...prevConvs
              ]);
            } catch (err) {
              console.error("Error fetching new conversation:", err);
            }
          };
          
          fetchNewConversation();
        }
        
        return prev;
      });
    });

    // Listen for typing indicators
    newSocket.on('typing_indicator', (data) => {
      if (data.is_typing) {
        setTypingUsers(prev => ({
          ...prev,
          [data.conversation_id]: {
            ...prev[data.conversation_id],
            [data.user_id]: data.user_name
          }
        }));
      } else {
        setTypingUsers(prev => {
          const updatedConversation = { ...prev[data.conversation_id] };
          delete updatedConversation[data.user_id];
          return {
            ...prev,
            [data.conversation_id]: updatedConversation
          };
        });
      }
    });

    // Add reaction event handlers
    newSocket.on('message_reaction', (data) => {
      console.log('Received message reaction:', data);
      setMessageReactions(prev => {
        const messageId = data.message_id;
        const existingReactions = prev[messageId] || {};
        
        // Update or add the reaction
        return {
          ...prev,
          [messageId]: {
            ...existingReactions,
            [data.reaction]: [
              ...(existingReactions[data.reaction] || []),
              {
                user_id: data.user_id,
                user_name: data.user_name
              }
            ].filter((user, index, self) => 
              index === self.findIndex(u => u.user_id === user.user_id)
            ) // Remove duplicates
          }
        };
      });
    });

    newSocket.on('message_reaction_removed', (data) => {
      console.log('Reaction removed:', data);
      setMessageReactions(prev => {
        const messageId = data.message_id;
        const existingReactions = prev[messageId] || {};
        
        if (!existingReactions[data.reaction]) return prev;
        
        const updatedReactions = {
          ...existingReactions,
          [data.reaction]: existingReactions[data.reaction].filter(
            user => user.user_id !== data.user_id
          )
        };
        
        // Remove empty reaction arrays
        if (updatedReactions[data.reaction].length === 0) {
          delete updatedReactions[data.reaction];
        }
        
        return {
          ...prev,
          [messageId]: Object.keys(updatedReactions).length > 0 ? updatedReactions : undefined
        };
      });
    });

    // Add message deleted event handler
    newSocket.on('message_deleted', (data) => {
      console.log('Message deleted:', data);
      // Update conversations to mark message as deleted
      setConversations(prev => 
        prev.map(conv => {
          if (conv.conversation_id === data.conversation_id) {
            // Check if message is already marked as deleted
            const messageAlreadyDeleted = conv.messages?.some(msg => 
              msg.message_id === data.message_id && msg.is_deleted
            );
            
            if (messageAlreadyDeleted) {
              return conv;
            }
            
            return {
              ...conv,
              messages: conv.messages?.map(msg => 
                msg.message_id === data.message_id 
                  ? { 
                      ...msg, 
                      is_deleted: true, 
                      content: "This message was deleted",
                      // Keep the attachment data in the object but it won't be rendered
                      // This preserves the information for the backend while hiding it in the UI
                    }
                  : msg
              )
            };
          }
          return conv;
        })
      );
    });

    // Listen for read receipts
    newSocket.on('messages_read', (data) => {
      // Update read status for messages
      // This is for showing read receipts
      console.log('Messages read:', data);
    });

    // Listen for message delivery confirmation
    newSocket.on('message_delivered', (data) => {
      // Update message status from "sending" to "sent"
      console.log('Message delivered:', data);
    });

    // Listen for errors
    newSocket.on('error', (error) => {
      console.error('WebSocket error:', error);
      toast.error(error.message || 'An error occurred with messaging');
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [userProfile]);

  // Add reaction handler functions after other utility functions
  // Add these before the return statement

  // Add reaction handler
  const handleAddReaction = (messageId, reaction) => {
    if (!socket || !socket.connected) return;
    
    // Disable reactions for archived courses
    if (isArchived) {
      toast.error('Cannot add reactions in archived courses - archived courses are view-only');
      return;
    }
    
    // Find the message to check if it's deleted
    const messageIsDeleted = conversations.some(conv => 
      conv.messages?.some(msg => 
        msg.message_id === messageId && msg.is_deleted
      )
    );
    
    // Don't allow reactions on deleted messages
    if (messageIsDeleted) {
      toast.error('Cannot react to deleted messages');
      return;
    }
    
    // Check if user already has a reaction on this message
    const existingReactions = messageReactions[messageId] || {};
    let userAlreadyReacted = false;
    let existingReaction = null;
    
    // Look through all reactions to find if user already reacted
    Object.entries(existingReactions).forEach(([emoji, users]) => {
      if (users.some(user => user.user_id === userProfile.user_id)) {
        userAlreadyReacted = true;
        existingReaction = emoji;
      }
    });
    
    // If user already reacted with a different emoji, remove the old reaction first
    if (userAlreadyReacted && existingReaction !== reaction) {
      socket.emit('remove_reaction', {
        message_id: messageId,
        reaction: existingReaction
      });
      
      // Update UI to remove old reaction
      setMessageReactions(prev => {
        const updatedReactions = { ...prev };
        
        if (updatedReactions[messageId] && updatedReactions[messageId][existingReaction]) {
          // Filter out the user from the existing reaction
          updatedReactions[messageId] = {
            ...updatedReactions[messageId],
            [existingReaction]: updatedReactions[messageId][existingReaction].filter(
              user => user.user_id !== userProfile.user_id
            )
          };
          
          // Remove the reaction entirely if no users left
          if (updatedReactions[messageId][existingReaction].length === 0) {
            delete updatedReactions[messageId][existingReaction];
          }
          
          // Remove message entry if no reactions left
          if (Object.keys(updatedReactions[messageId]).length === 0) {
            delete updatedReactions[messageId];
          }
        }
        
        return updatedReactions;
      });
    }
    
    // If user clicked the same reaction they already had, toggle it off
    if (userAlreadyReacted && existingReaction === reaction) {
      handleRemoveReaction(messageId, reaction);
      return;
    }
    
    // Add the new reaction
    socket.emit('add_reaction', {
      message_id: messageId,
      reaction: reaction
    });
    
    // Optimistically update UI
    setMessageReactions(prev => {
      const existingReactions = prev[messageId] || {};
      return {
        ...prev,
        [messageId]: {
          ...existingReactions,
          [reaction]: [
            ...(existingReactions[reaction] || []),
            {
              user_id: userProfile.user_id,
              user_name: `${userProfile.first_name} ${userProfile.last_name}`
            }
          ].filter((user, index, self) => 
            index === self.findIndex(u => u.user_id === user.user_id)
          )
        }
      };
    });
  };

  // Remove reaction handler
  const handleRemoveReaction = (messageId, reaction) => {
    if (!socket || !socket.connected) return;
    
    // Disable removing reactions for archived courses
    if (isArchived) {
      toast.error('Cannot remove reactions in archived courses - archived courses are view-only');
      return;
    }
    
    // Find the message to check if it's deleted
    const messageIsDeleted = conversations.some(conv => 
      conv.messages?.some(msg => 
        msg.message_id === messageId && msg.is_deleted
      )
    );
    
    // Don't allow removing reactions on deleted messages
    if (messageIsDeleted) {
      toast.error('Cannot remove reactions from deleted messages');
      return;
    }
    
    socket.emit('remove_reaction', {
      message_id: messageId,
      reaction: reaction
    });
    
    // Optimistically update UI
    setMessageReactions(prev => {
      const existingReactions = prev[messageId] || {};
      
      if (!existingReactions[reaction]) return prev;
      
      const updatedReactions = {
        ...existingReactions,
        [reaction]: existingReactions[reaction].filter(
          user => user.user_id !== userProfile.user_id
        )
      };
      
      // Remove empty reaction arrays
      if (updatedReactions[reaction].length === 0) {
        delete updatedReactions[reaction];
      }
      
      return {
        ...prev,
        [messageId]: Object.keys(updatedReactions).length > 0 ? updatedReactions : undefined
      };
    });
  };

  // Add message deletion functionality
  const handleDeleteMessage = async (messageId) => {
    if (!socket || !socket.connected) return;
    
    // Disable deleting messages for archived courses
    if (isArchived) {
      toast.error('Cannot delete messages in archived courses - archived courses are view-only');
      return;
    }
    
    // Find the message to check if it has an attachment
    let messageToDelete = null;
    let conversationId = null;
    
    // Find the message in conversations
    conversations.forEach(conv => {
      if (conv.messages) {
        const foundMessage = conv.messages.find(msg => msg.message_id === messageId);
        if (foundMessage) {
          messageToDelete = foundMessage;
          conversationId = conv.conversation_id;
        }
      }
    });
    
    // Ask for confirmation
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    
    // First, delete the message via socket
    socket.emit('delete_message', { message_id: messageId }, async (response) => {
      if (response && response.success) {
        // Update conversations to mark message as deleted
        setConversations(prev => 
          prev.map(conv => ({
            ...conv,
            messages: conv.messages && conv.messages.map(msg => 
              msg.message_id === messageId 
                ? { ...msg, is_deleted: true, content: "This message was deleted" }
                : msg
            )
          }))
        );
        
        // If the message had an attachment, delete the file too
        if (messageToDelete && messageToDelete.attachment) {
          try {
            const token = localStorage.getItem("token");
            if (!token) return;
            
            // Make API call to delete the file
            const deleteResponse = await fetch("http://localhost:5000/api/uploads/delete-message-file", {
              method: "POST",
              headers: { 
                jwt_token: token,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                message_id: messageId,
                filePath: messageToDelete.attachment.file_path
              })
            });
            
            if (!deleteResponse.ok) {
              console.error("Error deleting file attachment");
            }
          } catch (err) {
            console.error("Error deleting file attachment:", err.message);
          }
        }
      } else {
        toast.error('Failed to delete message');
      }
    });
  };

  // Update the scrollToBottom function to better handle fixed container
  const scrollToBottom = useCallback((behavior = 'auto') => {
    try {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ 
          behavior, 
          block: 'end',
          inline: 'nearest'
        });
      }
      
      if (messagesListRef.current) {
        const messagesList = messagesListRef.current;
        messagesList.scrollTop = messagesList.scrollHeight;
      }
    } catch (error) {
      console.error("Error scrolling to bottom:", error);
    }
  }, []);
  
  // Enhanced scroll behavior for active conversation changes
  useEffect(() => {
    // When changing conversations, always scroll to the latest messages
    if (activeConversation) {
      // Use setTimeout to ensure the DOM has updated with the new conversation's messages
      setTimeout(() => {
        scrollToBottom('auto');
      }, 0);
    }
  }, [activeConversation, scrollToBottom]);
  
  // Improved scrolling when messages change/load
  useEffect(() => {
    const activeConversationData = conversations.find(c => c.conversation_id === activeConversation);
    if (activeConversationData && activeConversationData.messages && activeConversationData.messages.length > 0) {
      // For initial load or when receiving new messages in the active conversation
      scrollToBottom('auto');
    }
  }, [conversations, activeConversation, scrollToBottom]);
  
  // Add scroll event listener to show/hide the scroll button
  useEffect(() => {
    const messagesList = messagesListRef.current;
    if (!messagesList) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = messagesList;
      
      // Get the current conversation's messages
      const activeConversationData = conversations.find(c => c.conversation_id === activeConversation);
      const messageCount = activeConversationData?.messages?.length || 0;
      
      // Only show button when:
      // 1. There are at least 5 messages
      // 2. User has scrolled up significantly (more than 150px from bottom)
      // 3. Not already at the bottom (with a small tolerance of 20px)
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isScrolledUp = distanceFromBottom > 150;
      const isNotAtBottom = distanceFromBottom > 20;
      const hasEnoughMessages = messageCount >= 5;
      
      setShowScrollButton(isScrolledUp && isNotAtBottom && hasEnoughMessages);
    };

    messagesList.addEventListener('scroll', handleScroll);
    
    // Initial check to see if we need to show the button
    handleScroll();
    
    return () => {
      messagesList.removeEventListener('scroll', handleScroll);
    };
  }, [conversations, activeConversation]);

  // Handle emoji selection
  const handleEmojiSelect = (emojiData) => {
    // Prevent emoji selection in archived courses
    if (isArchived) {
      toast.error('Cannot add emojis in archived courses - archived courses are view-only');
      return;
    }
    
    // Get cursor position
    const inputElement = document.querySelector('.message-input');
    const cursorPosition = inputElement?.selectionStart || messageText.length;
    
    // Insert emoji at cursor position
    const newText = messageText.substring(0, cursorPosition) + 
                    emojiData.emoji + 
                    messageText.substring(cursorPosition);
    
    setMessageText(newText);
    
    // Focus input and set cursor after the inserted emoji
    setTimeout(() => {
      if (inputElement) {
        inputElement.focus();
        const newCursorPosition = cursorPosition + emojiData.emoji.length;
        inputElement.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    }, 10);
    
    // DON'T close the emoji picker after selection
    // This allows multiple emoji selection
  };
  
  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Make sure we're not closing when clicking within the emoji picker itself
      const emojiPickerElement = document.querySelector('.emoji-picker-react');
      if (emojiPickerRef.current && 
          !emojiPickerRef.current.contains(event.target) && 
          !(emojiPickerElement && emojiPickerElement.contains(event.target))) {
        setShowEmojiPicker(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Custom styled component for our emoji picker
  const StyledEmojiPicker = () => {
    // Effect to hide both clear and search buttons after render
    useEffect(() => {
      const hideButtons = () => {
        // Target all clear search buttons and search icons
        const elementsToHide = document.querySelectorAll(`
          .epr-btn-clear-search, 
          [class*="epr-btn-clear-search"],
          [class*="epr-icn-search"],
          [class*="epr-icn-clear-search"],
          [class*="epr-visible-on-search-only"]
        `);
        
        elementsToHide.forEach(element => {
          element.style.display = 'none';
          element.style.visibility = 'hidden';
          element.style.opacity = '0';
          element.style.pointerEvents = 'none';
        });
        
        // Also make sure the input doesn't have left padding for an icon
        const searchInput = document.querySelector('.custom-emoji-picker-wrapper input');
        if (searchInput) {
          searchInput.style.paddingLeft = '15px';
        }
      };
      
      // Call immediately and then every 100ms to catch dynamically created elements
      hideButtons();
      const interval = setInterval(hideButtons, 100);
      
      return () => clearInterval(interval);
    }, []);
    
    return (
      <div 
        className="custom-emoji-picker-wrapper"
        style={{
          animation: 'fadeIn 0.2s ease-in-out',
          position: 'absolute',
          bottom: '60px', 
          right: '0px',
          zIndex: 100,
          overflow: 'hidden',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
          background: 'white',
          padding: '8px'
        }}
      >
        <EmojiPicker
          onEmojiClick={handleEmojiSelect}
          searchDisabled={false}
          previewConfig={{ showPreview: false }}
          width={340}
          height={450}
          theme="light"
          skinTonesDisabled
          lazyLoadEmojis
          searchPlaceholder="Search"
          emojiStyle="native"
        />
      </div>
    );
  };

  // Function to detect URLs in text
  const detectAndRenderUrls = (text) => {
    if (!text) return [text];
    
    // URL regex pattern
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+\.[^\s]+)/g;
    
    // Split text by URLs and render links
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      // Get the full URL
      const url = match[0];
      const fullUrl = url.startsWith('www.') ? `https://${url}` : url;
      
      // Add URL as clickable link
      parts.push(
        <span 
          key={match.index} 
          className="message-link"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // No longer tracking position
            setLinkConfirmation({
              show: true,
              url: fullUrl,
              position: null
            });
          }}
        >
          {url}
        </span>
      );
      
      lastIndex = match.index + url.length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length ? parts : [text];
  };

  // Function to handle link confirmation
  const handleOpenLink = () => {
    if (linkConfirmation.url) {
      window.open(linkConfirmation.url, '_blank', 'noopener,noreferrer');
    }
    setLinkConfirmation({ show: false, url: '', position: null });
  };

  // Function to close link confirmation
  const closeLinkConfirmation = () => {
    setLinkConfirmation({ show: false, url: '', position: null });
  };

  // Add message search functions after link confirmation functions
  const handleMessageSearch = () => {
    if (!messageSearchTerm.trim() || !activeConversation) return;
    
    setIsSearchingMessages(true);
    
    // Find the active conversation
    const conversation = conversations.find(c => c.conversation_id === activeConversation);
    if (!conversation || !conversation.messages) {
      setSearchResults([]);
      return;
    }
    
    // Search for messages containing the search term (case insensitive)
    const results = conversation.messages
      .filter(message => 
        message.content.toLowerCase().includes(messageSearchTerm.toLowerCase())
      )
      .map(message => message.message_id);
    
    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
    
    // Scroll to first result if found
    if (results.length > 0) {
      scrollToMessage(results[0]);
    }
  };

  // Navigate search results
  const navigateSearchResults = (direction) => {
    if (searchResults.length === 0) return;
    
    let newIndex;
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      newIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    }
    
    setCurrentSearchIndex(newIndex);
    scrollToMessage(searchResults[newIndex]);
  };

  // Scroll to specific message
  const scrollToMessage = (messageId) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight the message temporarily
      messageElement.classList.add('highlight-message');
      setTimeout(() => {
        messageElement.classList.remove('highlight-message');
      }, 2000);
    }
  };

  // Close message search
  const closeMessageSearch = () => {
    setIsSearchingMessages(false);
    setMessageSearchTerm("");
    setSearchResults([]);
    setCurrentSearchIndex(-1);
  };

  // Function to send a like/thumbs up emoji
  const sendLike = () => {
    if (!activeConversation || !userProfile || !socket) return;
    
    // Disable sending likes for archived courses
    if (isArchived) {
      toast.error('Cannot send likes in archived courses - archived courses are view-only');
      return;
    }
    
    try {
      const tempMessageId = `temp_${Date.now()}`;
      const tempMessage = {
        message_id: tempMessageId,
        conversation_id: activeConversation,
        sender_id: userProfile.user_id,
        sender_name: `${userProfile.first_name} ${userProfile.last_name}`,
        content: "👍", // Thumbs up emoji
        sent_at: new Date().toISOString(),
        is_sending: true
      };
      
      // Optimistically update UI - add message to the bottom, not top
      setConversations(prev => 
        prev.map(conv => 
          conv.conversation_id === activeConversation 
            ? { 
                ...conv, 
                messages: [...(conv.messages || []), tempMessage], // Add to end of array
                // Also update the last_message for sorting
                last_message: "👍",
                updated_at: tempMessage.sent_at
              }
            : conv
        )
      );
      
      // Scroll to bottom after sending
      setTimeout(() => scrollToBottom('smooth'), 100);
      
      // Check if conversation ID is numeric (real) or string (mock)
      const isNumericId = !isNaN(parseInt(activeConversation));
      
      // Try to send via WebSocket if it's a real conversation ID
      if (socket && socket.connected && isNumericId) {
        socket.emit('send_private_message', {
          conversation_id: activeConversation,
          content: "👍"
        }, (acknowledgement) => {
          if (acknowledgement && acknowledgement.error) {
            console.error("Socket error:", acknowledgement.error);
            toast.error('Failed to send message');
            
            // Update message status to failed
            setConversations(prev => 
              prev.map(conv => 
                conv.conversation_id === activeConversation 
                  ? { 
              ...conv,
              messages: conv.messages.map(msg => 
                        msg.message_id === tempMessageId 
                          ? { ...msg, is_sending: false, failed: true }
                          : msg
                      )
                    }
                  : conv
              )
            );
          } else if (acknowledgement && acknowledgement.success && acknowledgement.message) {
            // Replace temp message with real message from server
            setConversations(prev => 
              prev.map(conv => 
                conv.conversation_id === activeConversation 
                  ? { 
                      ...conv, 
                      messages: conv.messages.map(msg => 
                        msg.message_id === tempMessageId 
                          ? { ...acknowledgement.message, is_sending: false }
                  : msg
              )
                    }
                  : conv
              )
            );
          }
        });
      } else {
        // For mock conversations, simulate sending
        setTimeout(() => {
          setConversations(prev => 
            prev.map(conv => 
              conv.conversation_id === activeConversation 
                ? { 
                    ...conv, 
                    messages: conv.messages.map(msg => 
                      msg.message_id === tempMessageId ? { ...msg, is_sending: false } : msg
                    )
                  }
                : conv
            )
          );
        }, 500);
      }
    } catch (err) {
      console.error("Error sending like:", err.message);
      toast.error('Failed to send like');
    }
  };

  // Handle file attachment
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setFileAttachment(null);
      setFilePreview(null);
      return;
    }

    // Disable file attachments for archived courses
    if (isArchived) {
      toast.error('Cannot attach files in archived courses - archived courses are view-only');
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    console.log(`File selected: ${file.name}, size: ${file.size}, type: ${file.type}`);
    
    // Check if file is too large (e.g., over 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum file size is 10MB.');
      return;
    }
    
    setFileAttachment(file);
    
    // Create a preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target.result);
        console.log('Image preview created');
      };
      reader.readAsDataURL(file);
    } else {
      // For non-image files, just show the file name as preview
      setFilePreview(null);
    }
  };

  // Handle removing file attachment
  const removeAttachment = () => {
    setFileAttachment(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Replace the main loading state when the component is loading
  if (loading) {
    return (
      <div className="dashboard-container dashboard-page">
        <LoadingIndicator text="Loading Messages" />
      </div>
    );
  }

  return (
    <div className="dashboard-container dashboard-page">
      {/* Remove the style tag and its content since it's now in PrivateMessages.css */}
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
        onLogout={(e) => {
          e.preventDefault();
          localStorage.removeItem('token');
          if (setAuth) setAuth(false);
          toast.success('Logged out successfully!');
          navigate('/login');
        }}
        activePath={location.pathname}
      />
      
      <div className={`main-content ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="content-wrapper">
          {isMobile && (
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <HiOutlineX /> : <HiOutlineMenu />}
            </button>
          )}

          <div className="top-bar">
            <div className="top-bar-right">
              <div className="user-profile">
                <div className="user-info">
                  <div className="user-name">{first_name} {last_name || ''}</div>
                  <div className="user-role">{userRole || 'Loading...'}</div>
                </div>
                {inputs.profilePicture ? (
                  <div className="avatar" onClick={() => navigate("/settings")} style={{ cursor: 'pointer' }}>
                    <img src={inputs.profilePicture} alt="Profile" />
                  </div>
                ) : (
                  <div className="avatar" onClick={() => navigate("/settings")} style={{ cursor: 'pointer' }}>
                    {first_name && last_name ? `${first_name[0]}${last_name[0]}` : "?"}
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

            <div className="messages-container">
              <div className="messages-content">
                {/* Message view - now takes full width */}
                <div className="messages-view full-width">
                  {activeConversation ? (
                    <>
                      <div className="active-conversation-header">
                        {conversations.find(c => c.conversation_id === activeConversation)?.conversation_type === 'group' ? (
                          <div className="conversation-avatar group">
                            {conversations.find(c => c.conversation_id === activeConversation)?.profile_picture_url ? (
                              <img 
                                src={conversations.find(c => c.conversation_id === activeConversation).profile_picture_url.startsWith('http')
                                  ? conversations.find(c => c.conversation_id === activeConversation).profile_picture_url
                                  : `http://localhost:5000${conversations.find(c => c.conversation_id === activeConversation).profile_picture_url}`} 
                                alt="Group" 
                                className="group-avatar-image"
                              />
                            ) : (
                              <HiOutlineUserGroup className="group-icon" />
                            )}
                          </div>
                        ) : (
                          <div className="conversation-avatar">
                            {conversations.find(c => c.conversation_id === activeConversation)?.participants?.find(p => p.user_id !== userProfile?.user_id)?.profile_picture_url ? (
                              <img 
                                src={conversations.find(c => c.conversation_id === activeConversation).participants.find(p => p.user_id !== userProfile?.user_id).profile_picture_url.startsWith('http')
                                  ? conversations.find(c => c.conversation_id === activeConversation).participants.find(p => p.user_id !== userProfile?.user_id).profile_picture_url
                                  : `http://localhost:5000${conversations.find(c => c.conversation_id === activeConversation).participants.find(p => p.user_id !== userProfile?.user_id).profile_picture_url}`} 
                                alt="Profile" 
                              />
                            ) : (
                              <HiOutlineUserCircle className="user-icon" />
                            )}
                          </div>
                        )}
                        <div className="conversation-info">
                          <div className="conversation-name">
                            {conversations.find(c => c.conversation_id === activeConversation)?.conversation_type === 'group' 
                              ? conversations.find(c => c.conversation_id === activeConversation)?.name 
                              : conversations.find(c => c.conversation_id === activeConversation)?.participants?.find(p => p.user_id !== userProfile?.user_id)
                                ? `${conversations.find(c => c.conversation_id === activeConversation).participants.find(p => p.user_id !== userProfile?.user_id).first_name} ${conversations.find(c => c.conversation_id === activeConversation).participants.find(p => p.user_id !== userProfile?.user_id).last_name}`
                                : userProfile ? `${userProfile.first_name} ${userProfile.last_name} (You)` : 'Chat'
                            }
                          </div>
                          <div className="conversation-participants">
                            {conversations.find(c => c.conversation_id === activeConversation)?.conversation_type === 'group' && 
                              conversations.find(c => c.conversation_id === activeConversation)?.participants && 
                              `${conversations.find(c => c.conversation_id === activeConversation).participants.length} participants`
                            }
                          </div>
                        </div>
                        {/* Add search button */}
                        <button 
                          className="search-messages-button"
                          onClick={() => setIsSearchingMessages(!isSearchingMessages)}
                          aria-label="Search messages"
                        >
                          <HiOutlineSearch />
                        </button>
                        {/* Add settings button for group chats */}
                        {conversations.find(c => c.conversation_id === activeConversation)?.conversation_type === 'group' && (
                          <button 
                            className="conversation-settings-button"
                            onClick={() => {
                              const currentConversation = conversations.find(c => c.conversation_id === activeConversation);
                              setNewChatName(currentConversation?.name || '');
                              setShowChatSettings(true);
                            }}
                          >
                            <HiOutlineDotsVertical className="settings-icon" />
                          </button>
                        )}
                      </div>
                      
                      {/* Message search bar */}
                      {isSearchingMessages && (
                        <div className="message-search-container">
                          <div className="message-search-input-wrapper">
                            <HiOutlineSearch className="search-icon" />
                            <input
                              type="text"
                              className="message-search-input"
                              placeholder="Search in conversation..."
                              value={messageSearchTerm}
                              onChange={(e) => setMessageSearchTerm(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handleMessageSearch()}
                              autoFocus
                            />
                            {messageSearchTerm && (
                              <button 
                                className="clear-search-button"
                                onClick={() => setMessageSearchTerm('')}
                                aria-label="Clear search"
                              >
                                <HiOutlineX />
                              </button>
                            )}
                          </div>
                          <button 
                            className="search-button"
                            onClick={handleMessageSearch}
                            disabled={!messageSearchTerm.trim()}
                          >
                            Search
                          </button>
                          <button 
                            className="close-search-button"
                            onClick={closeMessageSearch}
                            aria-label="Close search"
                          >
                            <HiOutlineX />
                          </button>
                          
                          {searchResults.length > 0 && (
                            <div className="search-results-navigation">
                              <button 
                                className="nav-button"
                                onClick={() => navigateSearchResults('prev')}
                                aria-label="Previous result"
                              >
                                ↑
                              </button>
                              <span className="results-count">
                                {currentSearchIndex + 1} of {searchResults.length}
                              </span>
                              <button 
                                className="nav-button"
                                onClick={() => navigateSearchResults('next')}
                                aria-label="Next result"
                              >
                                ↓
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="messages-list" ref={messagesListRef}>
                        {/* Scroll to bottom button */}
                        {showScrollButton && (
                          <button 
                            className="scroll-to-bottom-button"
                            onClick={() => scrollToBottom('smooth')}
                            aria-label="Scroll to latest messages"
                          >
                            <svg 
                              xmlns="http://www.w3.org/2000/svg" 
                              viewBox="0 0 384 512" 
                              fill="white"
                              className="scroll-arrow-svg"
                            >
                              <path d="M169.4 470.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 370.8 224 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 306.7L54.6 265.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"/>
                            </svg>
                          </button>
                        )}
                        
                        {(conversations.find(c => c.conversation_id === activeConversation)?.isLoading || loadingMessages) ? (
                          <div className="loading-messages">
                            <LoadingIndicator text="Loading messages" />
                          </div>
                        ) : conversations.find(c => c.conversation_id === activeConversation)?.messages && 
                           conversations.find(c => c.conversation_id === activeConversation).messages.length > 0 ? (
                          <>
                            {/* Date separator for grouping messages by date */}
                            {conversations.find(c => c.conversation_id === activeConversation).messages
                              .reduce((acc, message, index, array) => {
                                if (!message.sent_at) {
                                  // Skip messages without timestamps
                                  return acc;
                                }
                                
                                const messageDate = new Date(message.sent_at).toLocaleDateString();
                                if (index === 0 || messageDate !== new Date(array[index - 1].sent_at || new Date()).toLocaleDateString()) {
                                  acc.push(
                                    <div key={`date-${message.message_id || index}`} className="date-separator">
                                      <span>{messageDate === new Date().toLocaleDateString() ? 'Today' : messageDate}</span>
                                    </div>
                                  );
                                }
                                
                                // Add message after its date separator
                                acc.push(
                                  <div 
                                    id={`message-${message.message_id || `msg-${index}`}`}
                                    key={message.message_id || `msg-${index}`} 
                                    className={`message-item ${message.sender_id === userProfile?.user_id ? 'sent' : 'received'} ${searchResults.includes(message.message_id) ? 'search-result' : ''} ${searchResults[currentSearchIndex] === message.message_id ? 'current-search-result' : ''}`}
                                  >
                                    {message.sender_id !== userProfile?.user_id && (
                                      <div className="message-avatar">
                                        {message.profile_picture_url ? (
                                          <img src={message.profile_picture_url} alt="Profile" />
                                        ) : (
                                          <HiOutlineUserCircle className="user-icon" />
                                        )}
                                      </div>
                                    )}
                                    <div className="message-content">
                                      {message.sender_id !== userProfile?.user_id && (
                                        <div className="message-sender">{message.sender_name || 'Unknown User'}</div>
                                      )}
                                      <div className="message-bubble">
                                        {/* Add file attachment rendering */}
                                        {message.attachment && !message.is_deleted && (
                                          <div className="message-attachment">
                                            {message.attachment.is_image ? (
                                              <div className="image-attachment">
                                                <img 
                                                  src={message.attachment.file_url || 
                                                       message.attachment.preview_url || 
                                                       (message.attachment.file_path ? 
                                                           `${window.location.origin}${message.attachment.file_path}` : 
                                                           null
                                                       )} 
                                                  alt={message.attachment.file_name}
                                                  onClick={() => window.open(
                                                      message.attachment.file_url || 
                                                      `${window.location.origin}${message.attachment.file_path}`, 
                                                      '_blank'
                                                  )}
                                                  key={`img-${message.message_id}`}
                                                  onError={(e) => {
                                                    console.error("Image failed to load:", e);
                                                    e.target.src = '/placeholder-image.png';
                                                  }}
                                                />
                                              </div>
                                            ) : (
                                              <div className="file-attachment" onClick={() => window.open(message.attachment.file_url || `${window.location.origin}${message.attachment.file_path}`, '_blank')}>
                                                <div className="file-icon">📎</div>
                                                <div className="file-details">
                                                  <div className="file-name">{message.attachment.file_name}</div>
                                                  <div className="file-size">{(message.attachment.file_size / 1024).toFixed(1)} KB</div>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        <div className="message-text">
                                          {message.is_deleted ? (
                                            <span className="deleted-message-text">This message was deleted</span>
                                          ) : (
                                            message.content.split('\n').map((line, i) => (
                                              <React.Fragment key={i}>
                                                {detectAndRenderUrls(line)}
                                                {i < message.content.split('\n').length - 1 && <br />}
                                              </React.Fragment>
                                            ))
                                          )}
                                        </div>
                                        <div className="message-time">
                                          {message.sent_at ? formatTimestamp(message.sent_at) : 'Now'}
                                          {message.is_sending && <span className="sending-indicator"> • Sending...</span>}
                                        </div>

                                        {/* Message actions - Emoji reaction buttons */}
                                        {!message.is_deleted && (
                                          <div className="message-actions">
                                            {/* Emoji reaction buttons */}
                                            {!isArchived && commonReactions.map(emoji => (
                                              <button 
                                                key={emoji} 
                                                className="message-action-button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleAddReaction(message.message_id, emoji);
                                                }}
                                                aria-label={`React with ${emoji}`}
                                              >
                                                {emoji}
                                              </button>
                                            ))}
                                            
                                            {/* Delete button - only for user's own messages */}
                                            {message.sender_id === userProfile?.user_id && !isArchived && !message.is_deleted && (
                                              <button 
                                                className="message-action-button delete"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteMessage(message.message_id);
                                                }}
                                                aria-label="Delete message"
                                              >
                                                <HiOutlineX />
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      
                                      {/* Display reactions */}
                                      {!message.is_deleted && messageReactions[message.message_id] && Object.keys(messageReactions[message.message_id]).length > 0 && (
                                        <div className="message-reactions">
                                          {Object.entries(messageReactions[message.message_id]).map(([reaction, users]) => {
                                            const userReacted = users.some(user => user.user_id === userProfile?.user_id);
                                            return (
                                              <button 
                                                key={reaction} 
                                                className={`reaction-badge ${userReacted ? 'user-reacted' : ''} ${isArchived ? 'disabled' : ''}`}
                                                onClick={() => !isArchived && (userReacted 
                                                  ? handleRemoveReaction(message.message_id, reaction)
                                                  : handleAddReaction(message.message_id, reaction)
                                                )}
                                                disabled={isArchived}
                                                title={isArchived ? 'Reactions disabled in archived courses' : users.map(u => u.user_name).join(', ')}
                                                style={isArchived ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                                              >
                                                {reaction} <span className="reaction-count">{users.length}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                                
                                return acc;
                              }, [])}
                              <div ref={messagesEndRef} />
                          </>
                        ) : (
                          <div className="no-messages">
                            <p>No messages yet. Start the conversation!</p>
                          </div>
                        )}
                        
                        {/* Typing indicators */}
                        {typingUsers[activeConversation] && Object.keys(typingUsers[activeConversation] || {}).length > 0 && (
                          <div className="typing-indicator">
                            {Object.values(typingUsers[activeConversation]).join(', ')} {Object.values(typingUsers[activeConversation]).length === 1 ? 'is' : 'are'} typing...
                          </div>
                        )}
                      </div>
                      
                      <div className="message-input-wrapper">
                        {/* Show archived course notification */}
                        {isArchived && (
                          <div className="archived-course-notification">
                            <div className="archived-message">
                              📁 This course has been archived. You can view messages but cannot send new ones or interact with content.
                            </div>
                          </div>
                        )}
                        
                        {/* Scroll to bottom button - positioned directly above input */}
                        {showScrollButton && (
                          <button 
                            className="scroll-to-bottom-button"
                            onClick={() => scrollToBottom('smooth')}
                            aria-label="Scroll to latest messages"
                          >
                            <svg 
                              xmlns="http://www.w3.org/2000/svg" 
                              viewBox="0 0 384 512" 
                              fill="white"
                              className="scroll-arrow-svg"
                            >
                              <path d="M169.4 470.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 370.8 224 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 306.7L54.6 265.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"/>
                            </svg>
                          </button>
                        )}

                        {/* Updated Facebook Messenger-style message input container */}
                        <div className="message-input-container">
                          {/* File attachment button */}
                          <div className="message-input-actions left">
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              style={{ display: 'none' }}
                              id="file-input"
                            />
                            <button 
                              className="attachment-button"
                              onClick={() => !isArchived && fileInputRef.current.click()}
                              title={isArchived ? "File attachments disabled in archived courses" : "Attach file"}
                              disabled={isArchived}
                              style={isArchived ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                            >
                              <HiOutlinePhotograph className="attachment-icon" />
                            </button>
                          </div>

                          {/* File preview if attachment exists */}
                          {fileAttachment && (
                            <div className="file-preview">
                              {filePreview ? (
                                <div className="image-preview">
                                  <img src={filePreview} alt="Preview" />
                                  <button className="remove-attachment" onClick={removeAttachment}>
                                    <HiOutlineX />
                                  </button>
                                </div>
                              ) : (
                                <div className="file-name-preview">
                                  <span>📎 {fileAttachment.name}</span>
                                  <button className="remove-attachment" onClick={removeAttachment}>
                                    <HiOutlineX />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          <input 
                            type="text" 
                            className="message-input" 
                            placeholder={isArchived ? "Messaging disabled in archived courses" : "Type a message..."} 
                            value={messageText}
                            onChange={handleMessageInput}
                            onKeyPress={(e) => e.key === 'Enter' && !isArchived && handleSendMessage()}
                            disabled={isArchived}
                            style={isArchived ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                          />

                          {/* Always show emoji picker button regardless of message text */}
                          <div className="message-input-actions right">
                            <div className="emoji-picker-container" ref={emojiPickerRef} style={{ position: 'relative' }}>
                              <button 
                                className="emoji-button hover-effect"
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                title="Add emoji"
                                aria-label="Add emoji"
                                aria-expanded={showEmojiPicker}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '1.5rem',
                                  padding: '8px',
                                  color: '#3f3f3f',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginRight: '4px',
                                  borderRadius: '50%',
                                  transition: 'background-color 0.2s',
                                  ...(showEmojiPicker ? { backgroundColor: '#e8f5fe' } : {})
                                }}
                              >
                                <HiOutlineEmojiHappy className="emoji-icon" style={{ fontSize: '1.4rem' }} />
                              </button>
                              {showEmojiPicker && <StyledEmojiPicker />}
                            </div>
                          </div>

                          {/* Show like button when no text and no attachment, else show send button */}
                          {messageText.trim() === '' && !fileAttachment ? (
                            <button 
                              className="like-button"
                              onClick={sendLike}
                              title="Send a like"
                              aria-label="Send a like"
                            >
                              👍
                            </button>
                          ) : (
                            <button 
                              className={`send-button ${messageText.trim() || fileAttachment ? 'has-content' : ''}`}
                              onClick={handleSendMessage}
                              style={{
                                backgroundColor: "#000000", 
                                color: "#ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "8px",
                                borderRadius: "50%",
                                width: "36px",
                                height: "36px"
                              }}
                            >
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                viewBox="0 0 512 512" 
                                fill="white"
                                width="20"
                                height="20"
                                style={{ display: "block" }}
                              >
                                <path d="M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 1.6L284 427.7l-68.5 74.1c-8.9 9.7-22.9 12.9-35.2 8.1S160 493.2 160 480l0-83.6c0-4 1.5-7.8 4.2-10.8L331.8 202.8c5.8-6.3 5.6-16-.4-22s-15.7-6.4-22-.7L106 360.8 17.7 316.6C7.1 311.3 .3 300.7 0 288.9s5.9-22.8 16.1-28.7l448-256c10.7-6.1 23.9-5.5 34 1.4z"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="no-active-conversation">
                      <div className="empty-state">
                        <HiOutlineChatAlt2 className="icon" />
                        <h3>Select a conversation</h3>
                        <p>Choose an existing conversation or start a new one</p>
                        <button 
                          className="new-conversation-button"
                          onClick={() => !isArchived && setNewConversationModal(true)}
                          disabled={isArchived}
                          style={isArchived ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                          title={isArchived ? "New conversations disabled in archived courses" : "Start new chat"}
                        >
                          <HiOutlinePlusCircle className="nav-icon" />
                          <span>{isArchived ? "Chat Disabled (Archived)" : "New Chat"}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* New conversation modal */}
        {newConversationModal && (
          <div className="modal-overlay messages-modal-overlay" onClick={() => setNewConversationModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>New Conversation</h2>
                <button className="close-button" onClick={() => setNewConversationModal(false)}>
                  <HiOutlineX className="nav-icon" />
                </button>
              </div>
              <div className="modal-body">
                <div className="search-container">
                  <HiOutlineSearch className="search-icon" />
                  <input 
                    type="text" 
                    className="search-input" 
                    placeholder="Search for people..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="users-list">
                  {/* Group chat option */}
                  {courseId && (
                    <div 
                      className={`user-item group-chat-option ${isArchived ? 'disabled' : ''}`}
                      onClick={() => {
                        if (isArchived) {
                          toast.error('Cannot create group chats in archived courses - archived courses are view-only');
                          return;
                        }
                        
                        // Don't do anything if already creating a course chat
                        if (isCreatingCourseChat) {
                          toast.loading('Creating course chat...');
                          setNewConversationModal(false);
                          return;
                        }
                        
                        // First, print information about all conversations for debugging
                        console.log("New Chat Modal - Current conversations:", conversations.map(c => ({
                          id: c.conversation_id,
                          type: c.conversation_type,
                          course_id: c.course_id !== undefined && c.course_id !== null ? `${c.course_id} (${typeof c.course_id})` : 'none'
                        })));
                        
                        // Check with proper string comparison if course chat exists in state
                        const courseIdStr = String(courseId);
                        console.log(`Checking for course ${courseIdStr} among conversations`);
                        
                        const existingCourseChat = conversations.find(c => {
                          if (c.conversation_type !== 'group') return false;
                          if (c.course_id === null || c.course_id === undefined) return false;
                          
                          const convCourseIdStr = String(c.course_id);
                          const isMatch = convCourseIdStr === courseIdStr;
                          console.log(`Comparing: ${convCourseIdStr} === ${courseIdStr}: ${isMatch}`);
                          return isMatch;
                        });
                        
                        if (existingCourseChat) {
                          // Use existing course chat for this course
                          console.log(`Using existing course chat from state: ${existingCourseChat.conversation_id}`);
                          setActiveConversation(existingCourseChat.conversation_id);
                          setNewConversationModal(false);
                          return;
                        }
                        
                        // Create loading toast before trying to create chat
                        const loadingToast = toast.loading('Creating course chat...');
                        
                        // If no chat exists in state, check on server before creating
                        setIsCreatingCourseChat(true);
                        const token = localStorage.getItem("token");
                        
                        if (!token) {
                          toast.dismiss(loadingToast);
                          toast.error('Authentication required');
                          setIsCreatingCourseChat(false);
                          setNewConversationModal(false);
                          return;
                        }
                        
                        // Use a flag to track if we'll need to create a new chat
                        let needToCreateChat = true;
                        
                        fetch(`http://localhost:5000/api/messages/conversations`, {
                          method: "GET",
                          headers: { jwt_token: token }
                        })
                        .then(response => {
                          if (response.ok) {
                            return response.json();
                          }
                          throw new Error('Failed to fetch conversations');
                        })
                        .then(data => {
                          // Look specifically for a chat for this course with proper string comparison
                          const remoteCourseChat = data.find(
                            c => c.conversation_type === 'group' && String(c.course_id) === courseIdStr
                          );
                          
                          if (remoteCourseChat) {
                            console.log(`Using existing course chat from server: ${remoteCourseChat.conversation_id}`);
                            // Use the existing course chat from server for this specific course
                            setConversations(prev => {
                              if (!prev.some(c => c.conversation_id === remoteCourseChat.conversation_id)) {
                                return [remoteCourseChat, ...prev];
                              }
                              return prev;
                            });
                            setActiveConversation(remoteCourseChat.conversation_id);
                            toast.dismiss(loadingToast);
                            toast.success('Course chat loaded');
                            setNewConversationModal(false);
                            
                            // Don't need to create a chat anymore
                            needToCreateChat = false;
                          }
                        })
                        .catch(err => {
                          console.error("Error checking for course chat:", err);
                        })
                        .finally(() => {
                          // If we still need to create a chat (didn't find one on server)
                          if (needToCreateChat) {
                            console.log(`No existing chat found, creating new chat for course ${courseIdStr}`);
                            toast.dismiss(loadingToast);
                            createCourseGroupChat();
                          }
                          setNewConversationModal(false);
                          setIsCreatingCourseChat(false);
                        });
                      }}
                    >
                      <div className="user-avatar group-avatar">
                        <HiOutlineUserGroup className="group-icon" />
                      </div>
                      <div className="user-info">
                        <div className="user-name">
                          {courseDetails?.name ? `${courseDetails.name} Chat` : 'Course Group Chat'}
                          {isArchived && ' (Archived)'}
                        </div>
                        <div className="user-role">
                          {isArchived ? 'Archived course - chat disabled' : 'All course members'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* List of users for private chats */}
                  {courseStudents
                    .filter(student => 
                      student.user_id !== userProfile?.user_id && 
                      (student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      student.last_name.toLowerCase().includes(searchTerm.toLowerCase()))
                    )
                    .map(student => (
                      <div 
                        key={student.user_id} 
                        className={`user-item ${isArchived ? 'disabled' : ''}`}
                        onClick={() => {
                          if (isArchived) {
                            toast.error('Cannot create private chats in archived courses - archived courses are view-only');
                            return;
                          }
                          startNewConversation(student);
                        }}
                        style={isArchived ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                      >
                        <div className="user-avatar">
                          {student.profile_picture_url ? (
                            <img src={student.profile_picture_url} alt="Profile" />
                          ) : (
                            <HiOutlineUserCircle className="user-icon" />
                          )}
                        </div>
                        <div className="user-info">
                          <div className="user-name">{student.first_name} {student.last_name}</div>
                          <div className="user-role">{student.role === 'professor' ? 'Professor' : 'Student'}</div>
                        </div>
                      </div>
                    ))
                  }
                  
                  {/* Empty state if no results */}
                  {courseStudents.filter(student => 
                    student.user_id !== userProfile?.user_id && 
                    (student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    student.last_name.toLowerCase().includes(searchTerm.toLowerCase()))
                  ).length === 0 && (
                    <div className="no-users-found">
                      <p>No users found matching "{searchTerm}"</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat settings modal */}
        {showChatSettings && (
          <div className="modal-overlay messages-modal-overlay" onClick={() => setShowChatSettings(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Chat Settings</h2>
                <button className="close-button" onClick={() => setShowChatSettings(false)}>
                  <HiOutlineX className="nav-icon" />
                </button>
              </div>
              <div className="modal-body">
                <div className="settings-section">
                  <h3>Chat Name</h3>
                  <div className="chat-name-input">
                    <input 
                      type="text" 
                      value={newChatName}
                      onChange={(e) => setNewChatName(e.target.value)}
                      placeholder="Enter chat name"
                      disabled={isArchived}
                      style={isArchived ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                    />
                    <button 
                      className="update-name-button"
                      onClick={updateChatName}
                      disabled={!newChatName.trim() || isArchived}
                      style={isArchived ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                      title={isArchived ? "Chat settings disabled in archived courses" : "Update chat name"}
                    >
                      <HiOutlinePencil className="icon" />
                      <span>Update</span>
                    </button>
                  </div>
                  {isArchived && (
                    <div style={{ 
                      marginTop: '8px', 
                      fontSize: '12px', 
                      color: '#666', 
                      fontStyle: 'italic' 
                    }}>
                      Chat settings are disabled in archived courses
                    </div>
                  )}
                </div>
                
                <div className="settings-section">
                  <h3>Chat Image</h3>
                  <div className="chat-image-preview">
                    {conversations.find(c => c.conversation_id === activeConversation)?.profile_picture_url ? (
                      <img 
                        src={conversations.find(c => c.conversation_id === activeConversation).profile_picture_url.startsWith('http')
                          ? conversations.find(c => c.conversation_id === activeConversation).profile_picture_url
                          : `http://localhost:5000${conversations.find(c => c.conversation_id === activeConversation).profile_picture_url}`} 
                        alt="Chat" 
                        className="chat-image"
                      />
                    ) : (
                      <div className="no-image">
                        <HiOutlineUserGroup className="icon" />
                      </div>
                    )}
                  </div>
                  <div className="chat-image-upload">
                    <label className={`image-upload-button ${isArchived ? 'disabled' : ''}`}>
                      <HiOutlinePhotograph className="icon" />
                      <span>{isArchived ? 'Upload Disabled' : 'Upload Image'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }}
                        onChange={updateChatImage}
                        disabled={isArchived}
                      />
                    </label>
                  </div>
                </div>
                
                <div className="settings-section">
                  <h3>Participants ({conversations.find(c => c.conversation_id === activeConversation)
                    ?.participants
                    ?.filter(participant => 
                      participant.role === 'professor' || 
                      courseStudents.some(student => student.user_id === participant.user_id)
                    ).length || 0})</h3>
                  <div className="participants-list">
                    {conversations.find(c => c.conversation_id === activeConversation)?.participants
                      ?.filter(participant => {
                        // Always include professors
                        if (participant.role === 'professor') return true;
                        // For students, only include if they are in courseStudents (enrolled in the course)
                        return courseStudents.some(student => student.user_id === participant.user_id);
                      })
                      .map(participant => (
                        <div key={participant.user_id} className="participant-item">
                          <div className="participant-avatar">
                            {participant.profile_picture_url ? (
                              <img src={participant.profile_picture_url} alt="Profile" />
                            ) : (
                              <HiOutlineUserCircle className="user-icon" />
                            )}
                          </div>
                          <div className="participant-info">
                            <div className="participant-name">{participant.first_name} {participant.last_name}</div>
                            {participant.role && (
                              <div className="participant-role">{participant.role === 'professor' ? 'Professor' : 'Student'}</div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Add link confirmation popup */}
      {linkConfirmation.show && (
        <div className="link-confirmation-overlay" onClick={closeLinkConfirmation}>
          <div 
            className="link-confirmation-popup"
            onClick={(e) => e.stopPropagation()} 
          >
            <div className="link-confirmation-header">
              <h3>External Link</h3>
              <button className="close-button" onClick={closeLinkConfirmation}>
                <HiOutlineX />
              </button>
            </div>
            <div className="link-confirmation-content">
              <p>Do you want to open this link?</p>
              <div className="link-url">{linkConfirmation.url}</div>
            </div>
            <div className="link-confirmation-footer">
              <button className="cancel-button" onClick={closeLinkConfirmation}>Cancel</button>
              <button className="proceed-button" onClick={handleOpenLink}>Proceed</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages; 