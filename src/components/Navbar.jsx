import React, { useState } from 'react';
import './Navbar.css';
import logoImg from "../assets/logo2.png"

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="header">
      <div className="logo">
        <a href=''>
          <img src={logoImg} alt="Logo" />
        </a>
      </div>

      <nav className={`nav ${isMenuOpen ? 'nav-open' : ''}`}>
        <a href="#home" className="nav-link">Home</a>
        <a href="#about" className="nav-link">About</a>
        <a href="#contact" className="nav-link">Pricing</a>
        <a href="#contact" className="nav-link">Contact</a>
      </nav>

      <div className="hamburger" onClick={() => setIsMenuOpen(!isMenuOpen)}>
        <div className="bar"></div>
        <div className="bar"></div>
        <div className="bar"></div>
      </div>
    </header>
  );
};

export default Navbar;
