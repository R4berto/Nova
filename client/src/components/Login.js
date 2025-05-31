import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import toast from "react-hot-toast";
import './login.css';

const Login = ({ setAuth }) => {
  const [inputs, setInputs] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [formErrors, setFormErrors] = useState({});

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const token = localStorage.getItem("token");
        if (token) {
          const response = await fetch("http://localhost:5000/auth/is-verify", {
            method: "GET",
            headers: { jwt_token: token }
          });
          const parseRes = await response.json();
          
          // If authenticated, redirect to dashboard
          if (parseRes === true) {
            navigate("/dashboard");
          }
        }
      } catch (err) {
        console.error("Error checking authentication status:", err.message);
      }
    };
    
    checkAuthentication();
  }, [navigate]);

  // Carousel content
  const carouselContent = [
    {
      image: "/learning.svg",
      title: "Interactive Classrooms",
      description: "Join organized virtual classrooms where assignments, materials, and feedback flow seamlessly between students and Professors"
    },
    {
      image: "/Assignments.svg",
      title: "Streamlined Assignments",
      description: "Receive, submit, and track assignments with ease—all in one organized hub"
    },
    {
      image: "/Resources.svg",
      title: "Centralized Resources",
      description: "Access all class materials, reference links, and multimedia resources in one place"
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

  const { email, password } = inputs;

  // Email validation function
  const validateEmail = (email) => {
    // Email validation regex
    const emailRegex = /^[a-zA-Z0-9][a-zA-Z0-9._-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setInputs({ ...inputs, [name]: value });
    
    // Clear existing errors when typing
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const onSubmitForm = async (e) => {
    e.preventDefault();
    
    // Validate before submitting
    let hasErrors = false;
    let updatedInputs = { ...inputs };
    
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
    }
    
    // Update inputs with cleared values
    setInputs(updatedInputs);
    
    if (hasErrors) {
      toast.error("Please fix the errors before submitting.");
      return;
    }
    
    setLoading(true);
    
    try {
      console.log("Attempting login with:", { email });
      
      const response = await fetch("http://localhost:5000/auth/login", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ email, password }),
      });

      const parseRes = await response.json();
      console.log("Login response:", parseRes);

      if (response.ok) {
        if (!parseRes.jwtToken) {
          throw new Error("No token received from server");
        }
        
        localStorage.setItem("token", parseRes.jwtToken);
        setAuth(true);
        toast.success("Logged in Successfully!");
        
        // Navigate to the page they were trying to access, or dashboard if direct login
        const from = location.state?.from?.pathname || "/dashboard";
        navigate(from, { replace: true });
      } else {
        setAuth(false);
        // Auto-clear both fields on failed login
        setInputs({ email: "", password: "" });
        toast.error(parseRes.error || "Login failed. Please try again.");
      }
    } catch (err) {
      console.error("Login error:", err);
      // Auto-clear both fields on error
      setInputs({ email: "", password: "" });
      toast.error(err.message || "Something went wrong. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="info-section">
        <div className="logo-wrapper">
          <img src="/logo.png" alt="Nova Logo" className="nova-logo" />
        </div>
        <h1>Welcome to Nova</h1>
        <p className="subtitle">Your path to excellence in learning</p>
        
        <div className="carousel-container">
          <div className="carousel-slides" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
            {carouselContent.map((slide, index) => (
              <div key={index} className="carousel-slide">
                <div className="image-wrapper">
                  <img src={slide.image} alt={slide.title} />
                </div>
                <div className="text-wrapper">
                  <h3>{slide.title}</h3>
                  <p>{slide.description}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="carousel-dots-container">
            <div className="carousel-dots">
              {carouselContent.map((_, index) => (
                <span 
                  key={index} 
                  className={`carousel-dot ${index === currentSlide ? "active" : ""}`}
                  onClick={() => setCurrentSlide(index)}
                ></span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="form-section">
        <div className="form-container">
          <h2>Welcome</h2>
          <form onSubmit={onSubmitForm}>
            <div className={`form-group ${formErrors.email ? 'error' : ''}`}>
              <label htmlFor="email">Email address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={onChange}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
              {formErrors.email && <div className="error-message">{formErrors.email}</div>}
            </div>
            <div className={`form-group password-group ${formErrors.password ? 'error' : ''}`}>
              <label htmlFor="password">Password</label>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={password}
                onChange={onChange}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                className="password-input"
              />
              <span className="toggle-password" onClick={() => setShowPassword((prev) => !prev)}>
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
              {formErrors.password && <div className="error-message">{formErrors.password}</div>}
            </div>
            <button type="submit" className="submit-button" disabled={loading}>
              Sign in
            </button>
          </form>
          <p className="login-footer">
            New to Nova?{" "}
            <Link to="/register" className="link">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
