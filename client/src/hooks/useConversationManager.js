import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  determineInitialActiveConversation,
  persistActiveConversation,
  getTotalUnreadCount,
  updateBrowserTitle,
  clearConversationPersistence,
  getConversationDisplayClass,
  createOptimizedSortFunction,
  validateStoredConversation
} from '../utils/conversationManager';

/**
 * Custom hook for managing conversation state with smart selection and persistence
 * @param {Array} conversations - Array of conversation objects
 * @param {Object} unreadMessages - Object mapping conversation IDs to unread status
 * @param {Object} userProfile - Current user profile object
 * @param {string} baseTitle - Base title for browser tab
 * @returns {Object} Conversation management utilities and state
 */
export const useConversationManager = (conversations, unreadMessages, userProfile, baseTitle = 'Nova - Private Messages') => {
  const [lastInitializedConversations, setLastInitializedConversations] = useState([]);
  
  // Memoized sorted conversations to avoid sorting on every render
  const sortedConversations = useMemo(() => {
    if (!conversations || conversations.length === 0) return [];
    
    const sortFn = createOptimizedSortFunction(unreadMessages);
    return [...conversations].sort(sortFn);
  }, [conversations, unreadMessages]);
  
  // Calculate total unread count
  const totalUnreadCount = useMemo(() => {
    return getTotalUnreadCount(unreadMessages);
  }, [unreadMessages]);
  
  // Update browser title with unread count
  useEffect(() => {
    updateBrowserTitle(totalUnreadCount, baseTitle);
    
    // Cleanup on unmount
    return () => {
      document.title = 'Nova';
    };
  }, [totalUnreadCount, baseTitle]);
  
  // Smart conversation selection function
  const getSmartInitialConversation = useCallback(() => {
    if (!sortedConversations || sortedConversations.length === 0) return null;
    
    return determineInitialActiveConversation(sortedConversations, unreadMessages);
  }, [sortedConversations, unreadMessages]);
  
  // Function to persist active conversation
  const persistConversation = useCallback((conversationId) => {
    persistActiveConversation(conversationId);
  }, []);
  
  // Function to clear conversation persistence
  const clearPersistence = useCallback(() => {
    clearConversationPersistence();
  }, []);
  
  // Function to get conversation display classes
  const getConversationClasses = useCallback((conversation, activeConversationId) => {
    return getConversationDisplayClass(conversation, activeConversationId, unreadMessages);
  }, [unreadMessages]);
  
  // Function to get conversation by user ID
  const getConversationByUserId = useCallback((userId) => {
    if (!userProfile || !conversations) return null;
    
    return conversations.find(conv => 
      conv.participants && 
      conv.participants.some(p => p.user_id.toString() === userId.toString())
    );
  }, [conversations, userProfile]);
  
  // Function to get other participant from conversation
  const getOtherParticipant = useCallback((conversation) => {
    if (!conversation || !conversation.participants || !userProfile) return null;
    
    return conversation.participants.find(
      p => p.user_id !== userProfile.user_id
    );
  }, [userProfile]);
  
  // Function to validate and get stored conversation
  const getValidStoredConversation = useCallback(() => {
    return validateStoredConversation(conversations);
  }, [conversations]);
  
  // Function to determine if a conversation should auto-select based on new conversations
  const shouldAutoSelectConversation = useCallback((newConversations, currentActiveConversation) => {
    // Only auto-select if:
    // 1. No current active conversation
    // 2. New unread conversations available
    // 3. Current conversation is not in the new conversations (conversation list changed significantly)
    
    if (currentActiveConversation) {
      const currentStillExists = newConversations.find(conv => 
        conv.conversation_id === currentActiveConversation
      );
      if (currentStillExists) {
        return null; // Keep current selection
      }
    }
    
    // Check if we have new unread conversations
    const hasNewUnread = newConversations.some(conv => 
      unreadMessages[conv.conversation_id] === true
    );
    
    if (hasNewUnread || !currentActiveConversation) {
      return getSmartInitialConversation();
    }
    
    return null;
  }, [unreadMessages, getSmartInitialConversation]);
  
  // Function to check if conversations have materially changed
  const haveConversationsChanged = useCallback((newConversations) => {
    if (newConversations.length !== lastInitializedConversations.length) {
      return true;
    }
    
    // Check if any conversation IDs have changed
    const newIds = new Set(newConversations.map(conv => conv.conversation_id));
    const oldIds = new Set(lastInitializedConversations.map(conv => conv.conversation_id));
    
    for (const id of newIds) {
      if (!oldIds.has(id)) return true;
    }
    
    for (const id of oldIds) {
      if (!newIds.has(id)) return true;
    }
    
    return false;
  }, [lastInitializedConversations]);
  
  // Update last initialized conversations when they change
  useEffect(() => {
    if (conversations && conversations.length > 0 && haveConversationsChanged(conversations)) {
      setLastInitializedConversations([...conversations]);
    }
  }, [conversations, haveConversationsChanged]);
  
  // Enhanced logging for development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Conversation Manager: ${sortedConversations.length} conversations, ${totalUnreadCount} unread`);
    }
  }, [sortedConversations.length, totalUnreadCount]);
  
  return {
    // Computed values
    sortedConversations,
    totalUnreadCount,
    
    // Functions
    getSmartInitialConversation,
    persistConversation,
    clearPersistence,
    getConversationClasses,
    getConversationByUserId,
    getOtherParticipant,
    getValidStoredConversation,
    shouldAutoSelectConversation,
    haveConversationsChanged,
    
    // Utility functions
    updateBrowserTitle: (count) => updateBrowserTitle(count, baseTitle),
    
    // State indicators
    hasConversations: sortedConversations.length > 0,
    hasUnreadMessages: totalUnreadCount > 0,
    
    // Performance data for debugging
    performanceData: {
      conversationCount: sortedConversations.length,
      unreadCount: totalUnreadCount,
      lastUpdate: Date.now()
    }
  };
};

export default useConversationManager; 