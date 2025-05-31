import React from 'react';
import { HiOutlineBell } from 'react-icons/hi';
import './dashboard.css';

export default function NotificationPreferences() {
  return (
    <div className="notification-preferences">
      <div className="preferences-header">
        <HiOutlineBell className="preferences-icon" />
        <h2>Notification Status</h2>
      </div>
      
      <div className="notification-status-message">
        <p>All notifications are now enabled for authorized users.</p>
        <p>Individual notification preferences are no longer configurable.</p>
      </div>
    </div>
  );
} 