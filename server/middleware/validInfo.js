module.exports = function (req, res, next) {
    const { email, first_name, last_name, password, role } = req.body;
  
    function validEmail(userEmail) {
      return /^[a-zA-Z0-9][a-zA-Z0-9._-]*@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(userEmail);
    }
    
    function validPassword(password) {
      // Password must be 8-16 characters with at least one uppercase, one number, and one special character
      return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,16}$/.test(password);
    }
    
  // Validation of info
    if (req.path === "/register") {
      if (![email, first_name, last_name, password, role].every(Boolean)) {
        return res.status(400).json({ error: "Missing credentials" });
      }
      if (!validEmail(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      if (!validPassword(password)) {
        return res.status(400).json({ error: "Password must be 8-16 characters and include uppercase, lowercase, number, and special character" });
      }
      if (!["student", "professor"].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be 'student' or 'professor'" });
      }
    } else if (req.path === "/login") {
      if (![email, password].every(Boolean)) {
        return res.status(400).json({ error: "Missing credentials" });
      }
      if (!validEmail(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
    }
  
    next();
  };
  