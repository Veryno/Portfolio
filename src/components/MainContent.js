import React from 'react';
import '../styles/MainContent.css';

const MainContent = () => {
  return (
    <main className="main-content">
      <div className="intro-section">
        <p className="intro-text">
          I am a passionate software engineer with a strong focus on developing innovative and user-friendly solutions. With expertise in both front-end and back-end technologies, I strive to deliver high-quality software that meets the needs of users and clients alike.
        </p>
      </div>
      <div className="content-section">
        <div className="tech-experience">
          <h3 className="section-title">Technical Experience</h3>
          <ul>
            <li>Experience 1</li>
            <li>Experience 2</li>
            <li>Experience 3</li>
          </ul>
        </div>
        <div className="projects">
          <h3 className="section-title">Projects</h3>
          <div className="project-card">
            <h4>Project 1</h4>
            <p>Description of Project 1.</p>
          </div>
          <div className="project-card">
            <h4>Project 2</h4>
            <p>Description of Project 2.</p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default MainContent;
