/**
 * Smart Conversation Management Utilities
 * Handles active conversation selection, persistence, and unread message prioritization
 */

/**
 * Determines the initial active conversation based on priority:
 * 1. Last active conversation (if recent and valid) - for better navigation persistence 
 * 2. First unread conversation (only if newer than last active time)
 * 3. Most recent conversation
 */
export const determineInitialActiveConversation = (sortedConversations, unreadState) => {
  if (!sortedConversations || sortedConversations.length === 0) return null;
  
  // 1. First priority: Restore last active (if valid and recent) for better navigation persistence
  const lastActiveId = localStorage.getItem('lastActiveConversation');
  const lastActiveTime = localStorage.getItem('lastActiveConversationTime');
  
  // Extend persistence time to 7 days for better cross-navigation experience
  if (lastActiveId && lastActiveTime) {
    const timeSinceLastActive = Date.now() - parseInt(lastActiveTime);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    if (timeSinceLastActive < sevenDays) {
      const lastActiveExists = sortedConversations.find(conv => 
        conv.conversation_id.toString() === lastActiveId
      );
      
      if (lastActiveExists) {
        // Check if there are any unread conversations with messages newer than last active time
        const newerUnreadConv = sortedConversations.find(conv => {
          const hasUnread = unreadState[conv.conversation_id] === true;
          if (!hasUnread) return false;
          
          // Check if this conversation's last message is newer than when we last were active
          const convTime = conv.last_message_time ? Date.parse(conv.last_message_time) : 0;
          return convTime > parseInt(lastActiveTime);
        });
        
        // Only switch to unread if there are newer unread messages
        if (!newerUnreadConv) {
          console.log('Restoring last active conversation for navigation persistence:', lastActiveExists.conversation_id);
          return lastActiveExists.conversation_id;
        }
      }
    }
  }
  
  // 2. Second priority: Find first unread conversation (only if newer than last active)
  const firstUnreadConv = sortedConversations.find(conv => 
    unreadState[conv.conversation_id] === true
  );
  
  if (firstUnreadConv) {
    console.log('Setting active conversation to unread (newer than last active):', firstUnreadConv.conversation_id);
    return firstUnreadConv.conversation_id;
  }
  
  // 3. Fallback: Most recent conversation
  console.log('Using most recent conversation:', sortedConversations[0].conversation_id);
  return sortedConversations[0].conversation_id;
};

/**
 * Persists the active conversation to localStorage with timestamp
 */
export const persistActiveConversation = (conversationId) => {
  if (conversationId) {
    localStorage.setItem('lastActiveConversation', conversationId.toString());
    localStorage.setItem('lastActiveConversationTime', Date.now().toString());
    console.log('Persisted active conversation:', conversationId);
  }
};

/**
 * Gets the total count of unread conversations
 */
export const getTotalUnreadCount = (unreadMessages) => {
  if (!unreadMessages || typeof unreadMessages !== 'object') return 0;
  return Object.values(unreadMessages).filter(isUnread => isUnread === true).length;
};

/**
 * Updates the browser title with unread count
 */
export const updateBrowserTitle = (unreadCount, baseTitle = 'Nova - Private Messages') => {
  if (unreadCount > 0) {
    document.title = `(${unreadCount}) ${baseTitle}`;
  } else {
    document.title = baseTitle;
  }
};

/**
 * Clears conversation persistence data from localStorage
 */
export const clearConversationPersistence = () => {
  localStorage.removeItem('lastActiveConversation');
  localStorage.removeItem('lastActiveConversationTime');
  console.log('Cleared conversation persistence data');
};

/**
 * Gets enhanced CSS classes for conversation items based on unread status and active state
 */
export const getConversationDisplayClass = (conversation, activeConversationId, unreadMessages) => {
  const hasUnread = unreadMessages[conversation.conversation_id] === true;
  const isActive = activeConversationId === conversation.conversation_id;
  
  let classes = 'conversation-item';
  
  if (isActive) classes += ' active';
  if (hasUnread) classes += ' unread urgent-unread';
  if (hasUnread && !isActive) classes += ' pulse-unread';
  
  return classes;
};

/**
 * Optimized sorting function for conversations that sorts only by timestamp
 * Uses Date.parse() instead of new Date() for better performance
 */
export const createOptimizedSortFunction = (unreadState) => {
  return (a, b) => {
    // Sort only by last message time (no longer prioritizing unread messages)
    const aTime = a.last_message_time ? Date.parse(a.last_message_time) : 0;
    const bTime = b.last_message_time ? Date.parse(b.last_message_time) : 0;
    return bTime - aTime;
  };
};

/**
 * Hook-like utility for managing conversation state
 * Returns useful functions and computed values
 */
export const createConversationManager = (conversations, unreadMessages, userProfile) => {
  // Memoized sorted conversations
  const getSortedConversations = () => {
    if (!conversations || conversations.length === 0) return [];
    
    const sortFn = createOptimizedSortFunction(unreadMessages);
    return [...conversations].sort(sortFn);
  };
  
  // Get smart initial conversation
  const getSmartInitialConversation = () => {
    const sortedConversations = getSortedConversations();
    return determineInitialActiveConversation(sortedConversations, unreadMessages);
  };
  
  // Get conversation by user ID (for URL-based navigation)
  const getConversationByUserId = (userId) => {
    if (!userProfile || !conversations) return null;
    
    return conversations.find(conv => 
      conv.participants && 
      conv.participants.some(p => p.user_id.toString() === userId.toString())
    );
  };
  
  // Get other participant from conversation
  const getOtherParticipant = (conversation) => {
    if (!conversation || !conversation.participants || !userProfile) return null;
    
    return conversation.participants.find(
      p => p.user_id !== userProfile.user_id
    );
  };
  
  return {
    getSortedConversations,
    getSmartInitialConversation,
    getConversationByUserId,
    getOtherParticipant,
    totalUnreadCount: getTotalUnreadCount(unreadMessages)
  };
};

/**
 * Creates a notification for new unread messages
 * Can be used to show toast notifications or update UI indicators
 */
export const createUnreadNotification = (conversationId, senderName, message, isActiveConversation = false) => {
  if (isActiveConversation) return null; // Don't notify for active conversation
  
  return {
    type: 'unread_message',
    conversationId,
    senderName,
    message: message.length > 50 ? message.substring(0, 50) + '...' : message,
    timestamp: Date.now()
  };
};

/**
 * Validates conversation persistence data
 * Checks if stored conversation ID is still valid
 */
export const validateStoredConversation = (conversations) => {
  const lastActiveId = localStorage.getItem('lastActiveConversation');
  const lastActiveTime = localStorage.getItem('lastActiveConversationTime');
  
  if (!lastActiveId || !lastActiveTime) return null;
  
  // Check if it's not too old (more than 7 days)
  const timeSinceLastActive = Date.now() - parseInt(lastActiveTime);
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  
  if (timeSinceLastActive > sevenDays) {
    clearConversationPersistence();
    return null;
  }
  
  // Check if conversation still exists
  const existingConversation = conversations.find(conv => 
    conv.conversation_id.toString() === lastActiveId
  );
  
  if (!existingConversation) {
    clearConversationPersistence();
    return null;
  }
  
  return existingConversation;
};

export default {
  determineInitialActiveConversation,
  persistActiveConversation,
  getTotalUnreadCount,
  updateBrowserTitle,
  clearConversationPersistence,
  getConversationDisplayClass,
  createOptimizedSortFunction,
  createConversationManager,
  createUnreadNotification,
  validateStoredConversation
}; 