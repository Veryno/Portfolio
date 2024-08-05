import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import MainContent from './components/MainContent';
import Setup from './components/Setup';
import Header from './components/Header';
import Footer from './components/Footer';
import './styles/App.css';

const App = () => {
  return (
    <Router>
      <div className="app">
        <Header />
        <div className="content">
          <Routes>
            <Route path="/" element={<MainContent />} />
            <Route path="/setup" element={<Setup />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
