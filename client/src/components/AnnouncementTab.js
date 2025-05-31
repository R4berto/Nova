import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FaPlus, 
  FaPaperclip, 
  FaUndo,
  FaPaperPlane,
  FaBars, 
  FaTimes, 
  FaHome, 
  FaGraduationCap, 
  FaSignOutAlt, 
  FaCog, 
  FaBell, 
  FaComments, 
  FaSearch, 
  FaChevronDown, 
  FaClipboardList, 
  FaCommentDots, 
  FaPen, 
  FaUserFriends 
} from 'react-icons/fa';
import './classroom.css';
import { toast } from 'react-hot-toast';

const AnnouncementTab = ({ setAuth }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [coursesSubmenuOpen, setCoursesSubmenuOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [announcement, setAnnouncement] = useState({
    title: '',
    content: '',
    postTo: 'all',
    allowComments: false,
    allowLiking: false,
    enablePodcast: false,
    availableFrom: { date: '', time: '' },
    until: { date: '', time: '' }
  });
  const navigate = useNavigate();
  const [inputs, setInputs] = useState({
    first_name: "",
    last_name: ""
  });
  const editorRef = useRef(null);

  const { first_name, last_name } = inputs;

  // Check if mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  // Fetch user profile and role
  useEffect(() => {
    const getProfile = async () => {
      try {
        const res = await fetch("http://localhost:5000/dashboard/", {
          method: "GET",
          headers: { jwt_token: localStorage.token }
        });
        const parseData = await res.json();
        setInputs({
          first_name: parseData.first_name,
          last_name: parseData.last_name
        });
        setUserRole(parseData.role);
      } catch (err) {
        console.error("Error fetching profile:", err.message);
      }
    };
    getProfile();
  }, []);

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

  const toggleCoursesSubmenu = (e) => {
    e.preventDefault();
    setCoursesSubmenuOpen(!coursesSubmenuOpen);
  };

  const handleFormat = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleFontSize = (e) => {
    handleFormat('fontSize', e.target.value);
  };

  const handleFontStyle = (e) => {
    handleFormat('formatBlock', e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      handleFormat('insertText', '    ');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (file.type.startsWith('image/')) {
          handleFormat('insertImage', e.target.result);
        } else {
          const link = `<a href="${e.target.result}" download="${file.name}">${file.name}</a>`;
          handleFormat('insertHTML', link);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const getWordCount = () => {
    const text = editorRef.current?.innerText || '';
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Submitting announcement:', {
      ...announcement,
      content: editorRef.current?.innerHTML
    });
    setShowModal(false);
  };

  const resetDates = (field) => {
    setAnnouncement(prev => ({
      ...prev,
      [field]: {
        date: '',
        time: ''
      }
    }));
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar Overlay for Mobile */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="logo-container">
          <div className="logo"></div>
          <h2>Nova</h2>
        </div>
        
        <div className="sidebar-header">
          <h3>General</h3>
        </div>

        <nav className="sidebar-nav">
          <Link to="/dashboard" className="nav-item">
            <FaHome className="nav-icon" />
            <span>Dashboard</span>
          </Link>
          <div className={`nav-item has-submenu ${coursesSubmenuOpen ? 'active' : ''}`}>
            <span onClick={toggleCoursesSubmenu}>
              <FaGraduationCap className="nav-icon" />
              <span>Courses</span>
              <FaChevronDown className="submenu-toggle" />
            </span>
            <div className="submenu">
              <Link to="/courses" className="submenu-item">
                <span>All Courses</span>
              </Link>
              <Link to="/courses/classroom" className="submenu-item">
                <span>Classroom</span>
              </Link>
              <Link to="/courses/announcements" className="submenu-item">
                <FaBell className="nav-icon" />
                <span>Announcements</span>
              </Link>
              <Link to="/courses/assignments" className="submenu-item">
                <FaClipboardList className="nav-icon" />
                <span>Assignments</span>
              </Link>
              <Link to="/courses/discussions" className="submenu-item">
                <FaCommentDots className="nav-icon" />
                <span>Discussions</span>
              </Link>
              <Link to="/courses/people" className="submenu-item">
                <FaUserFriends className="nav-icon" />
                <span>People</span>
              </Link>
            </div>
          </div>
          <Link to="/announcements" className="nav-item active">
            <FaComments className="nav-icon" />
            <span>Messages</span>
          </Link>
          <Link to="/settings" className="nav-item">
            <FaCog className="nav-icon" />
            <span>Settings</span>
          </Link>
        </nav>

        <button onClick={logout} className="logout-button">
          <FaSignOutAlt className="nav-icon" />
          <span>Logout</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="main-content">
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
          {/* Top Bar */}
          <div className="top-bar">
            <div className="search-container">
              <div className="search-bar">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search announcements..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="top-bar-right">
              <div className="notification-icon">
                <FaBell />
                <span className="notification-badge">3</span>
              </div>

              <div className="user-profile">
                <div className="user-info">
                  <div className="user-name">{first_name} {last_name}</div>
                  <div className="user-role">{userRole}</div>
                </div>
                <div className="avatar">
                  {first_name && last_name ? `${first_name[0]}${last_name[0]}` : ""}
                </div>
              </div>
            </div>
          </div>

          {/* Announcements Content */}
          <div className="announcement-container">
            <div className="announcement-header">
              <div className="header-left">
                <h1>Announcements</h1>
              </div>
              <div className="header-right">
                {userRole === "professor" && (
                  <button className="add-announcement-btn" onClick={() => setShowModal(true)}>
                    <FaPlus /> Add Announcement
                  </button>
                )}
              </div>
            </div>

            <div className="announcement-content">
              <div className="empty-state">
                <div className="megaphone-icon">
                  <img 
                    src="/megaphone.svg" 
                    alt="No Announcements" 
                    className="megaphone-image"
                  />
                </div>
                <h2>No Announcements</h2>
                <p>Create announcements above</p>
              </div>
            </div>
          </div>

          {/* Announcement Modal */}
          {showModal && (
            <div className="modal-overlay">
              <div className="announcement-modal">
                <div className="modal-content">
                  <div className="form-group">
                    <label>Topic Title</label>
                    <input
                      type="text"
                      value={announcement.title}
                      onChange={(e) => setAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                      className="title-input"
                      placeholder="Enter topic title"
                    />
                  </div>

                  <div className="editor-section">
                    <div className="editor-menu">
                      <div className="menu-bar">
                        <span>Edit</span>
                        <span>View</span>
                        <span>Insert</span>
                        <span>Format</span>
                        <span>Tools</span>
                        <span>Table</span>
                      </div>
                      <div className="toolbar">
                        <select className="font-select" onChange={handleFontSize} defaultValue="3">
                          <option value="1">8pt</option>
                          <option value="2">10pt</option>
                          <option value="3">12pt</option>
                          <option value="4">14pt</option>
                          <option value="5">18pt</option>
                          <option value="6">24pt</option>
                          <option value="7">36pt</option>
                        </select>
                        <select className="style-select" onChange={handleFontStyle} defaultValue="p">
                          <option value="p">Paragraph</option>
                          <option value="h1">Heading 1</option>
                          <option value="h2">Heading 2</option>
                          <option value="h3">Heading 3</option>
                          <option value="pre">Preformatted</option>
                        </select>
                        <button type="button" className="format-btn" onClick={() => handleFormat('bold')} title="Bold">
                          B
                        </button>
                        <button type="button" className="format-btn" onClick={() => handleFormat('italic')} title="Italic">
                          I
                        </button>
                        <button type="button" className="format-btn" onClick={() => handleFormat('underline')} title="Underline">
                          U
                        </button>
                        <button type="button" className="format-btn" onClick={() => handleFormat('justifyLeft')} title="Align Left">
                          ←
                        </button>
                        <button type="button" className="format-btn" onClick={() => handleFormat('justifyCenter')} title="Center">
                          ↔
                        </button>
                        <button type="button" className="format-btn" onClick={() => handleFormat('justifyRight')} title="Align Right">
                          →
                        </button>
                        <button type="button" className="format-btn" onClick={() => handleFormat('insertUnorderedList')} title="Bullet List">
                          •
                        </button>
                        <button type="button" className="format-btn" onClick={() => handleFormat('insertOrderedList')} title="Numbered List">
                          1.
                        </button>
                        <button type="button" className="format-btn" onClick={() => handleFormat('indent')} title="Indent">
                          →|
                        </button>
                        <button type="button" className="format-btn" onClick={() => handleFormat('outdent')} title="Outdent">
                          |←
                        </button>
                        <input
                          type="color"
                          onChange={(e) => handleFormat('foreColor', e.target.value)}
                          className="format-btn color-picker"
                          title="Text Color"
                        />
                        <input
                          type="color"
                          onChange={(e) => handleFormat('hiliteColor', e.target.value)}
                          className="format-btn color-picker"
                          title="Highlight Color"
                        />
                      </div>
                    </div>
                    <div
                      ref={editorRef}
                      className="editor-content"
                      contentEditable
                      onKeyDown={handleKeyDown}
                      role="textbox"
                      aria-multiline="true"
                      aria-label="Announcement content"
                    />
                    <div className="editor-footer">
                      <div className="footer-left">
                        <label className="attach-btn" role="button">
                          <FaPaperclip /> Attach
                          <input
                            type="file"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            multiple
                          />
                        </label>
                      </div>
                      <div className="footer-right">
                        <span>{getWordCount()} words</span>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Post to</label>
                    <select
                      value={announcement.postTo}
                      onChange={(e) => setAnnouncement(prev => ({ ...prev, postTo: e.target.value }))}
                      className="post-select"
                    >
                      <option value="all">All Sections</option>
                      <option value="section1">Section 1</option>
                      <option value="section2">Section 2</option>
                    </select>
                  </div>

                  <div className="scheduling-options">
                    <div className="date-time-group">
                      <label>Available From</label>
                      {announcement.availableFrom.date && (
                        <button 
                          type="button" 
                          className="reset-date"
                          onClick={() => resetDates('availableFrom')}
                        >
                          <FaUndo size={12} /> Reset
                        </button>
                      )}
                      <div className="date-time-inputs">
                        <input
                          type="date"
                          value={announcement.availableFrom.date}
                          onChange={(e) => setAnnouncement(prev => ({
                            ...prev,
                            availableFrom: {
                              ...prev.availableFrom,
                              date: e.target.value
                            }
                          }))}
                          className="date-input"
                        />
                        <input
                          type="time"
                          value={announcement.availableFrom.time}
                          onChange={(e) => setAnnouncement(prev => ({
                            ...prev,
                            availableFrom: {
                              ...prev.availableFrom,
                              time: e.target.value
                            }
                          }))}
                          className="time-input"
                        />
                      </div>
                    </div>

                    <div className="date-time-group">
                      <label>Until</label>
                      {announcement.until.date && (
                        <button 
                          type="button" 
                          className="reset-date"
                          onClick={() => resetDates('until')}
                        >
                          <FaUndo size={12} /> Reset
                        </button>
                      )}
                      <div className="date-time-inputs">
                        <input
                          type="date"
                          value={announcement.until.date}
                          onChange={(e) => setAnnouncement(prev => ({
                            ...prev,
                            until: {
                              ...prev.until,
                              date: e.target.value
                            }
                          }))}
                          className="date-input"
                        />
                        <input
                          type="time"
                          value={announcement.until.time}
                          onChange={(e) => setAnnouncement(prev => ({
                            ...prev,
                            until: {
                              ...prev.until,
                              time: e.target.value
                            }
                          }))}
                          className="time-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <div className="modal-options">
                    <div className="option-item">
                      <input
                        type="checkbox"
                        id="allowComments"
                        checked={announcement.allowComments}
                        onChange={(e) => setAnnouncement(prev => ({ ...prev, allowComments: e.target.checked }))}
                      />
                      <label htmlFor="allowComments">Allow comments</label>
                    </div>
                    <div className="option-item">
                      <input
                        type="checkbox"
                        id="allowLiking"
                        checked={announcement.allowLiking}
                        onChange={(e) => setAnnouncement(prev => ({ ...prev, allowLiking: e.target.checked }))}
                      />
                      <label htmlFor="allowLiking">Allow liking</label>
                    </div>
                    <div className="option-item">
                      <input
                        type="checkbox"
                        id="enablePodcast"
                        checked={announcement.enablePodcast}
                        onChange={(e) => setAnnouncement(prev => ({ ...prev, enablePodcast: e.target.checked }))}
                      />
                      <label htmlFor="enablePodcast">Enable podcast</label>
                    </div>
                  </div>
                  <div className="action-btns">
                    <button 
                      type="button" 
                      className="cancel-btn"
                      onClick={() => setShowModal(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      className="post-btn"
                      onClick={handleSubmit}
                    >
                      <FaPaperPlane /> Post
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnnouncementTab; 