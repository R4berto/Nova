const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const authorization = require('../middleware/authorization');

// Get user notifications
router.get('/', authorization, async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const notifications = await notificationService.getUserNotifications(
      req.user.id,
      parseInt(limit) || 50,
      parseInt(offset) || 0
    );
    res.json(notifications);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark notification as read
router.put('/:id/read', authorization, async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id,
      req.user.id
    );
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json(notification);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark all notifications as read
router.put('/read-all', authorization, async (req, res) => {
  try {
    await notificationService.markAllAsRead(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Clear all notifications
router.delete('/clear-all', authorization, async (req, res) => {
  try {
    await notificationService.clearAllNotifications(req.user.id);
    res.json({ message: 'All notifications cleared' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update notification preferences
router.put('/preferences', authorization, async (req, res) => {
  try {
    const preferences = await notificationService.updatePreferences(
      req.user.id,
      req.body
    );
    res.json(preferences);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get notification preferences
router.get('/preferences', authorization, async (req, res) => {
  try {
    const preferences = await notificationService.getPreferences(req.user.id);
    res.json(preferences);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 