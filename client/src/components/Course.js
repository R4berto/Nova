import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import CourseStream from './CourseStream';
import '../styles/Course.css';
import LoadingIndicator from './common/LoadingIndicator';

const Course = () => {
    const [courseDetails, setCourseDetails] = useState(null);
    const { courseId } = useParams();

    useEffect(() => {
        fetchCourseDetails();
    }, [courseId]);

    const fetchCourseDetails = async () => {
        try {
            const response = await fetch(`http://localhost:5000/courses/${courseId}`, {
                method: "GET",
                headers: { token: localStorage.token }
            });

            const data = await response.json();
            if (response.ok) {
                setCourseDetails(data);
            }
        } catch (err) {
            console.error(err.message);
        }
    };

    if (!courseDetails) {
        return <LoadingIndicator text="Loading course details" />;
    }

    return (
        <div className="course-page">
            <header className="course-header">
                <h1>{courseDetails.course_name}</h1>
                <div className="course-info">
                    <span>{courseDetails.section}</span>
                    <span>{courseDetails.semester}</span>
                    <span>{courseDetails.academic_year}</span>
                </div>
            </header>
            
            <main className="course-content">
                <CourseStream />
            </main>
        </div>
    );
};

export default Course; 