const jwt = require("jsonwebtoken");
require("dotenv").config();

module.exports = function (req, res, next) {
  // Get token from header
  const token = req.header("jwt_token"); // Ensure you're using the correct header key

  // Check if token exists
  if (!token) {
    return res.status(403).json({ msg: "Authorization denied, no token" });
  }

  try {
    // Verify token
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified.user;
    next();
  } catch (err) {
    console.error("JWT Verification Error:", err.message);
    return res.status(401).json({ msg: "Token is not valid" });
  }
};
