import React from 'react';
import './ServicesOffered.css';

// Icons (can be replaced with actual icons or an icon library like FontAwesome or React Icons)
const services = [
  { title: "Thesis & Dissertation Writing" },
  { title: "Journal Paper Acceptance (IEEE, Springer, Elsevier)" },
  { title: "Literature Review" },
  { title: "Editing & Proofreading" },
  { title: "Plagiarism Removal and Originality Reports" },
];

function ServicesOffered() {
  return (
    <div className="services-container" id='services'>
      <h2>Our Services</h2>
      <div className="services-scroll">
        {services.map((service, index) => (
          <div key={index} className="service-card">
            <h3 className="service-title">{service.title}</h3>
          </div>
        ))}
        {/* Repeating the services for infinite scroll effect */}
        {services.map((service, index) => (
          <div key={index + services.length} className="service-card">
            <h3 className="service-title">{service.title}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ServicesOffered;
