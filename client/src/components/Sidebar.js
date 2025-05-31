import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    HiOutlineHome,
    HiOutlineChatAlt2,
    HiOutlineCog,
    HiOutlineLogout,
    HiOutlineChevronDown,
    HiOutlineBookOpen,
    HiOutlineMenu,
    HiOutlineX,
    HiOutlineArrowLeft,
    HiOutlineArrowRight,
    HiOutlineAcademicCap
} from 'react-icons/hi';
import './dashboard.css';

const Sidebar = ({ 
    sidebarOpen, 
    setSidebarOpen, 
    isMobile,
    userRole,
    courses = [],
    loading = false,
    userProfile = {},
    onLogout,
    activePath = '/dashboard',
    isCollapsed = false,
    setIsCollapsed
}) => {
    const navigate = useNavigate();
    const [isCoursesSubmenuOpen, setIsCoursesSubmenuOpen] = useState(false);
    const [hoveredSubmenu, setHoveredSubmenu] = useState(false);
    const submenuRef = useRef(null);
    const { first_name, last_name, profile_picture_url } = userProfile;

    // Close courses submenu when sidebar collapses
    useEffect(() => {
        if (isCollapsed) {
            setIsCoursesSubmenuOpen(false);
        }
    }, [isCollapsed]);

    const handleCoursesClick = (e) => {
        // In collapsed state or when clicking directly on the link/icon, navigate to courses
        if (isCollapsed) {
            // When in collapsed state, just navigate
            navigate('/courses');
        }
        // In expanded state, only the dropdown toggle button handles expansion
        // The link behavior is default (navigation)
    };

    const toggleCoursesSubmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isCollapsed) {
            setIsCoursesSubmenuOpen(!isCoursesSubmenuOpen);
        }
    };

    const toggleCollapse = () => {
        if (setIsCollapsed) {
            const newState = !isCollapsed;
            localStorage.setItem("sidebarCollapsed", newState.toString());
            setIsCollapsed(newState);
        }
    };

    // Handle mouse enter/leave for collapsed state submenu
    const handleMouseEnter = () => {
        // Removed submenu hover behavior in collapsed state
        if (!isCollapsed) {
            setHoveredSubmenu(true);
        }
    };

    const handleMouseLeave = () => {
        // Removed submenu hover behavior in collapsed state
        if (!isCollapsed) {
            setHoveredSubmenu(false);
        }
    };

    return (
        <>
            {/* Sidebar Overlay for Mobile */}
            {isMobile && sidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`sidebar ${sidebarOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
                {/* Collapse Toggle Button */}
                {!isMobile && (
                    <button
                        className="collapse-toggle"
                        onClick={toggleCollapse}
                        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                        aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                        style={{
                            backgroundColor: '#000',
                            color: '#fff',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '8px'
                        }}
                    >
                        {isCollapsed ? <HiOutlineArrowRight size={24} /> : <HiOutlineArrowLeft size={24} />}
                    </button>
                )}

                {/* Logo and Title - Only show when not collapsed */}
                {!isCollapsed && (
                    <div className="logo-container">
                        <img src="/logo.png" alt="Nova Logo" className="logo" />
                        <h2>Nova</h2>
                    </div>
                )}
                
                {!isCollapsed && (
                    <div className="sidebar-header">
                        <h3>GENERAL</h3>
                    </div>
                )}

                <nav className="sidebar-nav">
                    {/* Dashboard Link */}
                    <Link 
                        to="/dashboard" 
                        className={`nav-item ${activePath === '/dashboard' ? 'active' : ''}`}
                        title="Dashboard"
                    >
                        <HiOutlineHome className="nav-icon" size={isCollapsed ? 28 : 20} />
                        {!isCollapsed && <span>Dashboard</span>}
                    </Link>

                    {/* Courses Link with Submenu */}
                    {isCollapsed ? (
                        // When collapsed, show simple nav item without submenu
                        <Link 
                            to="/courses"
                            className={`nav-item ${activePath.startsWith('/courses') ? 'active' : ''}`}
                            title="Courses"
                        >
                            <HiOutlineAcademicCap className="nav-icon" size={28} />
                        </Link>
                    ) : (
                        // When expanded, show normal submenu functionality
                        <div 
                            className={`nav-item has-submenu ${isCoursesSubmenuOpen || activePath.startsWith('/courses') ? 'active' : ''}`} 
                            ref={submenuRef}
                        >
                            <Link 
                                to="/courses"
                                className={`submenu-trigger ${activePath.startsWith('/courses') ? 'active' : ''}`}
                                title="Courses"
                                onClick={handleCoursesClick}
                            >
                                <HiOutlineAcademicCap className="nav-icon" size={20} />
                                <span>Courses</span>
                                <button 
                                    className="submenu-toggle-button"
                                    onClick={toggleCoursesSubmenu}
                                >
                                    <HiOutlineChevronDown 
                                        className={`submenu-toggle ${isCoursesSubmenuOpen ? 'open' : ''}`} 
                                    />
                                </button>
                            </Link>
                            
                            {/* Dropdown submenu - only visible in expanded state */}
                            <div className={`submenu ${isCoursesSubmenuOpen ? 'open' : ''}`}>
                                <Link 
                                    to="/courses" 
                                    className={`submenu-item ${activePath === '/courses' ? 'active' : ''}`}
                                >
                                    <span>All Courses</span>
                                </Link>
                                {loading ? (
                                    <div className="submenu-item disabled">Loading courses...</div>
                                ) : courses.length > 0 ? (
                                    courses.map((course) => (
                                        <Link 
                                            key={course.course_id} 
                                            to={`/courses/${course.course_id}/stream`} 
                                            className={`submenu-item ${activePath.includes(`/courses/${course.course_id}`) ? 'active' : ''}`}
                                            title={course.course_name}
                                        >
                                            <span style={{ 
                                                overflow: 'hidden', 
                                                textOverflow: 'ellipsis', 
                                                whiteSpace: 'nowrap' 
                                            }}>
                                                {course.course_name || `Course ${course.course_id}`}
                                            </span>
                                        </Link>
                                    ))
                                ) : (
                                    <div className="submenu-item disabled">No courses found</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Messages Link */}
                    <Link 
                        to="/messages" 
                        className={`nav-item ${activePath.startsWith('/messages') ? 'active' : ''}`}
                        title="Messages"
                    >
                        <HiOutlineChatAlt2 className="nav-icon" size={isCollapsed ? 28 : 20} />
                        {!isCollapsed && <span>Messages</span>}
                    </Link>

                    {/* Settings Link */}
                    <Link 
                        to="/settings" 
                        className={`nav-item ${activePath === '/settings' ? 'active' : ''}`}
                        title="Settings"
                    >
                        <HiOutlineCog className="nav-icon" size={isCollapsed ? 28 : 20} />
                        {!isCollapsed && <span>Settings</span>}
                    </Link>
                </nav>

                {/* Logout Button - Always visible */}
                <button 
                    onClick={onLogout} 
                    className={`logout-button ${isCollapsed ? 'collapsed' : ''}`}
                    title="Logout"
                >
                    <HiOutlineLogout className="nav-icon" size={isCollapsed ? 28 : 20} />
                    {!isCollapsed && <span>Logout</span>}
                </button>

                {/* Mobile Toggle Button */}
                {isMobile && (
                    <button
                        className="sidebar-toggle"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        {sidebarOpen ? <HiOutlineX /> : <HiOutlineMenu />}
                    </button>
                )}
            </div>
        </>
    );
};

export default Sidebar; 