import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import './AnimatedGridBackground.css';

const TILE_FADE_MS = 800;
const MAX_TRAIL_INTERPOLATION_STEPS = 12;

function getGridCellSize() {
  if (typeof window === 'undefined') return 48;
  return window.matchMedia('(max-width: 640px)').matches ? 36 : 48;
}

function readHoverFillColor(el) {
  if (el && typeof window !== 'undefined') {
    const val = getComputedStyle(el).getPropertyValue('--agb-tile-hover').trim();
    if (val) return val;
  }
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'dark';
  return isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(15, 23, 42, 0.14)';
}

const TilesComponent = forwardRef(({ className = '' }, ref) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const cellsRef = useRef(new Map());
  const hoveredRef = useRef(null);
  const rafRef = useRef(null);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1, cellSize: 48 });
  const hoverColorRef = useRef('rgba(15, 23, 42, 0.14)');

  const drawFrame = (now) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      rafRef.current = null;
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      rafRef.current = null;
      return;
    }

    const { width, height, dpr, cellSize } = sizeRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = hoverColorRef.current;

    const cells = cellsRef.current;
    for (const [key, cell] of cells.entries()) {
      let alpha = 1;
      if (cell.fadeStart !== null) {
        const elapsed = now - cell.fadeStart;
        if (elapsed >= TILE_FADE_MS) {
          cells.delete(key);
          continue;
        }
        const remaining = 1 - elapsed / TILE_FADE_MS;
        alpha = remaining * remaining;
      }

      ctx.globalAlpha = alpha;
      const x = cell.col * cellSize + 1;
      const y = cell.row * cellSize + 1;
      ctx.fillRect(x, y, cellSize - 1, cellSize - 1);
    }

    ctx.globalAlpha = 1;
    if (cells.size > 0) {
      rafRef.current = requestAnimationFrame(drawFrame);
    } else {
      rafRef.current = null;
    }
  };

  const ensureLoop = () => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(drawFrame);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const syncMetrics = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cellSize = getGridCellSize();
      sizeRef.current = { width: rect.width, height: rect.height, dpr, cellSize };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      hoverColorRef.current = readHoverFillColor(container);
      if (cellsRef.current.size > 0) ensureLoop();
    };

    const syncThemeColor = () => {
      hoverColorRef.current = readHoverFillColor(container);
      if (cellsRef.current.size > 0) ensureLoop();
    };

    syncMetrics();

    const resizeObserver = new ResizeObserver(syncMetrics);
    resizeObserver.observe(container);

    const themeObserver = new MutationObserver(syncThemeColor);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    if (document.body) {
      themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
    }

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  useImperativeHandle(ref, () => ({
    onPointerMove(clientX, clientY) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) {
        this.onPointerLeave();
        return;
      }

      const cellSize = sizeRef.current.cellSize || getGridCellSize();
      const col = Math.floor(x / cellSize);
      const row = Math.floor(y / cellSize);
      const key = `${col},${row}`;
      const now = performance.now();

      const prev = hoveredRef.current;
      if (prev && prev.key !== key) {
        const prevCell = cellsRef.current.get(prev.key);
        if (prevCell && prevCell.fadeStart === null) {
          prevCell.fadeStart = now;
        }

        // Fill fast pointer sweeps so no grid cells are skipped between move events
        const dCol = col - prev.col;
        const dRow = row - prev.row;
        const steps = Math.min(Math.max(Math.abs(dCol), Math.abs(dRow)), MAX_TRAIL_INTERPOLATION_STEPS);
        for (let s = 1; s < steps; s++) {
          const iCol = Math.round(prev.col + (dCol * s) / steps);
          const iRow = Math.round(prev.row + (dRow * s) / steps);
          const iKey = `${iCol},${iRow}`;
          cellsRef.current.set(iKey, { col: iCol, row: iRow, fadeStart: now });
        }
      }

      hoveredRef.current = { key, col, row };
      cellsRef.current.set(key, { col, row, fadeStart: null });
      ensureLoop();
    },

    onPointerLeave() {
      const prev = hoveredRef.current;
      if (prev) {
        const prevCell = cellsRef.current.get(prev.key);
        if (prevCell && prevCell.fadeStart === null) {
          prevCell.fadeStart = performance.now();
        }
        hoveredRef.current = null;
        ensureLoop();
      }
    },
  }));

  return (
    <div ref={containerRef} className={`agb-tiles-container ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="agb-hover-canvas" />
    </div>
  );
});

TilesComponent.displayName = 'Tiles';

export const Tiles = React.memo(TilesComponent);

export const AnimatedGridBackgroundSection = ({ children, className = '' }) => {
  const tilesRef = useRef(null);

  const handlePointerMove = (e) => {
    if (e.pointerType === 'touch') return;
    tilesRef.current?.onPointerMove(e.clientX, e.clientY);
  };

  const handlePointerLeave = () => {
    tilesRef.current?.onPointerLeave();
  };

  return (
    <div
      className={`agb-wrapper ${className}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="agb-bg-layer">
        <Tiles ref={tilesRef} />
      </div>
      <div className="agb-mask"></div>
      <div className="agb-content">{children}</div>
    </div>
  );
};
