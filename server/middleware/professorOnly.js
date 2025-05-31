/**
 * Middleware to restrict access to professor users only
 */
module.exports = function(req, res, next) {
  try {
    // Check if user exists and has a role property
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Check if user is a professor
    if (req.user.role !== "professor") {
      return res.status(403).json({ error: "Access denied. Professor privileges required." });
    }
    
    // User is a professor, proceed to the next middleware/route handler
    next();
  } catch (err) {
    console.error("Professor authorization error:", err.message);
    return res.status(500).json({ error: "Server error" });
  }
}; 