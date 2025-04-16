import React from 'react';
import './HowItWorks.css';
import { FaFileAlt, FaUserGraduate, FaEdit, FaCheckCircle } from 'react-icons/fa';

const steps = [
  {
    icon: <FaFileAlt />,
    title: 'Submit Your Topic',
    description: 'Tell us what you need, share your requirements, and upload any reference materials.',
  },
  {
    icon: <FaUserGraduate />,
    title: 'Get Matched with an Expert',
    description: 'We assign a subject-specific expert to work on your research paper.',
  },
  {
    icon: <FaEdit />,
    title: 'Review Drafts',
    description: 'Receive and review drafts, suggest edits, and track progress in real-time.',
  },
  {
    icon: <FaCheckCircle />,
    title: 'Receive Final Paper',
    description: 'Get your polished, plagiarism-free research paper before your deadline.',
  },
];

const HowItWorks = () => {
  return (
    <section className="how-it-works">
      <h2 className="section-title">How It Works</h2>
      <div className="steps-container">
        {steps.map((step, index) => (
          <div className="step-card" key={index}>
            <div className="step-icon">{step.icon}</div>
            <h3 className="step-title">{step.title}</h3>
            <p className="step-description">{step.description}</p>
            <span className="step-number">Step {index + 1}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HowItWorks;