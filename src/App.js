import React from 'react';
import Header from '//components/Header';
import Footer from '//components/Footer';
import Sidebar from '//components/Sidebar';
import MainContent from '//components/MainContent';
import './styles/layout.css';

function App() {
  return (
    <div className="App">
      <Header />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <MainContent />
      </div>
      <Footer />
    </div>
  );
}

export default App;
