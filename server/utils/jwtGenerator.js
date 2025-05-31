const jwt = require("jsonwebtoken");
require("dotenv").config();

function jwtGenerator(user_id, role) {
  const payload = {
    user: {
      id: user_id,
      role: role
    }
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "24h" });
}

module.exports = jwtGenerator;
