import React from 'react';
import './MainContent.css';

const MainContent = () => {
  return (
    <main className="main-content">
      <section className="content-section">
        <h2>Welcome to My Portfolio</h2>
        <p>This is a brief introduction about myself and my work.</p>
      </section>
      <section className="content-section">
        <h3>Projects</h3>
        <div className="project-card">
          <h4>Project 1</h4>
          <p>Description of Project 1.</p>
        </div>
        <div className="project-card">
          <h4>Project 2</h4>
          <p>Description of Project 2.</p>
        </div>
      </section>
    </main>
  );
};

export default MainContent;
