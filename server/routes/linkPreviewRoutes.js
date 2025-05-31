const express = require('express');
const router = express.Router();
const authorization = require('../middleware/authorization');
const { processMessageLinks, validateUrl } = require('../services/linkPreviewService');

// Middleware to check if user is logged in
router.use(authorization);

/**
 * @route   GET /api/links/validate
 * @desc    Validate a URL for security
 * @access  Private
 */
router.get('/validate', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    const isValid = validateUrl(url);
    
    return res.json({ url, isValid });
  } catch (err) {
    console.error('Error validating URL:', err);
    return res.status(500).json({ error: 'Server error validating URL' });
  }
});

/**
 * @route   GET /api/links/preview
 * @desc    Get preview metadata for a URL
 * @access  Private
 */
router.get('/preview', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Validate URL first
    const isValid = validateUrl(url);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or unsafe URL' });
    }
    
    // Get metadata for the URL
    const [metadata] = await processMessageLinks(url);
    
    if (!metadata) {
      return res.status(404).json({ error: 'Could not generate preview for this URL' });
    }
    
    return res.json(metadata);
  } catch (err) {
    console.error('Error generating URL preview:', err);
    return res.status(500).json({ error: 'Server error generating URL preview' });
  }
});

module.exports = router; 