import React, { useState, useEffect } from 'react';
import './AnimatedGridBackground.css';

const TilesComponent = ({ className = '' }) => {
  const [gridSize, setGridSize] = useState(() => {
    if (typeof window === 'undefined') return { cols: 48, rows: 22 };
    const w = window.innerWidth;
    const cellSize = w < 640 ? 36 : 48;
    return {
      cols: Math.max(36, Math.ceil(w / cellSize) + 8),
      rows: 24,
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const cellSize = w < 640 ? 36 : 48;
      setGridSize({
        cols: Math.max(36, Math.ceil(w / cellSize) + 8),
        rows: 24,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const columns = new Array(gridSize.cols).fill(1);
  const rows = new Array(gridSize.rows).fill(1);

  return (
    <div className={`agb-tiles-container ${className}`}>
      {columns.map((_, i) => (
        <div key={`col-group-${i}`} className="agb-row">
          {rows.map((_, j) => (
            <div key={`cell-${i}-${j}`} className="agb-col" />
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
      <div className="agb-bg-layer">
        <Tiles />
      </div>
      <div className="agb-mask"></div>
      <div className="agb-content">{children}</div>
    </div>
  );
};
