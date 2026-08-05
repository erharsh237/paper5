import React from 'react';
import { motion } from 'framer-motion';
import './AnimatedGridBackground.css';

const TilesComponent = ({ className = '', rows: r, cols: c }) => {
  const rows = new Array(r || 50).fill(1);
  const cols = new Array(c || 30).fill(1);

  return (
    <div className={`agb-tiles-container ${className}`}>
      {rows.map((_, i) => (
        <motion.div
          key={`row` + i}
          className="agb-row"
        >
          {cols.map((_, j) => (
            <motion.div
              whileHover={{
                backgroundColor: `var(--tile)`,
                transition: { duration: 0 }
              }}
              animate={{
                transition: { duration: 2 }
              }}
              key={`col` + j}
              className="agb-col"
            />
          ))}
        </motion.div>
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
        <Tiles rows={40} cols={20} />
      </div>
      <div className="agb-mask"></div>
    </div>
  );
};
