import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import '../styles/CourseStream.css';

const CourseStream = () => {
    const [stream, setStream] = useState({ announcements: [], materials: [] });
    const [newAnnouncement, setNewAnnouncement] = useState('');
    const [isTeacher, setIsTeacher] = useState(false);
    const { courseId } = useParams();

    useEffect(() => {
        fetchStreamData();
        checkUserRole();
    }, [courseId]);

    const fetchStreamData = async () => {
        try {
            const response = await fetch(`http://localhost:5000/stream/${courseId}`, {
                method: "GET",
                headers: {
                    "token": localStorage.token
                }
            });

            const data = await response.json();
            if (response.ok) {
                setStream(data);
            } else {
                toast.error(data);
            }
        } catch (err) {
            console.error(err.message);
            toast.error("Failed to fetch stream data");
        }
    };

    const checkUserRole = async () => {
        try {
            const response = await fetch("http://localhost:5000/auth/verify", {
                method: "GET",
                headers: { token: localStorage.token }
            });
            const parseRes = await response.json();
            setIsTeacher(parseRes.role === "professor");
        } catch (err) {
            console.error(err.message);
        }
    };

    const handleAnnouncementSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`http://localhost:5000/stream/${courseId}/announcement`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "token": localStorage.token
                },
                body: JSON.stringify({ content: newAnnouncement })
            });

            const data = await response.json();
            if (response.ok) {
                setNewAnnouncement('');
                fetchStreamData();
                toast.success("Announcement posted successfully!");
            } else {
                toast.error(data);
            }
        } catch (err) {
            console.error(err.message);
            toast.error("Failed to post announcement");
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="course-stream">
            {isTeacher && (
                <div className="announcement-form">
                    <form onSubmit={handleAnnouncementSubmit}>
                        <div className="form-header">
                            <select defaultValue="All students">
                                <option>All students</option>
                            </select>
                        </div>
                        <div className="form-content">
                            <textarea
                                value={newAnnouncement}
                                onChange={(e) => setNewAnnouncement(e.target.value)}
                                placeholder="Announce something to your class"
                                required
                            />
                            <div className="form-actions">
                                <button type="submit" className="post-btn">Post</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            <div className="stream-content">
                {stream.announcements.map((announcement) => (
                    <div key={announcement.announcement_id} className="stream-item announcement">
                        <div className="author-info">
                            <span className="author-name">{`${announcement.first_name} ${announcement.last_name}`}</span>
                            <span className="post-date">{formatDate(announcement.created_at)}</span>
                        </div>
                        <div className="content">
                            {announcement.content}
                        </div>
                    </div>
                ))}

                {stream.materials.map((material) => (
                    <div key={material.material_id} className="stream-item material">
                        <div className="material-header">
                            <div className="material-type">{material.type}</div>
                            <div className="material-info">
                                <span className="author-name">{`${material.first_name} ${material.last_name}`}</span>
                                <span className="post-date">{formatDate(material.created_at)}</span>
                            </div>
                        </div>
                        <div className="material-content">
                            <h3>{material.title}</h3>
                            <p>{material.content}</p>
                            {material.due_date && (
                                <div className="due-date">
                                    Due: {formatDate(material.due_date)}
                                </div>
                            )}
                            {material.points && (
                                <div className="points">
                                    Points: {material.points}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CourseStream; 