import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  FaUserGraduate,
  FaChartBar,
  FaTrophy,
  FaSpinner,
  FaSortAmountDown,
  FaSortAmountUp,
  FaLayerGroup,
  FaExclamationTriangle,
  FaUserSlash
} from 'react-icons/fa';
import './ExamAnalytics.css';

const ExamAnalytics = () => {
  const { courseId } = useParams();
  const [examId, setExamId] = useState('all'); // Default to 'all' exams
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [sortColumn, setSortColumn] = useState('rank');
  const [sortDirection, setSortDirection] = useState('asc');
  const [activeTab, setActiveTab] = useState('rankings'); // 'rankings' or 'difficulty'
  const [includeNonParticipants, setIncludeNonParticipants] = useState(false);

  // Fetch available exams
  useEffect(() => {
    const fetchExams = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        
        const response = await fetch(`http://localhost:5000/exams/${courseId}`, {
          method: "GET",
          headers: { jwt_token: token }
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching exams: ${response.status}`);
        }
        
        const data = await response.json();
        setExams(data);
        
        // Keep 'all' as default if it's already set
        if (examId !== 'all' && data.length > 0 && !examId) {
          setExamId(data[0].exam_id);
        }
      } catch (error) {
        console.error("Failed to fetch exams:", error);
        toast.error("Could not load exams. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchExams();
  }, [courseId, examId]);

  // Fetch analytics data
  useEffect(() => {
    if (!examId) return;
    
    const fetchAnalyticsData = async () => {
      try {
        console.log('Fetching analytics data with includeNonParticipants:', includeNonParticipants);
        setLoading(true);
        const token = localStorage.getItem("token");
        
        const endpoint = examId === 'all' 
          ? `http://localhost:5000/dss/exams/analytics/aggregate/${courseId}?includeNonParticipants=${includeNonParticipants}` 
          : `http://localhost:5000/dss/exams/analytics/${examId}?includeNonParticipants=${includeNonParticipants}`;
        
        console.log('Fetching from endpoint:', endpoint);
        
        const response = await fetch(endpoint, {
          method: "GET",
          headers: { jwt_token: token }
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching analytics data: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received analytics data:', data);
        setAnalyticsData(data);
      } catch (error) {
        console.error(`Failed to fetch analytics data:`, error);
        toast.error(`Could not load analytics data. Please try again later.`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalyticsData();
  }, [examId, courseId, includeNonParticipants]);

  // Handle sorting for tables
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort data based on column and direction
  const getSortedData = (data) => {
    if (!data) return [];
    
    const sortableData = [...data];
    return sortableData.sort((a, b) => {
      // Handle special data types
      if (sortColumn === 'rank' || sortColumn === 'score' || sortColumn === 'percentage' || sortColumn === 'percentile' || sortColumn === 'difficulty_percentage') {
        return sortDirection === 'asc' 
          ? Number(a[sortColumn]) - Number(b[sortColumn])
          : Number(b[sortColumn]) - Number(a[sortColumn]);
      }
      
      // Handle text columns
      if (typeof a[sortColumn] === 'string' && typeof b[sortColumn] === 'string') {
        return sortDirection === 'asc' 
          ? a[sortColumn].localeCompare(b[sortColumn])
          : b[sortColumn].localeCompare(a[sortColumn]);
      }
      
      return 0;
    });
  };

  // Render rankings view
  const renderRankings = () => {
    if (!analyticsData) {
      return loading 
        ? <div className="loading-container"><FaSpinner className="spinner" /></div>
        : <div className="no-data">Select an exam to view analytics</div>;
    }
    
    const rankings = getSortedData(analyticsData.rankings);
    const isDueOver = analyticsData.is_due_over;
    
    return (
      <div className="rankings-container">
        <div className="analytics-header">
          <h2>{examId === 'all' ? 'Aggregate Student Rankings Across All Exams' : `Student Rankings for ${analyticsData.exam_title}`}</h2>
          <div className="exam-selector">
            <label htmlFor="exam-select">Select Exam:</label>
            <select 
              id="exam-select" 
              value={examId || ''}
              onChange={(e) => setExamId(e.target.value)}
            >
              <option value="all">
                <FaLayerGroup /> All Exams (Aggregate)
              </option>
              {exams.map(exam => (
                <option key={exam.exam_id} value={exam.exam_id}>
                  {exam.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="options-bar">
          <div className="analytics-tabs">
            <button 
              className={`tab-button ${activeTab === 'rankings' ? 'active' : ''}`}
              onClick={() => setActiveTab('rankings')}
            >
              Student Rankings
            </button>
            <button 
              className={`tab-button ${activeTab === 'difficulty' ? 'active' : ''}`}
              onClick={() => setActiveTab('difficulty')}
            >
              Question Difficulty Analysis
            </button>
          </div>
        </div>
        
        {activeTab === 'rankings' ? (
          <>
            <div className="stats-grid">
              <div className="stats-card">
                <div className="stats-icon icon-active">
                  <FaTrophy style={{ color: 'white' }} />
                </div>
                <div className="stats-info">
                  <h3>Highest Score</h3>
                  <p className="stats-value">{analyticsData.statistics?.highest_score || 'N/A'}</p>
                </div>
              </div>

              <div className="stats-card">
                <div className="stats-icon icon-archived">
                  <FaChartBar style={{ color: 'white' }} />
                </div>
                <div className="stats-info">
                  <h3>Average Score</h3>
                  <p className="stats-value">
                    {analyticsData.statistics?.average_score 
                      ? Math.round(analyticsData.statistics.average_score) 
                      : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="stats-card">
                <div className="stats-icon icon-inactive">
                  <FaChartBar style={{ color: 'white' }} />
                </div>
                <div className="stats-info">
                  <h3>Most Common Score</h3>
                  <p className="stats-value">
                    {analyticsData.statistics?.mode_score || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="stats-card">
                <div className="stats-icon icon-active">
                  <FaUserGraduate style={{ color: 'white' }} />
                </div>
                <div className="stats-info">
                  <h3>{examId === 'all' ? 'Total Students' : 'Submissions'}</h3>
                  <p className="stats-value">
                    {analyticsData.statistics?.total_submissions || 0}
                    {includeNonParticipants && analyticsData.statistics?.non_participants > 0 && (
                      <span style={{ fontSize: '0.875rem', color: '#666666', display: 'block', marginTop: '4px' }}>
                        {analyticsData.statistics.participants || 0} participants + {analyticsData.statistics.non_participants || 0} non-participants
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="analytics-table-container">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th 
                      onClick={() => handleSort('rank')}
                      className={sortColumn === 'rank' ? `sorted-${sortDirection}` : ''}
                      style={{ width: '80px' }}
                    >
                      Rank
                      {sortColumn === 'rank' && (
                        sortDirection === 'asc' 
                          ? <FaSortAmountUp className="sort-icon" />
                          : <FaSortAmountDown className="sort-icon" />
                      )}
                    </th>
                    <th style={{ width: '200px', textAlign: 'left' }}>Student</th>
                    <th 
                      onClick={() => handleSort('score')}
                      className={sortColumn === 'score' ? `sorted-${sortDirection}` : ''}
                      style={{ width: '120px' }}
                    >
                      {examId === 'all' ? 'Total Score' : 'Score'}
                      {sortColumn === 'score' && (
                        sortDirection === 'asc' 
                          ? <FaSortAmountUp className="sort-icon" />
                          : <FaSortAmountDown className="sort-icon" />
                      )}
                    </th>
                    <th 
                      onClick={() => handleSort('percentage')}
                      className={sortColumn === 'percentage' ? `sorted-${sortDirection}` : ''}
                      style={{ width: '150px' }}
                    >
                      Percentage
                      {sortColumn === 'percentage' && (
                        sortDirection === 'asc' 
                          ? <FaSortAmountUp className="sort-icon" />
                          : <FaSortAmountDown className="sort-icon" />
                      )}
                    </th>
                    <th 
                      onClick={() => handleSort('percentile')}
                      className={sortColumn === 'percentile' ? `sorted-${sortDirection}` : ''}
                      style={{ width: '120px' }}
                    >
                      Percentile
                      {sortColumn === 'percentile' && (
                        sortDirection === 'asc' 
                          ? <FaSortAmountUp className="sort-icon" />
                          : <FaSortAmountDown className="sort-icon" />
                      )}
                    </th>
                    <th style={{ width: '150px' }}>Performance</th>
                    {examId === 'all' && <th style={{ width: '120px' }}>Exams Taken</th>}
                    {includeNonParticipants && examId !== 'all' && <th style={{ width: '150px' }}>Status</th>}
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((student, index) => (
                    <tr 
                      key={student.submission_id || student.student_id} 
                      className={`${index < 3 ? 'top-rank' : ''} ${student.non_participant ? 'non-participant-row' : ''}`}
                    >
                      <td className="rank-cell">
                        {student.rank <= 3 && !student.non_participant && (
                          <FaTrophy className={`trophy rank-${student.rank}`} style={{ marginRight: '8px' }} />
                        )}
                        {student.rank}
                      </td>
                      <td style={{ textAlign: 'left' }}>{student.name}</td>
                      <td>
                        {student.score} / {student.total_points}
                      </td>
                      <td>
                        <div className="progress-container">
                          <div 
                            className={`progress-bar ${student.non_participant ? 'non-participant' : ''}`}
                            style={{ width: `${student.percentage}%` }}
                          >
                            {student.percentage}%
                          </div>
                        </div>
                      </td>
                      <td>{student.percentile}th</td>
                      <td>
                        <span className={`performance-badge performance-${
                          student.performance === 'Poor' ? 'poor' : 
                          student.performance === 'Fair' ? 'fair' :
                          student.performance === 'Satisfactory' ? 'satisfactory' : 'outstanding'
                        }`}>
                          {student.performance}
                        </span>
                      </td>
                      {examId === 'all' && <td>{student.exams_taken || '-'}</td>}
                      {includeNonParticipants && examId !== 'all' && (
                        <td>
                          {student.non_participant ? (
                            student.is_due_over && (
                              <span className="non-participant-badge">
                                <FaExclamationTriangle style={{ fontSize: '0.9rem', marginRight: '4px' }} /> Due Over - Not Submitted
                              </span>
                            )
                          ) : (
                            <span className="participant-badge">
                              <FaUserGraduate style={{ fontSize: '0.9rem', marginRight: '4px' }} /> Submitted
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="difficulty-analysis-container">
            <h3>Question Difficulty Analysis</h3>
            <p className="analysis-note">{analyticsData.difficulty_analysis?.analysis_note || 'Questions ranked by difficulty (incorrect answer rate)'}</p>
            
            {analyticsData.difficulty_analysis?.difficult_questions?.length > 0 ? (
              <div className="analytics-table-container">
                <table className="analytics-table difficulty-table">
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Type</th>
                      {examId === 'all' && <th>Exam</th>}
                      <th 
                        onClick={() => handleSort('difficulty_percentage')}
                        className={sortColumn === 'difficulty_percentage' ? `sorted-${sortDirection}` : ''}
                      >
                        Difficulty
                        {sortColumn === 'difficulty_percentage' && (
                          sortDirection === 'asc' 
                            ? <FaSortAmountUp className="sort-icon" />
                            : <FaSortAmountDown className="sort-icon" />
                        )}
                      </th>
                      <th>Incorrect / Total</th>
                      {!examId === 'all' && <th>Points</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedData(analyticsData.difficulty_analysis.difficult_questions).map((question) => (
                      <tr key={question.question_id}>
                        <td className="question-text">{question.question_text}</td>
                        <td>{question.type}</td>
                        {examId === 'all' && <td>{question.exam_title}</td>}
                        <td>
                          <div className="difficulty-indicator-container">
                            <div 
                              className={`difficulty-indicator ${
                                question.difficulty_percentage >= 80 ? 'high-difficulty' :
                                question.difficulty_percentage >= 50 ? 'medium-difficulty' : 'low-difficulty'
                              }`}
                              style={{ width: `${question.difficulty_percentage}%` }}
                            >
                              {question.difficulty_percentage}%
                            </div>
                          </div>
                        </td>
                        <td>
                          {question.incorrect_count} / {question.total_attempts}
                          {question.difficulty_percentage >= 70 && 
                            <FaExclamationTriangle className="difficulty-warning" title="High error rate" />
                          }
                        </td>
                        {!examId === 'all' && <td>{question.points}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-data">No difficulty data available. Students may not have attempted enough questions.</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="exam-analytics-container">
      <div className="analytics-content">
        {renderRankings()}
      </div>
    </div>
  );
};

export default ExamAnalytics; 