import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { FaEye, FaEyeSlash, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import './register.css';

const Register = ({ setAuth }) => {
  const [inputs, setInputs] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "",
  });
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [currentSlide, setCurrentSlide] = useState(0);
  const [registrationStep, setRegistrationStep] = useState(1); // 1: form, 2: verification
  const [userData, setUserData] = useState(null); // Store user data between steps
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [resendCooldown, setResendCooldown] = useState(0); // Cooldown for resend button
  const navigate = useNavigate();

  // Carousel content
  const carouselContent = [
    {
      image: "/InstantMessaging.svg",
      title: "Instant Messaging",
      description: "Communicate directly with classmates and professors through secure, real-time chat"
    },
    {
      image: "/CommunityCollaboration.svg",
      title: "Community Collaboration",
      description: "Engage with professors and fellow students in a collaborative and supportive learning environment."
    },
    {
      image: "/CourseAnnouncements.svg",
      title: "Course Announcements",
      description: "Stay informed with timely announcements and updates from Professors"
    }
  ];

  // Automatic carousel transition
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => 
        prev === carouselContent.length - 1 ? 0 : prev + 1
      );
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [carouselContent.length]);

  // Countdown timer for verification code
  useEffect(() => {
    let timer;
    if (registrationStep === 2 && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [registrationStep, timeLeft]);

  // Resend cooldown timer
  useEffect(() => {
    let cooldownTimer;
    if (resendCooldown > 0) {
      cooldownTimer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(cooldownTimer);
  }, [resendCooldown]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev === carouselContent.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? carouselContent.length - 1 : prev - 1));
  };

  const { email, first_name, last_name, role, password } = inputs;

  const onChange = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
    
    // Clear any existing errors when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateNameField = (name) => {
    // Allow letters, spaces, hyphens, apostrophes, and special characters like ñ, é, etc.
    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
    return nameRegex.test(name);
  };

  const validateEmail = (email) => {
    // Email validation regex
    const emailRegex = /^[a-zA-Z0-9][a-zA-Z0-9._-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    // Password must be at least 8 characters with at least one uppercase, one number, and one special character
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
    return regex.test(password);
  };

  const validateForm = () => {
    let hasErrors = false;
    let updatedInputs = { ...inputs };
    
    if (first_name.trim() === '') {
      setFormErrors(prev => ({ ...prev, first_name: 'First name is required' }));
      hasErrors = true;
    } else if (!validateNameField(first_name)) {
      setFormErrors(prev => ({ ...prev, first_name: 'First name can only contain letters and special characters' }));
      updatedInputs.first_name = "";
      hasErrors = true;
      toast.error('First name can only contain letters and special characters');
    }
    
    if (last_name.trim() === '') {
      setFormErrors(prev => ({ ...prev, last_name: 'Last name is required' }));
      hasErrors = true;
    } else if (!validateNameField(last_name)) {
      setFormErrors(prev => ({ ...prev, last_name: 'Last name can only contain letters and special characters' }));
      updatedInputs.last_name = "";
      hasErrors = true;
      toast.error('Last name can only contain letters and special characters');
    }
    
    if (email.trim() === '') {
      setFormErrors(prev => ({ ...prev, email: 'Email is required' }));
      hasErrors = true;
    } else if (!validateEmail(email)) {
      setFormErrors(prev => ({ ...prev, email: 'Invalid email format' }));
      updatedInputs.email = "";
      hasErrors = true;
      toast.error('Invalid email format. Please try again.');
    }
    
    if (password.trim() === '') {
      setFormErrors(prev => ({ ...prev, password: 'Password is required' }));
      hasErrors = true;
    } else if (!validatePassword(password)) {
      setFormErrors(prev => ({ ...prev, password: 'Password must include uppercase, number, and special character' }));
      updatedInputs.password = "";
      hasErrors = true;
      toast.error('Password must include uppercase, number, and special character');
    }
    
    if (role.trim() === '') {
      setFormErrors(prev => ({ ...prev, role: 'Please select a role' }));
      hasErrors = true;
    }
    
    // Update inputs with cleared values
    setInputs(updatedInputs);
    
    return !hasErrors;
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const onSubmitForm = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error("Please fix the errors before submitting.");
      return;
    }
    
    setLoading(true);
    try {
      const body = { email, first_name, last_name, role, password };
      const response = await fetch("http://localhost:5000/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const parseRes = await response.json();

      if (response.ok) {
        setUserData(parseRes);
        setRegistrationStep(2);
        setTimeLeft(300); // Reset timer to 5 minutes
        setResendCooldown(0);
        toast.success("Verification code sent to your email! 📧");
      } else {
        toast.error(parseRes.error || "Registration failed. Try again.");
      }
    } catch (err) {
      console.error(err.message);
      toast.error("Something went wrong! ❌");
    } finally {
      setLoading(false);
    }
  };

  const onSubmitVerification = async (e) => {
    e.preventDefault();
    
    if (!verificationCode.trim()) {
      toast.error("Please enter the verification code");
      return;
    }

    if (timeLeft === 0) {
      toast.error("Verification code has expired. Please request a new one.");
      return;
    }
    
    setLoading(true);
    try {
      const body = {
        email: userData.email,
        verificationCode: verificationCode,
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role,
        password: userData.password
      };
      
      const response = await fetch("http://localhost:5000/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const parseRes = await response.json();

      if (parseRes.jwtToken) {
        localStorage.setItem("token", parseRes.jwtToken);
        setAuth(true);
        toast.success("Email verified and account created successfully! 🎉");
        navigate("/dashboard", { replace: true });
      } else {
        toast.error(parseRes.error || "Verification failed. Try again.");
      }
    } catch (err) {
      console.error(err.message);
      toast.error("Something went wrong! ❌");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!userData || resendCooldown > 0) return;
    
    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userData.email,
          first_name: userData.first_name
        }),
      });

      const parseRes = await response.json();

      if (response.ok) {
        setTimeLeft(300); // Reset timer to 5 minutes
        setResendCooldown(30); // 30 second cooldown
        setVerificationCode(""); // Clear the input
        toast.success("New verification code sent! 📧");
      } else {
        toast.error(parseRes.error || "Failed to resend code. Try again.");
      }
    } catch (err) {
      console.error(err.message);
      toast.error("Something went wrong! ❌");
    } finally {
      setLoading(false);
    }
  };

  const goBackToForm = () => {
    setRegistrationStep(1);
    setVerificationCode("");
    setUserData(null);
    setTimeLeft(300);
    setResendCooldown(0);
  };

  // Render verification step
  if (registrationStep === 2) {
    return (
      <div className="container">
        <div className="info-section">
          <div className="solar">
            <i className="mercury"></i>
            <i className="venus"></i>
            <i className="earth"></i>
            <i className="mars"></i>
            <i className="belt"></i>
            <i className="jupiter"></i>
            <i className="saturn"></i>
            <i className="uranus"></i>
            <i className="neptune"></i>
          </div>
          <h1>Verify Your Email</h1>
          <p className="subtitle">Almost there! Check your email for the verification code</p>
        </div>
        <div className="form-section">
          <div className="form-container">
            <h2>Enter Verification Code</h2>
            <p className="verification-info">
              We've sent a 6-digit verification code to <strong>{userData?.email}</strong>
            </p>
            
            {/* Countdown Timer */}
            <div className="countdown-timer">
              <div className={`timer-display ${timeLeft <= 60 ? 'warning' : ''} ${timeLeft === 0 ? 'expired' : ''}`}>
                <span className="timer-label">Code expires in:</span>
                <span className="timer-value">{formatTime(timeLeft)}</span>
              </div>
              {timeLeft === 0 && (
                <div className="expired-warning">
                  ⚠️ Code has expired. Please request a new one.
                </div>
              )}
            </div>

            <form onSubmit={onSubmitVerification}>
              <div className="form-group">
                <label htmlFor="verificationCode">Verification Code</label>
                <input
                  type="text"
                  id="verificationCode"
                  className="verification-code-input"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="000000"
                  maxLength="6"
                  disabled={timeLeft === 0}
                  required
                />
              </div>
              <button type="submit" className="submit-button" disabled={loading || timeLeft === 0}>
                {loading ? "Verifying..." : "Verify & Create Account"}
              </button>
            </form>
            
            <div className="verification-actions">
              <p>
                Didn't receive the code?
              </p>
              <button 
                onClick={handleResendCode} 
                disabled={loading || resendCooldown > 0}
                className="resend-code-btn"
              >
                {resendCooldown > 0 
                  ? `Resend in ${resendCooldown}s` 
                  : "Resend Code"
                }
              </button>
            </div>
            
            <div className="verification-actions">
              <button 
                onClick={goBackToForm}
                className="back-btn"
              >
                ← Back to registration form
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render registration form (step 1)
  return (
    <div className="container">
      <div className="info-section">
        <div className="solar">
          <i className="mercury"></i>
          <i className="venus"></i>
          <i className="earth"></i>
          <i className="mars"></i>
          <i className="belt"></i>
          <i className="jupiter"></i>
          <i className="saturn"></i>
          <i className="uranus"></i>
          <i className="neptune"></i>
        </div>
        <h1>Join Nova</h1>
        <p className="subtitle">Start your journey to academic excellence</p>

        <div className="carousel-container">
          <div className="carousel-slides" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
            {carouselContent.map((slide, index) => (
              <div key={index} className="carousel-slide">
                <div className="image-wrapper">
                  {/* Image removed */}
                </div>
                <div className="text-wrapper">
                  <h3>{slide.title}</h3>
                  <p>{slide.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="form-section">
        <div className="form-container">
          <h2>Create your account</h2>
          <form onSubmit={onSubmitForm}>
            <div className={`form-group ${formErrors.email ? 'error' : ''}`}>
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={onChange}
                placeholder="Enter your email"
                required
              />
              {formErrors.email && <div className="error-message">{formErrors.email}</div>}
            </div>
            <div className={`form-group ${formErrors.first_name ? 'error' : ''}`}>
              <label htmlFor="first_name">First Name</label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={first_name}
                onChange={onChange}
                placeholder="Enter your first name"
                required
              />
              {formErrors.first_name && <div className="error-message">{formErrors.first_name}</div>}
            </div>
            <div className={`form-group ${formErrors.last_name ? 'error' : ''}`}>
              <label htmlFor="last_name">Last Name</label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={last_name}
                onChange={onChange}
                placeholder="Enter your last name"
                required
              />
              {formErrors.last_name && <div className="error-message">{formErrors.last_name}</div>}
            </div>
            <div className={`form-group password-group ${formErrors.password ? 'error' : ''}`}>
              <label htmlFor="password">Password</label>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={password}
                onChange={onChange}
                placeholder="Create a password"
                required
                minLength="8"
              />
              <span className="toggle-password" onClick={() => setShowPassword((prev) => !prev)}>
              {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
              {formErrors.password && <div className="error-message">{formErrors.password}</div>}
            </div>
            <div>
              <p className="password-requirements">
                Password must be at least 8 characters and include:
                <ul>
                  <li>At least one uppercase letter</li>
                  <li>At least one number</li>
                  <li>At least one special character (!@#$%^&*)</li>
                </ul>
              </p>
            </div>
            <div className={`form-group ${formErrors.role ? 'error' : ''}`}>
              <label htmlFor="role">I am a:</label>
              <select
                id="role"
                name="role"
                value={role}
                onChange={onChange}
                required
              >
                <option value="">Select your role</option>
                <option value="student">Student</option>
                <option value="professor">Professor</option>
              </select>
              {formErrors.role && <div className="error-message">{formErrors.role}</div>}
            </div>
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? "Sending Verification Code..." : "Continue to Verification"}
            </button>
          </form>
          <p className="reg-footer">
            Already have an account?{" "}
            <Link to="/login" className="link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
