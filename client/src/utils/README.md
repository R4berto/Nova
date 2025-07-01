# Smart Conversation Management System

This system provides intelligent conversation selection, persistence, and enhanced user experience for the private messaging feature.

## Features

### 🎯 Smart Conversation Selection
The system automatically selects the most relevant conversation when the user opens messages:

1. **Navigation Persistence**: Prioritizes your last active conversation when returning from other pages
2. **Smart Unread Priority**: Only switches to unread messages if they're newer than your last activity  
3. **Fallback**: Shows the most recent conversation if no saved context exists

This ensures that when you open River Joseph's conversation, go to the dashboard, and return to messages - River Joseph will still be selected unless there are newer unread messages.

### 💾 Enhanced Cross-Navigation Persistence
- **Extended Persistence**: Saves conversations for up to 7 days (vs 24 hours) for better navigation continuity
- **Smart Resumption**: When returning from dashboard/other pages, restores your last active conversation (e.g., River Joseph)
- **Intelligent Unread Handling**: Only switches to unread messages if they're newer than your last activity
- **Navigation Context**: Maintains conversation state across app navigation for seamless user experience
- **Privacy Protection**: Clears persistence on logout

### 🎨 Enhanced Visual Indicators
- **Urgent Unread**: Blue left border and enhanced styling for unread conversations
- **Pulse Animation**: Subtle pulse effect for unread conversations that aren't active
- **Glowing Indicators**: Animated unread dots with glow effects
- **Priority Styling**: High-priority conversations get red indicators
- **Browser Title**: Shows unread count in browser tab like "(3) Nova - Messages"

### ⚡ Performance Optimizations
- Memoized sorting to avoid re-sorting on every render
- Optimized Date.parse() instead of new Date() objects
- Will-change CSS properties for smooth animations
- Reduced motion support for accessibility

## Files

### Core Utilities
- `conversationManager.js` - Core utilities and functions
- `useConversationManager.js` - React hook for easy integration
- `ConversationManagerStyles.css` - Enhanced styling

### Integration
The system is integrated into `PrivateMessages.js` component through the `useConversationManager` hook.

## Usage

```javascript
import { useConversationManager } from '../../hooks/useConversationManager';

const MyComponent = ({ conversations, unreadMessages, userProfile }) => {
  const conversationManager = useConversationManager(
    conversations,
    unreadMessages,
    userProfile,
    'My App - Messages'
  );

  const {
    sortedConversations,
    totalUnreadCount,
    getSmartInitialConversation,
    persistConversation,
    getConversationClasses
  } = conversationManager;

  // Use the utilities as needed
};
```

## Smart Selection Logic

### Priority Order:
1. **Last Active Conversation** - Previously selected conversation (within 7 days) for navigation continuity
2. **Newer Unread Messages** - Only switch to unread if messages arrived after last active time
3. **Most Recent** - Conversation with the latest message timestamp

### Example Scenarios:

**Scenario 1**: User was in River Joseph's conversation, goes to dashboard, returns to messages
- ✅ **Result**: Restores River Joseph conversation (enhanced navigation persistence)

**Scenario 2**: User was in River Joseph's conversation, then Sarah sends a new message
- ✅ **Result**: Switches to Sarah's conversation (newer unread message)

**Scenario 3**: No saved context or expired persistence
- ✅ **Result**: Shows most recent conversation

## Browser Title Updates

The system automatically updates the browser title:
- `"Nova - Private Messages"` (no unread)
- `"(3) Nova - Private Messages"` (3 unread messages)

## Performance Considerations

- Conversations are sorted only when the underlying data changes
- CSS animations are disabled on mobile for better performance
- Reduced motion preferences are respected
- Smart memoization prevents unnecessary re-renders

## Accessibility

- ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader friendly unread indicators
- High contrast support for unread states
- Reduced motion support for users with vestibular disorders

## Configuration

The system can be customized through the `conversationManager.js` utilities:

- Persistence timeout (default: 24 hours)
- High priority thresholds
- Animation preferences
- Color schemes

## Browser Support

- All modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile responsive design
- Graceful degradation for older browsers 