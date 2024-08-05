import React from 'react';
import '../styles/Footer.css';
import { FaGithub, FaLinkedin, FaEnvelope } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-left">
          <div className="social-links">
            <a href="https://github.com/your-github-username" target="_blank" rel="noopener noreferrer" className="social-link">
              <FaGithub className="social-icon" />
            </a>
            <a href="https://linkedin.com/in/your-linkedin-profile" target="_blank" rel="noopener noreferrer" className="social-link">
              <FaLinkedin className="social-icon" />
            </a>
            <a href="mailto:your-email@example.com" className="social-link">
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
