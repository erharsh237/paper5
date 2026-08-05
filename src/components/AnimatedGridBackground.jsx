import React from 'react';
import './AnimatedGridBackground.css';

const TilesComponent = ({ className = '', rows: r = 16, cols: c = 16 }) => {
  const rows = new Array(r).fill(1);
  const cols = new Array(c).fill(1);

  return (
    <div className={`agb-tiles-container ${className}`}>
      {rows.map((_, i) => (
        <div key={`row-${i}`} className="agb-row">
          {cols.map((_, j) => (
            <div key={`col-${j}`} className="agb-col" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const Tiles = React.memo(TilesComponent);

export const AnimatedGridBackgroundSection = ({ children, className = '' }) => {
  return (
    <div className={`agb-wrapper ${className}`}>
      <div className="agb-content">{children}</div>
      <div className="agb-bg-layer">
        <Tiles rows={16} cols={16} />
      </div>
      <div className="agb-mask"></div>
    </div>
  );
};
