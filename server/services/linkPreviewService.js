const fetch = require('node-fetch');
const NodeCache = require('node-cache');
const pool = require('../db');
const cheerio = require('cheerio');
const urlRegex = /(https?:\/\/[^\s]+)/g;

// Create a cache with TTL of 24 hours
const linkPreviewCache = new NodeCache({ stdTTL: 86400 });

/**
 * Extract URLs from message content
 * @param {string} content - The message content
 * @returns {Array} - Array of URLs found in the content
 */
const extractUrls = (content) => {
  if (!content) return [];
  
  const matches = content.match(urlRegex);
  return matches || [];
};

/**
 * Fetch metadata from a URL
 * @param {string} url - The URL to fetch metadata from
 * @returns {Promise<Object>} - The metadata object
 */
const fetchUrlMetadata = async (url) => {
  try {
    // Check cache first
    const cachedData = linkPreviewCache.get(url);
    if (cachedData) {
      return cachedData;
    }
    
    // Fetch URL with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }
    
    // Get content type
    const contentType = response.headers.get('content-type') || '';
    
    // Only process HTML content
    if (!contentType.includes('text/html')) {
      const metadata = {
        url,
        contentType,
        title: url,
        description: 'Non-HTML content',
        image: null
      };
      
      linkPreviewCache.set(url, metadata);
      return metadata;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract metadata
    const metadata = {
      url,
      contentType,
      title: $('title').text() || $('meta[property="og:title"]').attr('content') || url,
      description: $('meta[name="description"]').attr('content') || 
                  $('meta[property="og:description"]').attr('content') || '',
      image: $('meta[property="og:image"]').attr('content') || 
             $('meta[property="twitter:image"]').attr('content') || null
    };
    
    // Trim and clean description
    if (metadata.description) {
      metadata.description = metadata.description.substring(0, 200);
      if (metadata.description.length === 200) {
        metadata.description += '...';
      }
    }
    
    // Cache the result
    linkPreviewCache.set(url, metadata);
    
    return metadata;
    
  } catch (err) {
    console.error(`Error fetching URL metadata for ${url}:`, err);
    
    // Return minimal metadata on error
    const errorMetadata = {
      url,
      contentType: 'text/html',
      title: url,
      description: 'Unable to fetch preview',
      image: null,
      error: true
    };
    
    // Cache error results for a shorter time (1 hour)
    linkPreviewCache.set(url, errorMetadata, 3600);
    
    return errorMetadata;
  }
};

/**
 * Process message content for link previews
 * @param {string} content - The message content
 * @returns {Promise<Array>} - Array of link preview metadata
 */
const processMessageLinks = async (content) => {
  const urls = extractUrls(content);
  
  // Only process first URL to avoid overloading
  if (urls.length === 0) return [];
  
  try {
    const metadata = await fetchUrlMetadata(urls[0]);
    return [metadata];
  } catch (err) {
    console.error('Error processing message links:', err);
    return [];
  }
};

/**
 * Validate a URL for security
 * @param {string} url - The URL to validate
 * @returns {boolean} - Whether the URL is valid and safe
 */
const validateUrl = (url) => {
  try {
    const parsed = new URL(url);
    
    // Check for blocked protocols
    const blockedProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    if (blockedProtocols.some(protocol => parsed.protocol.startsWith(protocol))) {
      return false;
    }
    
    // Additional security checks could be added here
    
    return true;
  } catch (err) {
    return false;
  }
};

module.exports = {
  processMessageLinks,
  validateUrl,
  extractUrls
}; 