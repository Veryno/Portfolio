import React from 'react';
import '../styles/MainContent.css';
import { FaExternalLinkAlt } from 'react-icons/fa'; // Import link icon

const MainContent = () => {
  return (
    <main className="main-content">
      <div className="intro-section">
        <p className="intro-text">
          I am a passionate software engineer with a strong focus on developing innovative and user-friendly solutions. With expertise in both front-end and back-end technologies, I strive to deliver high-quality software that meets the needs of users and clients alike.
        </p>
      </div>
      <div className="resume-section">
        <a
          href="/YAbdullahResume.pdf" // Path to your resume file
          className="resume-link"
          target="_blank"
          rel="noopener noreferrer"
          download // Suggests the browser download the file
        >
          Download Resume
        </a>
      </div>
      <div className="content-section">
        <div className="tech-experience">
          <h3 className="section-title">Technical Experience</h3>
          <ul>
            <li>
              <a href="https://www.truebird.com" target="_blank" rel="noopener noreferrer" className="experience-link">
                Truebird Technologies <FaExternalLinkAlt className="link-icon" />
              </a>
            </li>
            <li>
              <a href="https://www.openavenuesfoundation.org" target="_blank" rel="noopener noreferrer" className="experience-link">
                Open Avenues <FaExternalLinkAlt className="link-icon" />
              </a>
            </li>
            <li></li>
          </ul>
        </div>
        <div className="projects">
          <h3 className="section-title">Projects/Fellowships</h3>
          <ul>
            <li>
              <a href="https://github.com/Veryno/QuickNodeOAF" target="_blank" rel="noopener noreferrer" className="project-link">
                Etherium smart contract <FaExternalLinkAlt className="link-icon" />
              </a>
            </li>
            <li>
              <a href="https://github.com/Veryno/Bedtime-Story-Generator" target="_blank" rel="noopener noreferrer" className="project-link">
                Read Me a Story <FaExternalLinkAlt className="link-icon" />
              </a>
            </li>
            <li>
              <a href="https://cunytechprep.org" target="_blank" rel="noopener noreferrer" className="project-link">
                Cuny Tech Prep <FaExternalLinkAlt className="link-icon" />
              </a>
            </li>
            <li>
              <a href="https://headstarter.co" target="_blank" rel="noopener noreferrer" className="project-link">
                Headstarter AI <FaExternalLinkAlt className="link-icon" />
              </a>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
};

export default MainContent;