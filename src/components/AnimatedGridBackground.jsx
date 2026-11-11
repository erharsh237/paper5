import React from 'react';
import './AnimatedGridBackground.css';

const TilesComponent = ({ className = '' }) => {
  return (
    <div className={`agb-tiles-container ${className}`} aria-hidden="true" />
  );
};

export const Tiles = React.memo(TilesComponent);

export const AnimatedGridBackgroundSection = ({ children, className = '' }) => {
  return (
    <div className={`agb-wrapper ${className}`}>
      <div className="agb-bg-layer">
        <Tiles />
      </div>
      <div className="agb-mask"></div>
      <div className="agb-content">{children}</div>
    </div>
  );
};
