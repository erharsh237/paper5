import React from 'react';
import './HeroSection.css';

const HeroSection = () => {
  return (
    <div className="hero-container">
      <div className="hero-overlay"></div>

      <nav className="navbar">
        <div className="logo">Paper5</div>
        <ul className="nav-links">
          <li><a href="#services">Services</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </nav>

      <div className="hero-content">
        <h1>Your Research, Our Responsibility</h1>
        <p>Professional research paper writing tailored to your needs. Trusted by students and scholars worldwide.</p>
        <a href="#get-started" className="hero-btn">Get Started</a>
      </div>
    </div>
  );
};

export default HeroSection;
    