import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link, useLocation, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import EmojiPicker from 'emoji-picker-react';
import { 
  HiOutlineSearch,
  HiOutlinePaperAirplane,
  HiOutlineUserCircle,
  HiOutlinePlusCircle,
  HiOutlineX,
  HiOutlineDotsVertical,
  HiOutlinePhotograph,
  HiOutlinePencil,
  HiOutlineMenu,
  HiOutlineHome,
  HiOutlineChatAlt2,
  HiOutlineUserGroup,
  HiOutlineShare,
  HiOutlineEmojiHappy,
  HiOutlineThumbUp
} from "react-icons/hi";
import { io } from 'socket.io-client';
import './Messages.css'; // We can reuse the same CSS
import './PrivateMessages.css'; // Import the new CSS file
import Sidebar from '../Sidebar';
import LoadingIndicator from '../common/LoadingIndicator';

const PrivateMessages = ({ setAuth }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useParams(); // Add useParams to get userId from URL
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // Message state
  const [activeConversation, setActiveConversationState] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [conversations, setConversations] = useState([]);
  const [newConversationModal, setNewConversationModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Chat settings state
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [newChatImage, setNewChatImage] = useState(null);

  // Socket state
  const [socket, setSocket] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [typingTimeout, setTypingTimeout] = useState(null);

  // Add unread messages tracking
  const [unreadMessages, setUnreadMessages] = useState({});

  // Add sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Try to get the sidebar state from localStorage
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState === "true";
  });

  // Fetch user role and courses
  const [userRole, setUserRole] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Add message reactions state
  const [messageReactions, setMessageReactions] = useState({});
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  
  // Common emoji reactions
  const commonReactions = ['👍', '❤️', '😂', '😮', '😢', '👏'];

  // File attachment and emoji state
  const [fileAttachment, setFileAttachment] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // Add debugging for unread messages
  useEffect(() => {
    console.log("Current unread messages state:", unreadMessages);
  }, [unreadMessages]);

  // Add a ref for the messages list container and state for scroll button
  const messagesEndRef = React.useRef(null);
  const messagesListRef = React.useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Add a function to scroll to the bottom of messages
  const scrollToBottom = (behavior = 'auto') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  // Scroll to bottom when messages change or active conversation changes
  useEffect(() => {
    scrollToBottom();
  }, [activeConversation]);

  // Scroll to bottom when new messages are added to the active conversation
  useEffect(() => {
    const activeConversationData = conversations.find(c => c.conversation_id === activeConversation);
    if (activeConversationData && activeConversationData.messages && activeConversationData.messages.length > 0) {
      scrollToBottom();
    }
  }, [conversations, activeConversation]);

  // Modify the scroll event listener with improved logic
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

  // Make the button more visible by adding a debug flag and improving its rendering
  // Add a debug flag to force show the button during development
  const [forceShowButton, setForceShowButton] = useState(false);

  // Add a debug button to toggle visibility (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const handleKeyDown = (e) => {
        if (e.key === 'b' && e.ctrlKey) {
          setForceShowButton(prev => !prev);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, []);

  // Fetch user profile
  const getProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;

      const res = await fetch("http://localhost:5000/dashboard/", {
        method: "GET",
        headers: { jwt_token: token }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch profile');
      }
      
      const parseData = await res.json();
      setUserProfile({
        user_id: parseData.user_id || parseData.id,
        first_name: parseData.first_name,
        last_name: parseData.last_name,
        role: parseData.role,
        profile_picture_url: parseData.profile_picture_url || null
      });
      
      return parseData;
    } catch (err) {
      console.error("Error fetching profile:", err.message);
      return null;
    }
  }, []);

  // Fetch all users
  const fetchAllUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch("http://localhost:5000/api/messages/users", {
        method: "GET",
        headers: { jwt_token: token }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      // Filter out the current user
      setAllUsers(data.filter(user => user.user_id !== userProfile?.user_id));
    } catch (err) {
      console.error("Error fetching users:", err.message);
      toast.error('Failed to load users list');
    }
  }, [userProfile]);

  // Fetch user conversations
  const fetchUserConversations = useCallback(async () => {
    if (!userProfile) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch("http://localhost:5000/api/messages/private-conversations", {
        method: "GET",
        headers: { jwt_token: token }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const data = await response.json();
      
      // Sort conversations by last message time
      const sortedConversations = data.sort((a, b) => {
        const aTime = a.last_message_time ? new Date(a.last_message_time) : new Date(0);
        const bTime = b.last_message_time ? new Date(b.last_message_time) : new Date(0);
        return bTime - aTime;
      });
      
      setConversations(sortedConversations);
      
      // Initialize unread messages state
      const initialUnreadState = {};
      sortedConversations.forEach(conv => {
        // Check if conversation has unread flag from API
        initialUnreadState[conv.conversation_id] = conv.unread_messages || false;
      });
      
      console.log("Setting initial unread state:", initialUnreadState);
      setUnreadMessages(initialUnreadState);
      
      // Set active conversation if none is selected
      if (sortedConversations.length > 0 && !activeConversation) {
        setActiveConversation(sortedConversations[0].conversation_id);
      }
    } catch (err) {
      console.error("Error fetching conversations:", err.message);
      toast.error('Failed to load conversations');
    }
  }, [userProfile]);

  // Fetch message reactions for the active conversation
  const fetchMessageReactions = useCallback(async () => {
    if (!activeConversation || !userProfile) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

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

  // Initialize socket connection
  useEffect(() => {
    if (!userProfile) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    const newSocket = io('http://localhost:5000', {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      // Emit user online status
      newSocket.emit('user_online', { user_id: userProfile.user_id });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    newSocket.on('online_users', (users) => {
      setOnlineUsers(new Set(users));
    });

    newSocket.on('user_online', (user) => {
      setOnlineUsers(prev => new Set([...prev, user.user_id]));
    });

    newSocket.on('user_offline', (user) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(user.user_id);
        return newSet;
      });
    });

    newSocket.on('new_message', (message) => {
      console.log('Received new message:', message);
      
      // Check if user is near the bottom before the message arrives
      const messagesList = messagesListRef.current;
      let shouldAutoScroll = false;
      
      if (messagesList) {
        const { scrollTop, scrollHeight, clientHeight } = messagesList;
        // Auto-scroll if user is already near bottom (within 100px)
        shouldAutoScroll = scrollHeight - scrollTop - clientHeight < 100;
      }
      
      setConversations(prev => {
        const existingConversation = prev.find(conv => 
          conv.conversation_id === message.conversation_id
        );
        
        if (existingConversation) {
          // Enhanced check for duplicate messages - this is more comprehensive
          const messageExists = existingConversation.messages && existingConversation.messages.some(msg => {
            // Case 1: Exact message ID match (server-assigned ID)
            if (msg.message_id === message.message_id && !msg.is_sending) {
              return true;
            }
            
            // Case 2: Messages with same content from same sender
            // This catches duplicate websocket broadcasts and optimistic updates
            if (msg.sender_id === message.sender_id && 
                msg.content === message.content) {
              
              // For messages with attachments
              if (message.attachment && msg.attachment) {
                // Compare attachment details
                return msg.attachment.file_name === message.attachment.file_name &&
                      msg.attachment.file_size === message.attachment.file_size;
              }
              
              // For text-only messages
              return !message.attachment && !msg.attachment;
            }
            
            return false;
          });
          
          if (messageExists) {
            console.log('Message already exists in conversation, ignoring duplicate:', message.message_id);
            return prev; // Don't update state if message already exists
          }
          
          // Find temporary message for replacement - primarily looking for messages that are pending
          const tempMsgIdx = existingConversation.messages && existingConversation.messages.findIndex(msg => {
            // Check for temporary messages (optimistically added)
            if (msg.is_sending || (typeof msg.message_id === 'string' && msg.message_id.startsWith('temp_'))) {
              // For messages with attachments, match on file properties
              if (message.attachment && msg.attachment) {
                return msg.sender_id === message.sender_id &&
                      msg.content === message.content &&
                      msg.attachment.file_name === message.attachment.file_name;
              }
              
              // For text-only messages
              return msg.sender_id === message.sender_id && 
                    msg.content === message.content;
            }
            return false;
          });
          
          // First update the conversation with the new message
          let updatedConversations = prev.map(conv =>
            conv.conversation_id === message.conversation_id
              ? {
                  ...conv,
                  messages:
                    tempMsgIdx !== -1
                      ? conv.messages && conv.messages.map((msg, idx) =>
                          idx === tempMsgIdx ? { ...message, is_sending: false } : msg
                        )
                      : [message, ...(conv.messages || [])],
                  last_message: message.content,
                  last_message_time: message.sent_at
                }
              : conv
          );
          
          // Then sort conversations by last message time
          updatedConversations = updatedConversations.sort((a, b) => {
            const aTime = a.last_message_time ? new Date(a.last_message_time) : new Date(0);
            const bTime = b.last_message_time ? new Date(b.last_message_time) : new Date(0);
            return bTime - aTime;
          });
          
          return updatedConversations;
        }
        
        // If conversation doesn't exist, fetch it
        fetch(`http://localhost:5000/api/messages/private-conversations/${message.conversation_id}`, {
          headers: { jwt_token: localStorage.getItem("token") }
        })
          .then(response => response.json())
          .then(conversationData => {
            setConversations(prevConvs => {
              // Add the new conversation at the top
              const newConvs = [
                {
                  ...conversationData,
                  messages: [message]
                },
                ...prevConvs
              ];
              
              // Sort by last message time
              return newConvs.sort((a, b) => {
                const aTime = a.last_message_time ? new Date(a.last_message_time) : new Date(0);
                const bTime = b.last_message_time ? new Date(b.last_message_time) : new Date(0);
                return bTime - aTime;
              });
            });
          })
          .catch(err => console.error("Error fetching new conversation:", err));
        return prev;
      });

      // Mark as unread if not in the active conversation
      if (activeConversation !== message.conversation_id && message.sender_id !== userProfile.user_id) {
        console.log(`Marking conversation ${message.conversation_id} as unread`);
        setUnreadMessages(prev => {
          const newState = {
            ...prev,
            [message.conversation_id]: true
          };
          console.log("Updated unread state:", newState);
          return newState;
        });
      } else if (activeConversation === message.conversation_id && shouldAutoScroll) {
        // Only auto-scroll if user was already at the bottom
        requestAnimationFrame(() => scrollToBottom());
      }
    });

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
            const messageAlreadyDeleted = conv.messages.some(msg => 
              msg.message_id === data.message_id && msg.is_deleted
            );
            
            if (messageAlreadyDeleted) {
              return conv;
            }
            
            return {
              ...conv,
              messages: conv.messages.map(msg => 
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

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.emit('user_offline', { user_id: userProfile.user_id });
        newSocket.disconnect();
      }
    };
  }, [userProfile]);

  // Add a new useEffect to handle marking messages as read on user interaction
  useEffect(() => {
    // Function to handle marking messages as read when user interacts with message list
    const markMessagesAsRead = () => {
      if (activeConversation && unreadMessages[activeConversation]) {
        console.log(`Marking conversation ${activeConversation} as read due to user interaction`);
        
        // Mark ONLY the active conversation as read
        setUnreadMessages(prev => ({
          ...prev,
          [activeConversation]: false
        }));
        
        // Notify server that messages are read
        if (socket && socket.connected) {
          socket.emit('mark_as_read', { conversation_id: activeConversation });
        }
      }
    };
    
    // Get reference to the messages list element
    const messagesList = messagesListRef.current;
    if (!messagesList) return;
    
    // Add event listeners for user interactions that indicate reading
    const handleScroll = () => {
      // Mark as read when user scrolls in the message list
      markMessagesAsRead();
    };
    
    const handleClick = () => {
      // Mark as read when user clicks in the message list
      markMessagesAsRead();
    };
    
    // Add mouse movement detection for more natural "reading" detection
    const handleMouseMove = () => {
      // Mark as read when user moves mouse in the message list area
      markMessagesAsRead();
    };
    
    // Add the event listeners
    messagesList.addEventListener('scroll', handleScroll);
    messagesList.addEventListener('click', handleClick);
    messagesList.addEventListener('mousemove', handleMouseMove);
    
    // Clean up the event listeners
    return () => {
      messagesList.removeEventListener('scroll', handleScroll);
      messagesList.removeEventListener('click', handleClick);
      messagesList.removeEventListener('mousemove', handleMouseMove);
    };
  }, [activeConversation, socket, unreadMessages]);

  // Also add a mark as read when sending a message
  const handleSendMessage = async () => {
    // Mark messages as read when sending a reply
    if (activeConversation && unreadMessages[activeConversation]) {
      setUnreadMessages(prev => ({
        ...prev,
        [activeConversation]: false
      }));
      
      // Notify server that messages are read
      if (socket && socket.connected) {
        socket.emit('mark_as_read', { conversation_id: activeConversation });
      }
    }

    if ((!messageText.trim() && !fileAttachment) || !activeConversation || !userProfile || !socket) return;

    try {
      const tempMessageId = `temp_${Date.now()}`;
      const tempMessage = {
        message_id: tempMessageId,
        conversation_id: activeConversation,
        sender_id: userProfile.user_id,
        sender_name: `${userProfile.first_name} ${userProfile.last_name}`,
        content: messageText.trim(),
        sent_at: new Date().toISOString(),
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

      // Optimistically update UI - prevent duplicate messages
      setConversations(prev => {
        const updatedConversations = prev.map(conv => {
          if (conv.conversation_id === activeConversation) {
            // Check for duplicate messages
            const isDuplicate = conv.messages && conv.messages.some(msg => 
              msg.content === tempMessage.content && 
              msg.attachment?.file_name === tempMessage.attachment?.file_name &&
              Date.now() - new Date(msg.sent_at).getTime() < 1000 // Within last second
            );
            
            if (isDuplicate) {
              return conv;
            }
            
            return {
              ...conv,
              messages: [
                {
                  ...tempMessage,
                  attachment: fileAttachment ? {
                    file_name: fileAttachment.name,
                    file_size: fileAttachment.size,
                    mime_type: fileAttachment.type,
                    is_image: fileAttachment.type.startsWith('image/'),
                    preview_url: filePreview,
                    file_url: filePreview
                  } : null
                },
                ...(conv.messages || [])
              ],
              last_message: fileAttachment ? `📎 ${fileAttachment.name}` : tempMessage.content,
              last_message_time: tempMessage.sent_at
            };
          }
          return conv;
        });
        
        // Sort conversations by the most recent message
        return updatedConversations.sort((a, b) => {
          const aTime = a.last_message_time ? new Date(a.last_message_time) : new Date(0);
          const bTime = b.last_message_time ? new Date(b.last_message_time) : new Date(0);
          return bTime - aTime;
        });
      });

      const messageToSend = messageText.trim();
      setMessageText('');

      // Prepare file data if there's an attachment
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
          console.log("File upload result:", uploadResult); // Debug log
          
          // Check if upload was successful and contains file data
          if (!uploadResult || uploadResult.error) {
            throw new Error(uploadResult?.error || 'Invalid server response');
          }
          
          // Send message with file attachment info, with fallbacks for each property
          socket.emit('send_private_message', {
            conversation_id: activeConversation,
            content: messageToSend || " ", // Ensure content is never empty
            file_attachment: {
              file_name: uploadResult.file_name || fileAttachment.name,
              file_path: uploadResult.file_path || `/uploads/messages/${Date.now()}-${fileAttachment.name}`,
              file_size: uploadResult.file_size || fileAttachment.size,
              mime_type: uploadResult.mime_type || fileAttachment.type,
              is_image: uploadResult.is_image !== undefined ? 
                uploadResult.is_image : 
                fileAttachment.type.startsWith('image/')
            }
          }, (acknowledgement) => handleMessageAcknowledgement(acknowledgement, tempMessageId));
          
          // Clear file attachment state after sending
          setFileAttachment(null);
          setFilePreview(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } catch (err) {
          console.error("Error uploading file:", err.message);
          toast.error('Failed to upload file');
          
          // Update message status to failed
          setConversations(prev => 
            prev.map(conv => 
              conv.conversation_id === activeConversation 
                ? { 
                    ...conv, 
                    messages: conv.messages && conv.messages.map(msg => 
                      msg.message_id === tempMessageId 
                        ? { ...msg, is_sending: false, failed: true }
                        : msg
                    )
                  }
                : conv
            )
          );
        }
      } else {
        // Send regular message without attachment
        socket.emit('send_private_message', {
          conversation_id: activeConversation,
          content: messageToSend
        }, (acknowledgement) => handleMessageAcknowledgement(acknowledgement, tempMessageId));
      }
    } catch (err) {
      console.error("Error sending message:", err.message);
      toast.error('Failed to send message');
    }
  };
  
  // Send a thumbs up like message
  const sendLike = () => {
    if (!activeConversation || !userProfile || !socket) return;
    
    // Mark messages as read when sending a like
    if (activeConversation && unreadMessages[activeConversation]) {
      setUnreadMessages(prev => ({
        ...prev,
        [activeConversation]: false
      }));
      
      // Notify server that messages are read
      if (socket && socket.connected) {
        socket.emit('mark_as_read', { conversation_id: activeConversation });
      }
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
      
      // Optimistically update UI
      setConversations(prev => {
        const updatedConversations = prev.map(conv => {
          if (conv.conversation_id === activeConversation) {            
            return {
              ...conv,
              messages: [
                {
                  ...tempMessage
                },
                ...(conv.messages || [])
              ],
              last_message: "👍",
              last_message_time: tempMessage.sent_at
            };
          }
          return conv;
        });
        
        // Sort conversations by the most recent message
        return updatedConversations.sort((a, b) => {
          const aTime = a.last_message_time ? new Date(a.last_message_time) : new Date(0);
          const bTime = b.last_message_time ? new Date(b.last_message_time) : new Date(0);
          return bTime - aTime;
        });
      });
      
      // Send to server
      socket.emit('send_private_message', {
        conversation_id: activeConversation,
        content: "👍"
      }, (acknowledgement) => handleMessageAcknowledgement(acknowledgement, tempMessageId));
      
    } catch (err) {
      console.error("Error sending like:", err.message);
      toast.error('Failed to send like');
    }
  };

  // Handle message acknowledgement from server
  const handleMessageAcknowledgement = (acknowledgement, tempMessageId) => {
    if (acknowledgement && acknowledgement.error) {
      console.error("Socket error:", acknowledgement.error);
      toast.error('Failed to send message');
      
      // Update message status to failed
      setConversations(prev => 
        prev.map(conv => 
          conv.conversation_id === activeConversation 
            ? { 
                ...conv, 
                messages: conv.messages && conv.messages.map(msg => 
                  msg.message_id === tempMessageId 
                    ? { ...msg, is_sending: false, failed: true }
                    : msg
                )
              }
            : conv
        )
      );
    } else if (acknowledgement && acknowledgement.message) {
      // Check if real message already exists in the conversation
      // This can happen if the WebSocket receives the broadcast before the acknowledgement
      console.log('Message acknowledged by server:', acknowledgement.message);
      
      setConversations(prev => {
        const activeConv = prev.find(conv => conv.conversation_id === activeConversation);
        
        if (!activeConv || !activeConv.messages) return prev;
        
        // Check if the message is already in the conversation with a real ID
        const messageAlreadyExists = activeConv.messages.some(msg => 
          !msg.is_sending && 
          msg.message_id === acknowledgement.message.message_id
        );
        
        if (messageAlreadyExists) {
          console.log('Acknowledged message already exists in state, removing temporary version');
          // Just remove the temporary message since the real one is already there
          return prev.map(conv => 
            conv.conversation_id === activeConversation 
              ? { 
                  ...conv, 
                  messages: conv.messages && conv.messages.filter(msg => msg.message_id !== tempMessageId)
                }
              : conv
          );
        }
        
        // Replace the temporary message with the real one
        return prev.map(conv => 
          conv.conversation_id === activeConversation 
            ? { 
                ...conv, 
                messages: conv.messages && conv.messages.map(msg => 
                  msg.message_id === tempMessageId 
                    ? { ...acknowledgement.message, is_sending: false }
                    : msg
                )
              }
            : conv
        );
      });
    }
  };

  // Start new conversation
  const startNewConversation = async (user) => {
    if (!user || !userProfile) return;

    // Check if conversation already exists
    const existingConversation = conversations.find(conv => 
      conv.participants && 
      conv.participants.some(p => p.user_id === user.user_id) &&
      conv.participants.some(p => p.user_id === userProfile.user_id)
    );

    if (existingConversation) {
      // Use setActiveConversationState to avoid circular dependency
      setActiveConversationState(existingConversation.conversation_id);
      setNewConversationModal(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch("http://localhost:5000/api/messages/private-conversations", {
        method: "POST",
        headers: { 
          jwt_token: token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          participant_id: user.user_id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      const newConversation = await response.json();
      setConversations(prev => [newConversation, ...prev]);
      // Use setActiveConversationState to avoid circular dependency
      setActiveConversationState(newConversation.conversation_id);
      setNewConversationModal(false);
      
      toast.success(`Started conversation with ${user.first_name}`);
    } catch (err) {
      console.error("Error creating conversation:", err.message);
      toast.error('Failed to create conversation');
    }
  };

  // Handle message input and typing indicators
  const handleMessageInput = (e) => {
    setMessageText(e.target.value);
    
    if (socket && socket.connected && activeConversation) {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      
      socket.emit('typing_start', { conversation_id: activeConversation });
      
      const timeout = setTimeout(() => {
        socket.emit('typing_end', { conversation_id: activeConversation });
      }, 2000);
      
      setTypingTimeout(timeout);
    }
  };

  // Format timestamp
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
  
  // Format detailed timestamp for tooltip
  const formatDetailedTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString(undefined, options);
  };

  // Initialize component
  useEffect(() => {
    const loadData = async () => {
      try {
        await getProfile();
        setLoading(false);
      } catch (error) {
        console.error("Error loading user data:", error);
        setLoading(false);
      }
    };
    
    loadData();
  }, [getProfile]);

  useEffect(() => {
    if (userProfile) {
      fetchAllUsers();
      fetchUserConversations();
    }
  }, [userProfile, fetchAllUsers, fetchUserConversations]);

  // Fetch message reactions when active conversation changes
  useEffect(() => {
    if (activeConversation) {
      fetchMessageReactions();
    }
  }, [activeConversation, fetchMessageReactions]);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

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
      } catch (err) {
        setCourses([]);
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchUserRoleAndCourses();
  }, []);

  // Add reaction handler
  const handleAddReaction = (messageId, reaction) => {
    if (!socket || !socket.connected) return;
    
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
  const handleDeleteMessage = (messageId) => {
    if (!socket || !socket.connected) return;
    
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
      if (response.success) {
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

  // Add message search state
  const [messageSearchTerm, setMessageSearchTerm] = useState("");
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  // Add message search functionality
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
      .map(message => message.message_id)
      .reverse(); // Reverse the results so oldest messages come first
    
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

  // Add message forwarding state
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  
  // Add flag to track internal navigation
  const [isInternalNavigation, setIsInternalNavigation] = useState(false);
  
  // Handle message forwarding
  const openForwardModal = (message) => {
    setForwardingMessage(message);
    setForwardModalOpen(true);
  };
  
  const handleForwardMessage = async (targetConversationId) => {
    if (!forwardingMessage || !socket || !socket.connected) return;
    
    try {
      // Create a forwarded message
      const forwardedContent = `Forwarded message:\n${forwardingMessage.content}`;
      
      // Send via WebSocket
      socket.emit('send_private_message', {
        conversation_id: targetConversationId,
        content: forwardedContent,
        forwarded_from: {
          message_id: forwardingMessage.message_id,
          sender_name: forwardingMessage.sender_name
        }
      });
      
      toast.success('Message forwarded');
      setForwardModalOpen(false);
      setForwardingMessage(null);
    } catch (err) {
      console.error("Error forwarding message:", err.message);
      toast.error('Failed to forward message');
    }
  };

  // Add state for link confirmation popup
  const [linkConfirmation, setLinkConfirmation] = useState({
    show: false,
    url: '',
    position: null
  });
  
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
          key={`${url}-${match.index}`} 
          className="message-link"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // No longer tracking position
            setLinkConfirmation({
              show: true,
              url: fullUrl,
              position: null // Remove position tracking
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

  // Handle file attachment
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setFileAttachment(null);
      setFilePreview(null);
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

  // Handle emoji selection
  const handleEmojiSelect = (emojiData) => {
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

  // Add an effect to find or start conversation with specific user from URL parameter
  useEffect(() => {
    const findOrStartConversationWithUser = async () => {
      // Skip if this is navigation initiated internally by our component
      if (isInternalNavigation) {
        console.log("Skipping URL-based conversation finding - internal navigation");
        return;
      }
      
      if (!userId || !userProfile || !conversations.length) return;
      
      console.log("URL contains userId:", userId, "Looking for conversation with this user");
      
      // Check if conversation with this user already exists
      const existingConversation = conversations.find(conv => 
        conv.participants && 
        conv.participants.some(p => p.user_id.toString() === userId.toString())
      );
      
      if (existingConversation) {
        console.log("Found existing conversation:", existingConversation.conversation_id);
        // Use setActiveConversationState directly to avoid circular dependency
        setActiveConversationState(existingConversation.conversation_id);
        return;
      }
      
      // If no existing conversation, find the user and start a new one
      const userToChat = allUsers.find(user => user.user_id.toString() === userId.toString());
      if (userToChat) {
        console.log("Starting new conversation with user:", userToChat.first_name);
        await startNewConversation(userToChat);
      } else {
        console.log("User not found in loaded users, fetching user data");
        try {
          const token = localStorage.getItem("token");
          if (!token) return;
          
          const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
            headers: { jwt_token: token }
          });
          
          if (response.ok) {
            const userData = await response.json();
            await startNewConversation(userData);
          } else {
            console.error("Could not find user with ID:", userId);
          }
        } catch (error) {
          console.error("Error finding user:", error);
        }
      }
    };
    
    findOrStartConversationWithUser();
  }, [userId, userProfile, conversations, allUsers, startNewConversation, setActiveConversationState, isInternalNavigation]);

  // Add a loading state for conversation switching
  const [isConversationChanging, setIsConversationChanging] = useState(false);
  
  // Update the setActiveConversation function to handle smooth transitions
  const setActiveConversation = useCallback((conversationId) => {
    // If selecting the same conversation, do nothing
    if (conversationId === activeConversation) return;

    // Start transition
    setIsConversationChanging(true);
    
    // Set the active conversation state after a short delay to allow for transition
    setTimeout(() => {
      setActiveConversationState(conversationId);
      setIsConversationChanging(false);
    }, 150);
    
    // If we have a valid conversation ID, find the other participant
    if (conversationId && userProfile) {
      const conversation = conversations.find(c => c.conversation_id === conversationId);
      if (conversation && conversation.participants) {
        const otherParticipant = conversation.participants.find(
          p => p.user_id !== userProfile.user_id
        );
        
        if (otherParticipant) {
          // Set flag to indicate this is an internal navigation
          setIsInternalNavigation(true);
          
          // Update URL to show the other participant's ID (for direct navigation)
          navigate(`/messages/${otherParticipant.user_id}`, { replace: true });
          
          // Reset the flag after navigation (with a small delay to ensure useEffect doesn't fire in between)
          setTimeout(() => {
            setIsInternalNavigation(false);
          }, 50);
        }
      }
    }
  }, [navigate, conversations, userProfile, setIsInternalNavigation, activeConversation]);

  if (loading) {
    return (
      <div className="dashboard-container dashboard-page">
        <LoadingIndicator text="Loading Messages" />
      </div>
    );
  }

  // Add custom CSS for emoji picker with more aggressive selectors
  // Custom styled component for our emoji picker
    // Custom component for our emoji picker with aggressive hiding of clear button
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
          
          // Use CSS variables to control appearance
          cssVars={{
            bgColor: 'white',
            categoryIcons: {
              activity: '#555',
              custom: '#555',
              flags: '#555',
              foods: '#555',
              frequentlyUsed: '#555',
              objects: '#555',
              people: '#555',
              places: '#555',
              symbols: '#555'
            },
            color: '#000',
            iconButtonBg: 'transparent',
            searchBg: '#f1f3f4',
            searchBorderColor: 'transparent',
            searchBorderRadius: '20px',
            searchFocusBorderColor: '#e0e0e0',
            searchFontSize: '15px',
            searchHeight: '35px',
            searchPadding: '8px 15px',
            scrollBarThumbBorderRadius: '3px',
            scrollBarThumbColor: '#ccc',
            scrollBarTrackColor: '#f1f1f1',
            scrollBarWidth: '6px'
          }}
        />
      </div>
    );
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
        userProfile={userProfile || {}}
        onLogout={(e) => {
          e.preventDefault();
          localStorage.removeItem('token');
          if (setAuth) setAuth(false);
          toast.success('Logged out successfully!');
          navigate('/login');
        }}
        activePath={location.pathname}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
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
                  <div className="user-name">
                    {userProfile?.first_name} {userProfile?.last_name}
                  </div>
                  <div className="user-role">{userProfile?.role}</div>
                </div>
                {userProfile?.profile_picture_url ? (
                  <div className="avatar" onClick={() => navigate("/settings")}>
                    <img src={userProfile.profile_picture_url} alt="Profile" />
                  </div>
                ) : (
                  <div className="avatar" onClick={() => navigate("/settings")}>
                    {userProfile?.first_name?.[0]}{userProfile?.last_name?.[0]}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="messages-container">
            <div className="messages-content">
              {/* Conversations list */}
              <div className="conversations-list">
                <div className="conversations-header">
                  <h2>Private Messages</h2>
                  <button 
                    className="new-conversation-button"
                    onClick={() => setNewConversationModal(true)}
                  >
                    <HiOutlinePlusCircle className="nav-icon" />
                    <span>New Chat</span>
                  </button>
                </div>

                {conversations.length === 0 ? (
                  <div className="no-conversations">
                    <p>No conversations yet</p>
                    <button 
                      className="start-conversation-button"
                      onClick={() => setNewConversationModal(true)}
                    >
                      Start a conversation
                    </button>
                  </div>
                ) : (
                  <div className="conversations">
                    {conversations
                      .filter(conversation => {
                        if (!searchTerm) return true;
                        const otherParticipant = conversation.participants && conversation.participants.find(
                          p => p.user_id !== userProfile?.user_id
                        );
                        return (
                          otherParticipant &&
                          (otherParticipant.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          otherParticipant.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          conversation.last_message?.toLowerCase().includes(searchTerm.toLowerCase()))
                        );
                      })
                      .map(conversation => {
                        const otherParticipant = conversation.participants && conversation.participants.find(
                          p => p.user_id !== userProfile?.user_id
                        );
                        const isOnline = onlineUsers.has(otherParticipant?.user_id);
                        const hasUnread = unreadMessages[conversation.conversation_id];
                        
                        console.log(`Conversation ${conversation.conversation_id} hasUnread:`, hasUnread);

                        return (
                          <div 
                            key={conversation.conversation_id} 
                            className={`conversation-item ${activeConversation === conversation.conversation_id ? 'active' : ''} ${hasUnread === true ? 'unread' : ''}`}
                            onClick={() => setActiveConversation(conversation.conversation_id)}
                          >
                            <div className="conversation-avatar">
                              {otherParticipant?.profile_picture_url ? (
                                <img 
                                  src={otherParticipant.profile_picture_url} 
                                  alt="Profile" 
                                  className={isOnline ? 'online' : ''}
                                />
                              ) : (
                                <HiOutlineUserCircle className={`user-icon ${isOnline ? 'online' : ''}`} />
                              )}
                            </div>
                            <div className="conversation-info">
                              <div className="conversation-name">
                                {otherParticipant 
                                  ? `${otherParticipant.first_name} ${otherParticipant.last_name}`
                                  : 'Unknown User'
                                }
                                {isOnline && <span className="online-indicator">• Online</span>}
                              </div>
                              <div className="conversation-last-message">
                                {conversation.last_message 
                                  ? (conversation.last_message.length > 25
                                    ? conversation.last_message.substring(0, 25) + '...'
                                    : conversation.last_message)
                                  : 'No messages yet'
                                }
                              </div>
                            </div>
                            <div className="conversation-time">
                              {conversation.last_message_time 
                                ? formatTimestamp(conversation.last_message_time)
                                : ''
                              }
                              {hasUnread === true && <div className="unread-indicator"></div>}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Message view */}
              <div className={`messages-view ${isConversationChanging ? 'changing' : ''}`}>
                {activeConversation ? (
                  <>
                    <div className="active-conversation-header">
                      {(() => {
                        const conversation = conversations.find(c => c.conversation_id === activeConversation);
                        const otherParticipant = conversation?.participants && conversation?.participants.find(
                          p => p.user_id !== userProfile?.user_id
                        );
                        const isOnline = onlineUsers.has(otherParticipant?.user_id);
                        const hasUnread = unreadMessages[activeConversation];

                        return (
                          <>
                            <div className="conversation-avatar">
                              {otherParticipant?.profile_picture_url ? (
                                <img 
                                  src={otherParticipant.profile_picture_url} 
                                  alt="Profile" 
                                  className={isOnline ? 'online' : ''}
                                />
                              ) : (
                                <HiOutlineUserCircle className={`user-icon ${isOnline ? 'online' : ''}`} />
                              )}
                            </div>
                            <div className="conversation-info">
                              <div className="conversation-name">
                                {otherParticipant 
                                  ? `${otherParticipant.first_name} ${otherParticipant.last_name}`
                                  : 'Unknown User'
                                }
                                {isOnline && <span className="online-indicator">• Online</span>}
                              </div>
                            </div>
                            
                            <div className="header-actions">
                              {hasUnread && (
                                <button 
                                  className="mark-read-button"
                                  onClick={() => {
                                    // Mark conversation as read
                                    setUnreadMessages(prev => ({
                                      ...prev,
                                      [activeConversation]: false
                                    }));
                                    
                                    // Notify server that messages are read
                                    if (socket && socket.connected) {
                                      socket.emit('mark_as_read', { conversation_id: activeConversation });
                                    }
                                  }}
                                  title="Mark as read"
                                >
                                  Mark as read
                                </button>
                              )}
                              <button 
                                className="search-messages-button"
                                onClick={() => setIsSearchingMessages(!isSearchingMessages)}
                                aria-label="Search messages"
                              >
                                <HiOutlineSearch />
                              </button>
                            </div>
                          </>
                        );
                      })()}
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

                    <div 
                      className="messages-list" 
                      ref={messagesListRef}
                    >
                      {conversations.find(c => c.conversation_id === activeConversation)?.messages?.length > 0 ? (
                        <>
                          {conversations.find(c => c.conversation_id === activeConversation)?.messages
                          ?.slice()
                          .reverse()
                          .reduce((acc, message, index, array) => {
                            const messageDate = new Date(message.sent_at).toLocaleDateString();
                            if (index === 0 || messageDate !== new Date(array[index - 1].sent_at).toLocaleDateString()) {
                              acc.push(
                                <div key={`date-${messageDate}-${message.message_id}`} className="date-separator">
                                  <span>{messageDate === new Date().toLocaleDateString() ? 'Today' : messageDate}</span>
                                </div>
                              );
                            }

                              // Check if this message is in search results
                              const isSearchResult = searchResults.includes(message.message_id);
                              const isCurrentSearchResult = isSearchResult && searchResults[currentSearchIndex] === message.message_id;

                            acc.push(
                              <div 
                                  id={`message-${message.message_id}`}
                                key={`${message.message_id}-${message.content}`}
                                  className={`message-item ${message.sender_id === userProfile?.user_id ? 'sent' : 'received'} ${message.is_deleted ? 'deleted' : ''} ${isSearchResult ? 'search-result' : ''} ${isCurrentSearchResult ? 'current-search-result' : ''}`}
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
                                    <div className="message-sender">{message.sender_name}</div>
                                  )}
                                  <div className="message-bubble">
                                      {message.forwarded_from && (
                                        <div className="forwarded-message-indicator">
                                          <HiOutlineShare className="forward-icon" />
                                          <span>Forwarded from {message.forwarded_from.sender_name}</span>
                                        </div>
                                      )}
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
                                        {message.content.split('\n').map((line, i) => (
                                          <React.Fragment key={`${message.message_id}-line-${i}`}>
                                            {detectAndRenderUrls(line)}
                                            {i < message.content.split('\n').length - 1 && <br />}
                                          </React.Fragment>
                                        ))}
                                      </div>
                                      <div className="message-time" title={formatDetailedTimestamp(message.sent_at)}>
                                      {formatTimestamp(message.sent_at)}
                                      {message.is_sending && <span className="sending-indicator"> • Sending...</span>}
                                      {message.failed && <span className="failed-indicator"> • Failed to send</span>}
                                        {!message.is_sending && !message.failed && message.sender_id === userProfile?.user_id && (
                                          <span className="read-status">
                                            {message.is_read ? " • Read" : " • Delivered"}
                                          </span>
                                        )}
                                    </div>
                                      
                                      {/* Message actions - Facebook Messenger style */}
                                      {!message.is_deleted && (
                                        <div className="message-actions">
                                          {/* Emoji reaction buttons */}
                                          {commonReactions.map(emoji => (
                                            <button 
                                              key={`${message.message_id}-${emoji}`} 
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
                                          
                                          {/* Forward button */}
                                          <button 
                                            className="message-action-button forward"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openForwardModal(message);
                                            }}
                                            aria-label="Forward message"
                                          >
                                            <HiOutlineShare />
                                          </button>
                                          
                                          {/* Delete button - only for user's own messages */}
                                          {message.sender_id === userProfile?.user_id && (
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
                                  
                                  {/* Display reactions - Moved outside message bubble */}
                                  {!message.is_deleted && messageReactions[message.message_id] && Object.keys(messageReactions[message.message_id]).length > 0 && (
                                    <div className="message-reactions">
                                      {Object.entries(messageReactions[message.message_id]).map(([reaction, users]) => {
                                        const userReacted = users.some(user => user.user_id === userProfile?.user_id);
                                        return (
                                          <button 
                                            key={`${message.message_id}-${reaction}`} 
                                            className={`reaction-badge ${userReacted ? 'user-reacted' : ''}`}
                                            onClick={() => userReacted 
                                              ? handleRemoveReaction(message.message_id, reaction)
                                              : handleAddReaction(message.message_id, reaction)
                                            }
                                            title={users.map(u => u.user_name).join(', ')}
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
                          }, [])
                          }
                          {/* Add an empty div with a ref to scroll to */}
                          <div ref={messagesEndRef} />
                        </>
                      ) : (
                        <div className="no-messages">
                          <p>No messages yet. Start the conversation!</p>
                        </div>
                      )}

                      {/* Typing indicators */}
                      {typingUsers[activeConversation] && Object.keys(typingUsers[activeConversation]).length > 0 && (
                        <div className="typing-indicator">
                          {Object.values(typingUsers[activeConversation]).join(', ')} {Object.values(typingUsers[activeConversation]).length === 1 ? 'is' : 'are'} typing...
                        </div>
                      )}
                    </div>

                    <div className="message-input-wrapper">
                      {/* Scroll to bottom button - positioned directly above input */}
                      {(showScrollButton || forceShowButton) && (
                        <button 
                          className="scroll-to-bottom-button"
                          onClick={() => scrollToBottom('smooth')}
                          aria-label="Scroll to latest messages"
                          style={{
                            backgroundColor: "#000000",
                            color: "#ffffff"
                          }}
                        >
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            viewBox="0 0 384 512" 
                            fill="white"
                            width="60" 
                            height="60"
                            style={{ display: "block" }}
                          >
                            <path d="M169.4 470.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 370.8 224 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 306.7L54.6 265.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"/>
                          </svg>
                        </button>
                      )}

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
                            onClick={() => fileInputRef.current.click()}
                            title="Attach file"
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
                          placeholder="Type a message..." 
                          value={messageText}
                          onChange={handleMessageInput}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        />

                        {/* Always show emoji picker button */}
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

                        {/* Show like button when no text/attachment, else show send button */}
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
                      <h3>Select a conversation or start a new one</h3>
                      <p>Choose an existing conversation from the sidebar or select a user below to start a new conversation</p>
                      
                      {/* Add user selection section */}
                      <div className="user-selection-section">
                        <h4>Start a conversation with:</h4>
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
                        
                        <div className="users-grid">
                          {allUsers
                            .filter(user => 
                              user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              user.last_name.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            .slice(0, 8) // Limit number of users shown
                            .map(user => (
                              <div 
                                key={user.user_id} 
                                className="user-selection-card"
                                onClick={() => {
                                  // Update URL and start conversation
                                  navigate(`/messages/${user.user_id}`);
                                  startNewConversation(user);
                                }}
                              >
                                <div className="user-avatar">
                                  {user.profile_picture_url ? (
                                    <img 
                                      src={user.profile_picture_url} 
                                      alt="Profile" 
                                      className={onlineUsers.has(user.user_id) ? 'online' : ''}
                                    />
                                  ) : (
                                    <HiOutlineUserCircle className={`user-icon ${onlineUsers.has(user.user_id) ? 'online' : ''}`} />
                                  )}
                                </div>
                                <div className="user-info">
                                  <div className="user-name">
                                    {user.first_name} {user.last_name}
                                    {onlineUsers.has(user.user_id) && <span className="online-indicator">• Online</span>}
                                  </div>
                                  <div className="user-role">{user.role === 'professor' ? 'Professor' : 'Student'}</div>
                                </div>
                              </div>
                            ))}
                            
                          {allUsers.filter(user => 
                            user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            user.last_name.toLowerCase().includes(searchTerm.toLowerCase())
                          ).length === 0 && (
                            <div className="no-users-found">
                              <p>No users found matching "{searchTerm}"</p>
                            </div>
                          )}
                        </div>
                        
                        <button 
                          className="view-all-users-button"
                          onClick={() => setNewConversationModal(true)}
                        >
                          View all users
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* New conversation modal */}
          {newConversationModal && (
            <div className="modal-overlay" onClick={() => setNewConversationModal(false)}>
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
                    {allUsers
                      .filter(user => 
                        user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        user.last_name.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map(user => (
                        <div 
                          key={user.user_id} 
                          className="user-item"
                          onClick={() => startNewConversation(user)}
                        >
                          <div className="user-avatar">
                            {user.profile_picture_url ? (
                              <img 
                                src={user.profile_picture_url} 
                                alt="Profile" 
                                className={onlineUsers.has(user.user_id) ? 'online' : ''}
                              />
                            ) : (
                              <HiOutlineUserCircle className={`user-icon ${onlineUsers.has(user.user_id) ? 'online' : ''}`} />
                            )}
                          </div>
                          <div className="user-info">
                            <div className="user-name">
                              {user.first_name} {user.last_name}
                              {onlineUsers.has(user.user_id) && <span className="online-indicator">• Online</span>}
                            </div>
                            <div className="user-role">{user.role === 'professor' ? 'Professor' : 'Student'}</div>
                          </div>
                        </div>
                      ))}
                    
                    {allUsers.filter(user => 
                      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      user.last_name.toLowerCase().includes(searchTerm.toLowerCase())
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
          
          {/* Forward message modal */}
          {forwardModalOpen && (
            <div className="modal-overlay" onClick={() => setForwardModalOpen(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Forward Message</h2>
                  <button className="close-button" onClick={() => setForwardModalOpen(false)}>
                    <HiOutlineX className="nav-icon" />
                  </button>
                </div>
                <div className="modal-body">
                  <div className="forwarded-message-preview">
                    <p className="forwarded-message-label">Message to forward:</p>
                    <div className="forwarded-message-content">
                      {forwardingMessage?.content}
                    </div>
                  </div>
                  <p className="forward-instruction">Select a conversation to forward this message to:</p>
                  <div className="conversations-list-modal">
                    {conversations.map(conversation => {
                      const otherParticipant = conversation.participants && conversation.participants.find(
                        p => p.user_id !== userProfile?.user_id
                      );
                      const isOnline = onlineUsers.has(otherParticipant?.user_id);
                      
                      return (
                        <div 
                          key={conversation.conversation_id} 
                          className="conversation-item-modal"
                          onClick={() => handleForwardMessage(conversation.conversation_id)}
                        >
                          <div className="conversation-avatar">
                            {otherParticipant?.profile_picture_url ? (
                              <img 
                                src={otherParticipant.profile_picture_url} 
                                alt="Profile" 
                                className={isOnline ? 'online' : ''}
                              />
                            ) : (
                              <HiOutlineUserCircle className={`user-icon ${isOnline ? 'online' : ''}`} />
                            )}
                          </div>
                          <div className="conversation-info">
                            <div className="conversation-name">
                              {otherParticipant 
                                ? `${otherParticipant.first_name} ${otherParticipant.last_name}`
                                : 'Unknown User'
                              }
                              {isOnline && <span className="online-indicator">• Online</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

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
      </div>
    </div>
  );
};

export default PrivateMessages;