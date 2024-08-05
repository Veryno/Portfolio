import React from 'react';
import '../styles/Footer.css';  // Corrected import path
import { FaGithub, FaLinkedin, FaEnvelope } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-left">
          <a
            href="/path-to-your-resume.pdf"
            className="resume-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Downloadable Resume
          </a>
          <div className="social-links">
            <a href="https://github.com/your-github-username" target="_blank" rel="noopener noreferrer">
              <FaGithub className="social-icon" />
            </a>
            <a href="https://linkedin.com/in/your-linkedin-profile" target="_blank" rel="noopener noreferrer">
              <FaLinkedin className="social-icon" />
            </a>
            <a href="mailto:your-email@example.com">
              <FaEnvelope className="social-icon" />
            </a>
          </div>
        </div>
        <div className="footer-right">
          <a href="/setup" className="footer-setup-link">Setup</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
