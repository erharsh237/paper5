import React from 'react';
import './HeroSection.css';
import './ServicesOffered';
import './HowItWorks';

function HeroSection() {
  return (
    <div className="hero-container">
      <div className="hero-overlay"></div>
      
      <nav className="navbar">
        <div className="logo">PAPER5</div>
        <ul className="nav-links">
          <li><a href="#howitworks">How It Works</a></li>
          <li><a href="#services">Services</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </nav>

      <div className="hero-content">
        <h1>Your Research Journey Starts Here</h1>
        <p>Expert assistance in research writing, data analysis, and publishing. Let’s elevate your work together.</p>
        <a href="#services" className="hero-btn">Explore Services</a>
      </div>
    </div>
  );
}

export default HeroSection;
