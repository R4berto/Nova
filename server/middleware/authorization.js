const jwt = require("jsonwebtoken");
require("dotenv").config();

module.exports = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header("jwt_token");

    // Check if no token
    if (!token) {
      return res.status(403).json("Not Authorized");
    }

    // Verify token
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Add user info to request
    req.user = payload.user;
    
    next();
  } catch (err) {
    console.error(err.message);
    return res.status(403).json("Not Authorized");
  }
}; 