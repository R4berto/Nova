import React from 'react';
import './Loaders.css';

const LoadingIndicator = ({ text = "Loading" }) => {
  return (
    <div className="loader-container" style={{ minHeight: '200px', padding: '50px 0' }}>
      <div className="box-loader-container">
        <div className="box-item"></div>
        <div className="box-item"></div>
        <div className="box-item"></div>
        <div className="box-item"></div>
        <div className="box-item"></div>
      </div>
      <div className="loader-text">{text}</div>
    </div>
  );
};

export default LoadingIndicator; 