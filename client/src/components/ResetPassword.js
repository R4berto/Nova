import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Extract token from URL query params
    const queryParams = new URLSearchParams(location.search);
    const tokenFromUrl = queryParams.get('token');
    
    if (!tokenFromUrl) {
      toast.error('No reset token provided. Please request a new password reset link.');
      setValidatingToken(false);
      return;
    }
    
    setToken(tokenFromUrl);
    
    // Verify the token
    const verifyToken = async () => {
      try {
        const response = await fetch(`http://localhost:5000/auth/verify-reset-token/${tokenFromUrl}`, {
          method: "GET",
          headers: { 
            "Accept": "application/json"
          }
        });

        const parseRes = await response.json();
        
        if (response.ok && parseRes.valid) {
          setValidToken(true);
        } else {
          toast.error(parseRes.error || 'This reset link is invalid or has expired. Please request a new one.');
        }
      } catch (err) {
        console.error("Token verification error:", err);
        toast.error('This reset link is invalid or has expired. Please request a new one.');
      } finally {
        setValidatingToken(false);
      }
    };
    
    verifyToken();
  }, [location]);

  const validatePassword = (password) => {
    // Password must have at least 8 characters, one uppercase, one number, and one special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
    return passwordRegex.test(password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate passwords match
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    
    // Validate password strength
    if (!validatePassword(password)) {
      toast.error('Password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch("http://localhost:5000/auth/reset-password", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ token, password }),
      });

      const parseRes = await response.json();
      
      if (response.ok) {
        toast.success(parseRes.message || "Password has been reset successfully");
        
        // Redirect to login after successful reset
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        toast.error(parseRes.error || "Failed to reset password. Please try again.");
      }
    } catch (err) {
      console.error("Reset password error:", err);
      toast.error("Something went wrong. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  if (validatingToken) {
    return (
      <div className="container">
        <div className="form-section full-width">
          <div className="form-container">
            <h2>Reset Password</h2>
            <p>Verifying your reset token...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div className="container">
        <div className="form-section full-width">
          <div className="form-container">
            <h2>Reset Password</h2>
            <div className="form-links">
              <Link to="/forgot-password" className="link">Request a new reset link</Link>
              <Link to="/login" className="link">Back to Login</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="form-section full-width">
        <div className="form-container">
          <h2>Reset Password</h2>
          <p>Enter your new password below.</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group password-group">
              <label htmlFor="password">New Password</label>
              <div className="password-input-container">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength="8"
                  autoComplete="new-password"
                  className="password-input"
                />
                <span className="toggle-password resetpw-toggle" onClick={() => setShowPassword((prev) => !prev)}>
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
            </div>

            <div>
              <p className="help-text">
                Password must be at least 8 characters and include:
                <ul>
                  <li>At least one uppercase letter</li>
                  <li>At least one number</li>
                  <li>At least one special character (!@#$%^&*)</li>
                </ul>
              </p>
            </div>
            
            <div className="form-group password-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="password-input-container">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength="8"
                  autoComplete="new-password"
                  className="password-input"
                />
                <span className="toggle-password resetpw-toggle" onClick={() => setShowConfirmPassword((prev) => !prev)}>
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
            </div>

            <button 
              type="submit" 
              className="submit-button"
              disabled={loading}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          <p className="login-footer">
            <Link to="/login" className="link">Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword; 