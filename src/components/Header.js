import React from 'react';
import '../styles/Header.css';

const Header = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="header-title">Yaacob Abdullah</h1>
          <p className="header-subtitle">Software Engineer and Developer</p>
        </div>
        <div className="header-right">
       { /*  <img src="/profile.heic" alt="Yaacob Abdullah" className="profile-picture" />*/}
        </div>
      </div>
    </header>
  );
};

export default Header;
