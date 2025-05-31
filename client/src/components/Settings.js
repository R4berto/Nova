/* eslint-disable no-unused-vars, no-useless-escape */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaBars, FaTimes, FaHome, FaGraduationCap, FaSignOutAlt, FaCog, FaComments, 
  FaChevronDown, FaUser, FaKey, FaHistory, FaEdit, FaSave, FaCamera, FaEye, FaEyeSlash } from "react-icons/fa";
import toast from "react-hot-toast";
import "./dashboard.css";
import "./settings.css";
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import Sidebar from './Sidebar';
import LoadingIndicator from './common/LoadingIndicator';

import 'react-image-crop/dist/ReactCrop.css';

export default function Settings({ setAuth }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Try to get the sidebar state from localStorage
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState === "true";
  });
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [courseHistory, setCourseHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coursesSubmenuOpen, setCoursesSubmenuOpen] = useState(false);
  
  // Image cropping state
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [zoom, setZoom] = useState(1);
  const imgRef = useRef(null);
  const cropAreaRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Image drag state for crop positioning
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // User profile state
  const [profile, setProfile] = useState({
    user_id: "",
    first_name: "",
    last_name: "",
    email: "",
    role: "",
    avatar: null
  });
  
  const [originalProfile, setOriginalProfile] = useState({
    user_id: "",
    first_name: "",
    last_name: "",
    email: "",
    role: "",
    avatar: null
  });
  
  // Password change state
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
  });
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); //Toogle show password

  
  // Form edit states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  // Form validation states
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  
  // Add validateNameField function to prevent numbers but allow special characters
  const validateNameField = (name, fieldName) => {
    // Allow letters, spaces, hyphens, apostrophes, and special characters like ñ, é, etc.
    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
    if (!nameRegex.test(name)) {
      setFormErrors(prev => ({
        ...prev,
        [fieldName]: `${fieldName === 'first_name' ? 'First Name' : 'Last Name'} cannot contain numbers`
      }));
      return false;
    }
    return true;
  };

  // Add email validation function
  const validateEmail = (email) => {
    // Split email into local part and domain
    const [localPart, domain] = email.split('@');
    
    // Check if email has @ symbol
    if (!domain) {
      return true; // Allow typing before adding @
    }

    // Check if local part contains at least one letter
    const hasLetter = /[a-zA-Z]/.test(localPart);
    if (!hasLetter) {
      setFormErrors(prev => ({
        ...prev,
        email: 'Email must contain at least one letter before @'
      }));
      return false;
    }

    // Updated regex to allow ., -, and _ in local part
    const localPartRegex = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
    if (!localPartRegex.test(localPart)) {
      setFormErrors(prev => ({
        ...prev,
        email: 'Email can only contain letters, numbers, dots, hyphens, and underscores before @'
      }));
      return false;
    }
    
    return true;
  };

  // Get user profile data
  const getProfile = async () => {
    try {
      const res = await fetch("http://localhost:5000/dashboard/", {
        method: "GET",
        headers: { jwt_token: localStorage.token }
      });

      const parseData = await res.json();
      const profileData = {
        first_name: parseData.first_name,
        last_name: parseData.last_name,
        email: parseData.email || "",
        avatar: parseData.profile_picture_url || null,
        role: parseData.role
      };
      setProfile(profileData);
      setOriginalProfile(profileData);
      setUserRole(parseData.role);
    } catch (err) {
      console.error("Error fetching profile:", err.message);
      toast.error("Failed to load profile information");
    }
  };

  // Fetch user course history
  const fetchCourseHistory = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      // Different endpoints based on user role
      const endpoint = userRole === "professor" 
        ? "http://localhost:5000/courses/professor"
        : "http://localhost:5000/enrollment/student-courses";
      
      const response = await fetch(endpoint, {
        headers: {
          jwt_token: token
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
          return;
        }
        throw new Error('Failed to fetch course history');
      }
      
      const data = await response.json();
      setCourseHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err.message);
      toast.error("Failed to load course history");
      setCourseHistory([]);
    } finally {
      setLoading(false);
    }
  }, [userRole, navigate]);

  useEffect(() => {
    getProfile();
  }, []);

  useEffect(() => {
    if (userRole) {
      fetchCourseHistory();
    }
  }, [userRole, fetchCourseHistory]);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  // Handle profile form changes
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    
    // Clear any existing errors when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
    
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    if (isEditingProfile) {
      const hasChanges = 
        profile.first_name !== originalProfile.first_name ||
        profile.last_name !== originalProfile.last_name ||
        profile.email !== originalProfile.email;

      if (hasChanges) {
        if (window.confirm('Are you sure you want to discard your changes?')) {
          setProfile(originalProfile);
          setIsEditingProfile(false);
          setFormErrors({});
        }
      } else {
        setIsEditingProfile(false);
        setFormErrors({});
      }
    }
  };

  // Handle profile form submission
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setIsSubmitting(true);
    setUpdateSuccess(false);
    setUpdateError(null);
    
    // Create copy of profile for validation
    let updatedProfile = { ...profile };
    let hasErrors = false;

    // Validate first name
    if (!validateNameField(profile.first_name, 'first_name')) {
      updatedProfile.first_name = "";
      hasErrors = true;
      toast.error('Invalid first name or empty field');
    }
    
    // Validate last name
    if (!validateNameField(profile.last_name, 'last_name')) {
      updatedProfile.last_name = "";
      hasErrors = true;
      toast.error('Invalid last name or empty field');
    }

    // Validate email
    if (!validateEmail(profile.email)) {
      updatedProfile.email = "";
      hasErrors = true;
      toast.error('Invalid email format');
    }
    
    // Apply cleared fields if errors found
    if (hasErrors) {
      setProfile(updatedProfile);
      setIsSubmitting(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      
      const response = await fetch("http://localhost:5000/dashboard/update-profile", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          jwt_token: token 
        },
        body: JSON.stringify({
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email
        })
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update profile");
      }
      
      toast.success("Profile updated successfully");
      setIsEditingProfile(false);
    } catch (err) {
      console.error("Error updating profile:", err.message);
      toast.error(err.message || "Failed to update profile");
    }
  };

  // Handle password change
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle password form submission
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    let updatedPasswordData = { ...passwordData };
    let hasErrors = false;
    
    try {
      // Password validation checks
      if (passwordData.new_password !== passwordData.confirm_password) {
        toast.error("Passwords do not match");
        updatedPasswordData.new_password = "";
        updatedPasswordData.confirm_password = "";
        hasErrors = true;
      }
      
      // Validate that the current password is not the same as the new password
      if (passwordData.current_password === passwordData.new_password) {
        toast.error("Current password cannot be the same as the new password");
        updatedPasswordData.new_password = "";
        updatedPasswordData.confirm_password = "";
        hasErrors = true;
      }
      
      // Validate password strength
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
      if (!passwordRegex.test(passwordData.new_password)) {
        toast.error("Password must be at least 8 characters and include uppercase, lowercase, number, and special character");
        updatedPasswordData.new_password = "";
        updatedPasswordData.confirm_password = "";
        hasErrors = true;
      }
      
      if (hasErrors) {
        setPasswordData(updatedPasswordData);
        return;
      }
      
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      
      const response = await fetch("http://localhost:5000/dashboard/change-password", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          jwt_token: token 
        },
        body: JSON.stringify({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password
        })
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
          return;
        }
        const errorData = await response.json();
        // If server says current password is incorrect, clear only that field
        if (errorData.error && errorData.error.includes("current password")) {
          setPasswordData(prev => ({
            ...prev,
            current_password: ""
          }));
          throw new Error(errorData.error || "Current password is incorrect");
        } else {
          throw new Error(errorData.error || "Failed to change password");
        }
      }
      
      toast.success("Password changed successfully");
      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: ""
      });
    } catch (err) {
      console.error("Error changing password:", err.message);
      toast.error(err.message || "Failed to change password");
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.addEventListener('load', () => {
        // Create a new image to get dimensions
        const img = new Image();
        img.onload = () => {
          // Set the image source for the crop modal
          setImageSrc(reader.result);
          
          // Reset zoom level and position for the new image
          setZoom(1);
          setPosition({ x: 0, y: 0 });
          
          // Show the crop modal
          setShowCropModal(true);
        };
        img.src = reader.result;
      });
      
      reader.readAsDataURL(file);
    }
  };

  const performCrop = () => {
    // This function provides visual feedback when the "Crop photo" button is clicked
    if (!imgRef.current) return;
    
    const cropArea = cropAreaRef.current;
    if (!cropArea) return;
    
    // Get the current image and crop area position
    const imgRect = imgRef.current.getBoundingClientRect();
    const cropRect = cropArea.getBoundingClientRect();
    
    // Show visual feedback
    cropArea.style.border = '2px solid #1e88e5';
    setTimeout(() => {
      cropArea.style.border = '1px solid #444';
    }, 300);
    
    // Calculate and log the visible portion for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      const imgScale = imgRef.current.naturalWidth / imgRef.current.offsetWidth;
      const visibleLeft = (cropRect.left - imgRect.left) * imgScale / zoom;
      const visibleTop = (cropRect.top - imgRect.top) * imgScale / zoom;
      
      console.log(`Current crop: x=${visibleLeft.toFixed(0)}, y=${visibleTop.toFixed(0)}, zoom=${zoom.toFixed(2)}`);
    }
    
    toast.success("Crop area adjusted");
  };
  
  const generateCroppedImage = async () => {
    if (!imgRef.current) return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('No 2d context');
    }

    // Get the crop area element dimensions
    const cropAreaEl = cropAreaRef.current;
    if (!cropAreaEl) {
      throw new Error('Crop area element not found');
    }
    
    const cropRect = cropAreaEl.getBoundingClientRect();
    const imgRect = imgRef.current.getBoundingClientRect();
    
    // Set canvas dimensions - we'll use the same size as our editor preview
    const cropSize = 400;
    canvas.width = cropSize;
    canvas.height = cropSize;
    
    // Fill with background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Create circle clipping path
    ctx.beginPath();
    ctx.arc(
      canvas.width / 2,
      canvas.height / 2,
      cropSize / 2,
      0,
      2 * Math.PI
    );
    ctx.clip();
    
    // Calculate the actual scale of the image relative to its natural size
    const imgScale = imgRef.current.naturalWidth / imgRef.current.offsetWidth;
    
    // Calculate how the image is positioned relative to the crop area
    // (taking into account the current zoom level and drag position)
    const visibleLeft = (cropRect.left - imgRect.left) * imgScale / zoom;
    const visibleTop = (cropRect.top - imgRect.top) * imgScale / zoom;
    const visibleWidth = cropRect.width * imgScale / zoom;
    const visibleHeight = cropRect.height * imgScale / zoom;
    
    // Draw exactly what is visible in the crop circle
    ctx.drawImage(
      imgRef.current,
      visibleLeft, visibleTop, visibleWidth, visibleHeight,
      0, 0, cropSize, cropSize
    );

    // Convert canvas to blob with high quality
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 1.0); // Use highest quality JPEG
    });
  };

  const uploadCroppedImage = async () => {
    if (!imgRef.current) {
      toast.error("No image to crop");
      return;
    }

    try {
      setIsSaving(true);
      const croppedImg = await generateCroppedImage();
      
      if (!croppedImg) {
        throw new Error('Failed to generate cropped image');
      }
      
      // Create FormData with the correct field name
      const formData = new FormData();
      formData.append('profile_picture', croppedImg, 'profile.jpg');
      
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Uploading profile picture...');
      }
      
      // Important: Do NOT set Content-Type header with FormData
      // The browser will automatically set it with the correct boundary
      const response = await fetch("http://localhost:5000/dashboard/upload-profile-picture", {
        method: "POST",
        headers: {
          jwt_token: token
        },
        body: formData
      });

      if (!response.ok) {
        const errText = await response.text();
        if (process.env.NODE_ENV === 'development') {
          console.error('Upload error response:', errText);
        }
        throw new Error('Failed to upload profile picture');
      }
      
      const data = await response.json();
      if (process.env.NODE_ENV === 'development') {
        console.log('Upload success response:', data);
      }
      
      if (data.profile_picture_url) {
        // Force a refresh of the image by adding a timestamp
        const timestamp = new Date().getTime();
        const refreshedUrl = `${data.profile_picture_url}?t=${timestamp}`;
        
        // Update the profile avatar
        setProfile(prev => ({
          ...prev,
          avatar: refreshedUrl
        }));
        
        toast.success('Profile picture updated successfully!');
        
        // Reload the profile data to ensure everything is in sync
        setTimeout(() => getProfile(), 500);
      } else {
        throw new Error('No profile picture URL in response');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error uploading cropped image:', error);
      }
      toast.error('Failed to update profile picture: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
      setShowCropModal(false);
      setImageSrc(null);
    }
  };

  const closeCropModal = () => {
    setShowCropModal(false);
    setImageSrc(null);
    setPosition({ x: 0, y: 0 });
    setZoom(1);
  };

  // Log out functionality
  const logout = async (e) => {
    e.preventDefault();
    try {
      localStorage.removeItem("token");
      setAuth(false);
      toast.success("Logged out successfully!");
      navigate("/login");
    } catch (err) {
      console.error(err.message);
    }
  };

  // Toggle courses submenu
  const toggleCoursesSubmenu = (e) => {
    e.preventDefault();
    setCoursesSubmenuOpen(!coursesSubmenuOpen);
  };

  // Add avatar state
  const [avatar, setAvatar] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 250, height: 250 });
  const [croppedImage, setCroppedImage] = useState(null);

  // Handle avatar upload
  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setAvatar(reader.result);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle avatar crop
  const handleCropComplete = (croppedAreaPixels) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const image = new Image();
    
    image.onload = () => {
      canvas.width = 250;
      canvas.height = 250;
      
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        250,
        250
      );
      
      const croppedImageUrl = canvas.toDataURL('image/jpeg');
      setCroppedImage(croppedImageUrl);
      setShowCropModal(false);
      
      // Update profile with new avatar
      setProfile(prev => ({
        ...prev,
        avatar: croppedImageUrl
      }));
    };
    
    image.src = avatar;
  };

  // Add image drag handlers
  const handleMouseDown = (e) => {
    if (!imgRef.current) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    
    // Prevent default behavior like image drag
    e.preventDefault();
  };
  
  const handleMouseMove = (e) => {
    if (!isDragging || !imgRef.current) return;
    
    // Calculate new position
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // Update position state
    setPosition({ x: newX, y: newY });
    
    // Apply the new position to the image
    if (imgRef.current) {
      imgRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${zoom})`;
    }
    
    e.preventDefault();
  };
  
  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      
      // Apply the position immediately to prevent flickering
      if (imgRef.current) {
        imgRef.current.style.transition = 'transform 0.1s';
      }
    }
  };
  
  // Add touch handlers for mobile devices
  const handleTouchStart = (e) => {
    if (!imgRef.current || e.touches.length !== 1) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - position.x,
      y: e.touches[0].clientY - position.y
    });
    
    // Disable transitions during drag for smoother experience
    if (imgRef.current) {
      imgRef.current.style.transition = 'none';
    }
    
    e.preventDefault();
  };
  
  const handleTouchMove = (e) => {
    if (!isDragging || !imgRef.current || e.touches.length !== 1) return;
    
    const newX = e.touches[0].clientX - dragStart.x;
    const newY = e.touches[0].clientY - dragStart.y;
    
    setPosition({ x: newX, y: newY });
    
    // Apply the new position to the image
    if (imgRef.current) {
      imgRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${zoom})`;
    }
    
    e.preventDefault();
  };
  
  const handleTouchEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      
      // Restore transitions
      if (imgRef.current) {
        imgRef.current.style.transition = 'transform 0.1s';
      }
    }
  };

  // Render the profile edit form
  const renderProfileForm = () => (
    <div className="settings-section">
      <div className="settings-header">
        <h2>Profile Information</h2>
        <button 
          className="edit-toggle-btn" 
          onClick={() => isEditingProfile ? handleCancelEdit() : setIsEditingProfile(true)}
        >
          {isEditingProfile ? <FaTimes /> : <FaEdit />}
          <span>{isEditingProfile ? "Cancel" : "Edit"}</span>
        </button>
      </div>
      
      <div className="profile-avatar-section" style={{ marginBottom: '20px' }}>
        <div className="profile-avatar" style={{ position: 'relative', width: '400px', height: '400px', margin: '0 auto' }}>
          {profile.avatar ? (
            <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <img src={profile.avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0, 
                backgroundColor: 'rgba(0,0,0,0.5)', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                opacity: 0,
                transition: 'opacity 0.2s',
                cursor: 'pointer'
              }}
              onClick={() => document.getElementById('avatar-upload').click()}
              onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
              onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
              >
                <div style={{ 
                  width: '50px', 
                  height: '50px', 
                  borderRadius: '50%', 
                  backgroundColor: 'white', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                }}>
                  <FaCamera size={24} color="#333" />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <div className="avatar-placeholder" style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#e0e0e0', borderRadius: '50%', fontSize: '60px', color: '#555', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                {profile.first_name && profile.last_name 
                  ? `${profile.first_name[0]}${profile.last_name[0]}` 
                  : ""}
              </div>
              <div style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0, 
                backgroundColor: 'rgba(0,0,0,0.5)', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                opacity: 0,
                transition: 'opacity 0.2s',
                borderRadius: '50%',
                cursor: 'pointer'
              }}
              onClick={() => document.getElementById('avatar-upload').click()}
              onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
              onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
              >
                <div style={{ 
                  width: '50px', 
                  height: '50px', 
                  borderRadius: '50%', 
                  backgroundColor: 'white', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                }}>
                  <FaCamera size={24} color="#333" />
                </div>
              </div>
            </div>
          )}
          
          <input 
            id="avatar-upload" 
            type="file" 
            accept="image/*" 
            className="avatar-upload-input"
            onChange={handleFileSelect} 
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <form onSubmit={handleProfileSubmit} className="settings-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="first_name">First Name</label>
            <input
              type="text"
              id="first_name"
              name="first_name"
              value={profile.first_name}
              onChange={handleProfileChange}
              readOnly={!isEditingProfile}
              className={!isEditingProfile ? "readonly" : ""}
            />
          </div>

          <div className="form-group">
            <label htmlFor="last_name">Last Name</label>
            <input
              type="text"
              id="last_name"
              name="last_name"
              value={profile.last_name}
              onChange={handleProfileChange}
              readOnly={!isEditingProfile}
              className={!isEditingProfile ? "readonly" : ""}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            value={profile.email}
            onChange={handleProfileChange}
            readOnly={!isEditingProfile}
            className={!isEditingProfile ? "readonly" : ""}
          />
        </div>

        <div className="form-group role-display">
          <label>Role</label>
          <div className="role-badge">{userRole}</div>
        </div>

        {isEditingProfile && (
          <div className="form-actions">
            <button type="submit" className="save-profile-btn">
              <FaSave /> Save Changes
            </button>
          </div>
        )}
      </form>
    </div>
  );

  // Render the password change form
  const renderPasswordForm = () => (
    <div className="settings-section">
      <div className="settings-header">
        <h2>Change Password</h2>
      </div>

      <form onSubmit={handlePasswordSubmit} className="settings-form">
        <div className="form-group password-group">
          <label htmlFor="current_password">Current Password</label>
          <input
            type={showCurrentPassword ? "text" : "password"}
            id="current_password"
            name="current_password"
            value={passwordData.current_password}
            onChange={handlePasswordChange}
            required
            className="password-input"
          />
          <span className="toggle-password" onClick={() => setShowCurrentPassword((prev) => !prev)}>
            {showCurrentPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        <div className="form-group password-group">
          <label htmlFor="new_password">New Password</label>
          <input
            type={showNewPassword ? "text" : "password"}
            id="new_password"
            name="new_password"
            value={passwordData.new_password}
            onChange={handlePasswordChange}
            required
            minLength="8"
            className="password-input"
          />
          <span className="toggle-password" onClick={() => setShowNewPassword((prev) => !prev)}>
            {showNewPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
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
          <label htmlFor="confirm_password">Confirm New Password</label>
          <input
            type={showConfirmPassword ? "text" : "password"}
            id="confirm_password"
            name="confirm_password"
            value={passwordData.confirm_password}
            onChange={handlePasswordChange}
            required
            className="password-input"
          />
          <span className="toggle-password" onClick={() => setShowConfirmPassword((prev) => !prev)}>
            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        <div className="form-actions ">
          <button type="submit" className="save-password-btn">
            <FaKey /> Update Password
          </button>
        </div>
      </form>
    </div>
  );

  // Render the course history 
  const renderCourseHistory = () => (
    <div className="settings-section">
      <div className="settings-header">
        <h2>Course History & Activity</h2>
      </div>

      {loading ? (
        <LoadingIndicator text="Loading course history" />
      ) : courseHistory.length === 0 ? (
        <div className="no-courses-message">
          <p>{userRole === "professor" ? "You haven't created any courses yet." : "You haven't enrolled in any courses yet."}</p>
          <Link to="/courses" className="btn-primary">
            {userRole === "professor" ? "Create Course" : "Browse Courses"}
          </Link>
        </div>
      ) : (
        <div className="course-history-list">
          <div className="course-history-header">
            <div>Course</div>
            <div>Status</div>
            <div>Dates</div>
            {userRole === "student" && <div>Grade</div>}
          </div>
          
          {courseHistory.map(course => (
            <div key={course.course_id} className="course-history-item">
              <div className="course-info">
                <h3>{course.course_name}</h3>
                <p>{course.description}</p>
                <div className="settings-course-meta">
                  <span>{course.semester}</span>
                  {course.section && <span>{course.section}</span>}
                  <span>{course.academic_year}</span>
                </div>
              </div>
              
              <div className="course-status">
                <span className={`status-badge ${course.status}`}>
                  {course.status}
                </span>
              </div>
              
              <div className="course-dates">
                <div>{userRole === "professor" ? "Created" : "Enrolled"}: <span>{new Date(course.created_at).toLocaleDateString()}</span></div>
                {course.last_accessed && (
                  <div>Last accessed: <span>{new Date(course.last_accessed).toLocaleDateString()}</span></div>
                )}
              </div>
              
              {userRole === "student" && (
                <div className="course-grade">
                  {course.grade ? course.grade : "Not graded"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="dashboard-container dashboard-page">
      <Sidebar 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobile={isMobile}
        userRole={userRole}
        courses={courseHistory}
        loading={loading}
        userProfile={profile}
        onLogout={logout}
        activePath="/settings"
      />

      {/* Main Content */}
      <div className={`main-content ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Mobile Toggle Button */}
        {isMobile && (
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
        )}

        <div className="content-wrapper">
          {/* Top Bar - match Dashboard.js style */}
          <div className="top-bar">
            <div className="page-title">
              <h1>Account Settings</h1>
            </div>
          </div>

          {/* Settings Content - match Dashboard.js card style */}
          <div className="dashboard-section" style={{ marginTop: 0 }}>
            <div className="section-header">
              <div className="tab-buttons settings-tab-buttons">
                <button 
                  className={`tab-btn ${activeTab === "profile" ? "active" : ""}`}
                  onClick={() => setActiveTab("profile")}
                >
                  <FaUser className="settings-icon" />
                  <span>Profile Information</span>
                </button>
                <button 
                  className={`tab-btn ${activeTab === "password" ? "active" : ""}`}
                  onClick={() => setActiveTab("password")}
                >
                  <FaKey className="settings-icon" />
                  <span>Change Password</span>
                </button>
                <button 
                  className={`tab-btn ${activeTab === "courses" ? "active" : ""}`}
                  onClick={() => setActiveTab("courses")}
                >
                  <FaHistory className="settings-icon" />
                  <span>Course History</span>
                </button>
              </div>
            </div>
            <div className="settings-content" style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '32px', marginTop: '0' }}>
              {activeTab === "profile" && renderProfileForm()}
              {activeTab === "password" && renderPasswordForm()}
              {activeTab === "courses" && renderCourseHistory()}
            </div>
          </div>
        </div>
      </div>

      {/* Crop Modal */}
      {showCropModal && (
        <div className="modal-overlay settings-modal-overlay" style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0, 0, 0, 0.8)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="crop-modal-content" style={{ 
            backgroundColor: '#222', 
            borderRadius: '8px', 
            width: '90%', 
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto',
            color: '#fff'
          }}>
            <div className="crop-modal-header" style={{ 
              padding: '15px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderBottom: '1px solid #333' 
            }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>Set Profile Picture</h2>
              <button 
                className="close-modal" 
                onClick={closeCropModal}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#fff', 
                  fontSize: '20px', 
                  cursor: 'pointer' 
                }}
              >
                <FaTimes />
              </button>
            </div>
            
            <div className="crop-image-container" style={{ padding: '20px' }}>
              <p style={{ 
                textAlign: 'center', 
                color: '#999', 
                margin: '0 0 15px 0',
                fontSize: '14px' 
              }}>
                Recommended image size: 400 x 400 pixels
              </p>
              <div 
                className="crop-preview-circle" 
                ref={cropAreaRef}
                style={{ 
                  width: '400px', 
                  height: '400px', 
                  margin: '0 auto', 
                  border: '1px solid #444', 
                  borderRadius: '50%', 
                  overflow: 'hidden', 
                  position: 'relative',
                  backgroundColor: '#111'
                }}
              >
                <div 
                  className="crop-image-wrapper" 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    overflow: 'hidden'
                  }}
                >
                  <img
                    ref={imgRef}
                    alt="Crop"
                    src={imageSrc}
                    style={{ 
                      maxWidth: 'none',
                      maxHeight: 'none',
                      objectFit: 'cover',
                      transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                      transformOrigin: 'center',
                      transition: isDragging ? 'none' : 'transform 0.1s',
                      cursor: isDragging ? 'grabbing' : 'grab'
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    draggable="false"
                  />
                </div>
              </div>
              
              <div 
                className="zoom-slider-container" 
                style={{ 
                  margin: '20px auto', 
                  maxWidth: '250px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px' 
                }}
              >
                <button 
                  className="zoom-button"
                  onClick={() => {
                    const newZoom = Math.max(0.5, zoom - 0.1);
                    setZoom(newZoom);
                  }}
                  disabled={zoom <= 0.5}
                  style={{ 
                    width: '30px', 
                    height: '30px', 
                    borderRadius: '50%', 
                    border: 'none', 
                    background: '#444', 
                    color: '#fff',
                    cursor: 'pointer' 
                  }}
                >
                  -
                </button>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(e) => {
                    const newZoom = parseFloat(e.target.value);
                    setZoom(newZoom);
                  }}
                  className="zoom-slider"
                  style={{ 
                    flex: 1,
                    accentColor: '#1e88e5',
                    background: '#444'
                  }}
                />
                <button 
                  className="zoom-button"
                  onClick={() => {
                    const newZoom = Math.min(3, zoom + 0.1);
                    setZoom(newZoom);
                  }}
                  disabled={zoom >= 3}
                  style={{ 
                    width: '30px', 
                    height: '30px', 
                    borderRadius: '50%', 
                    border: 'none', 
                    background: '#444', 
                    color: '#fff',
                    cursor: 'pointer' 
                  }}
                >
                  +
                </button>
              </div>
            </div>
            
            <div 
              className="crop-modal-footer" 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '15px', 
                borderTop: '1px solid #333' 
              }}
            >
              <div className="modal-actions" style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
                <button 
                  className="cancel-btn" 
                  onClick={closeCropModal}
                  style={{ 
                    padding: '8px 15px', 
                    borderRadius: '4px', 
                    border: 'none', 
                    background: '#444', 
                    color: '#fff',
                    cursor: 'pointer' 
                  }}
                >
                  Cancel
                </button>
                <button
                  className="save-btn"
                  onClick={uploadCroppedImage}
                  disabled={isSaving}
                  style={{ 
                    padding: '8px 15px', 
                    borderRadius: '4px', 
                    border: 'none', 
                    background: '#1e88e5', 
                    color: 'white', 
                    cursor: 'pointer' 
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 