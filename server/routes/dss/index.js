const express = require('express');
const router = express.Router();
const examAnalytics = require('./examAnalytics');

// Map all DSS routes
router.use('/exams', examAnalytics);

module.exports = router; 