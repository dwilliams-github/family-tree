import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { GraphDTO } from '@family-tree/shared';
import { computeLayout, type ForkEdge, type CoupleBar } from './layout';
import { PersonCard } from './PersonCard';

interface Props {
  dto: GraphDTO;
  selectedPersonId: string | null;
  onPersonSelect: (id: string) => void;
}

const STEM_COLOR = '#8faa98';
const COUPLE_COLOR = '#f59e0b';
const MIN_LEGIBLE = 0.8;
const MIN_SCALE = 0.1;
const MAX_SCALE = 3;
const EDGE = 80; // min screen-px of canvas that must remain visible

function Edges({ coupleBars, forks }: { coupleBars: CoupleBar[]; forks: ForkEdge[] }) {
  return (
    <>
      {coupleBars.map((bar, i) => (
        <line key={`cb${i}`} x1={bar.x1} y1={bar.y} x2={bar.x2} y2={bar.y}
          stroke={COUPLE_COLOR} strokeWidth={1.5} strokeDasharray="5 3" />
      ))}
      {forks.map((f, i) => (
        <g key={`fk${i}`} stroke={STEM_COLOR} strokeWidth={1.5} fill="none">
          <line x1={f.stemX} y1={f.stemY1} x2={f.stemX} y2={f.crossY} />
          {f.drops.length > 1 && (
            <line x1={f.crossX1} y1={f.crossY} x2={f.crossX2} y2={f.crossY} />
          )}
          {f.drops.map((d, j) => (
            <line key={j} x1={d.x} y1={f.crossY} x2={d.x} y2={d.y2} />
          ))}
        </g>
      ))}
    </>
  );
}

export function TreeCanvas({ dto, selectedPersonId, onPersonSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  // Mouse drag state
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Touch state
  const lastTouchDist = useRef<number | null>(null);
  const lastTouchPos = useRef({ x: 0, y: 0 });

  const layout = useMemo(() => computeLayout(dto), [dto]);

  // ── Pan clamping ─────────────────────────────────────────────────────────────

  const clamp = useCallback((px: number, py: number, s: number) => {
    const el = containerRef.current;
    if (!el) return { x: px, y: py };
    const sw = layout.canvasWidth * s;
    const sh = layout.canvasHeight * s;
    return {
      x: Math.min(el.clientWidth  - EDGE, Math.max(EDGE - sw, px)),
      y: Math.min(el.clientHeight - EDGE, Math.max(EDGE - sh, py)),
    };
  }, [layout.canvasWidth, layout.canvasHeight]);

  // ── Initial fit ──────────────────────────────────────────────────────────────

  const computeFit = useCallback(() => {
    const el = containerRef.current;
    if (!el || layout.canvasWidth === 0) return null;
    const fitScale = Math.min(
      1,
      el.clientWidth  / (layout.canvasWidth  + 80),
      el.clientHeight / (layout.canvasHeight + 80),
    );
    const s = Math.max(fitScale, MIN_LEGIBLE);  // never smaller than legible
    const x = (el.clientWidth  - layout.canvasWidth  * s) / 2;
    const y = fitScale >= MIN_LEGIBLE
      ? (el.clientHeight - layout.canvasHeight * s) / 2
      : 40;
    return { s, ...clamp(x, y, s) };
  }, [layout.canvasWidth, layout.canvasHeight]);

  useEffect(() => {
    const fit = computeFit();
    if (!fit) return;
    setScale(fit.s);
    setPan({ x: fit.x, y: fit.y });
  }, [computeFit]);

  const fitView = useCallback(() => {
    const fit = computeFit();
    if (!fit) return;
    setScale(fit.s);
    setPan({ x: fit.x, y: fit.y });
  }, [computeFit]);

  // ── Zoom helpers ─────────────────────────────────────────────────────────────

  const zoomAround = useCallback((mx: number, my: number, factor: number) => {
    setScale(prev => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
      setPan(p => clamp(
        mx - (next / prev) * (mx - p.x),
        my - (next / prev) * (my - p.y),
        next,
      ));
      return next;
    });
  }, [clamp]);

  const zoomStep = useCallback((factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const { clientWidth, clientHeight } = el;
    zoomAround(clientWidth / 2, clientHeight / 2, factor);
  }, [zoomAround]);

  // ── Mouse wheel ──────────────────────────────────────────────────────────────

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Pinch-to-zoom gesture (trackpad) or Ctrl+scroll
      const rect = containerRef.current!.getBoundingClientRect();
      zoomAround(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.1 : 0.9);
    } else {
      // Two-finger scroll (trackpad) or plain scroll wheel → pan
      setPan(p => clamp(p.x - e.deltaX, p.y - e.deltaY, scale));
    }
  }, [zoomAround, clamp, scale]);

  // ── Touch ────────────────────────────────────────────────────────────────────

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0], t1 = e.touches[1];
      lastTouchDist.current = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      lastTouchPos.current = { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 };
    } else if (e.touches.length === 1) {
      dragging.current = true;
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const rect = containerRef.current!.getBoundingClientRect();
      const mx = (t0.clientX + t1.clientX) / 2 - rect.left;
      const my = (t0.clientY + t1.clientY) / 2 - rect.top;
      zoomAround(mx, my, dist / lastTouchDist.current);
      lastTouchDist.current = dist;
    } else if (e.touches.length === 1 && dragging.current) {
      const dx = e.touches[0].clientX - lastMouse.current.x;
      const dy = e.touches[0].clientY - lastMouse.current.y;
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setPan(p => clamp(p.x + dx, p.y + dy, scale));
    }
  }, [zoomAround, clamp, scale]);

  const onTouchEnd = useCallback(() => {
    dragging.current = false;
    lastTouchDist.current = null;
  }, []);

  // Attach non-passive listeners (needed for preventDefault)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel',      onWheel,      { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd);
    return () => {
      el.removeEventListener('wheel',      onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, [onWheel, onTouchStart, onTouchMove, onTouchEnd]);

  // ── Mouse pan ────────────────────────────────────────────────────────────────

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan(p => clamp(
      p.x + e.clientX - lastMouse.current.x,
      p.y + e.clientY - lastMouse.current.y,
      scale,
    ));
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = () => { dragging.current = false; };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-background cursor-grab active:cursor-grabbing"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Canvas */}
      <div style={{
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
        transformOrigin: '0 0',
        position: 'relative',
        width: layout.canvasWidth,
        height: layout.canvasHeight,
      }}>
        <svg style={{ position: 'absolute', inset: 0, width: layout.canvasWidth, height: layout.canvasHeight, pointerEvents: 'none', overflow: 'visible' }}>
          <Edges coupleBars={layout.coupleBars} forks={layout.forks} />
        </svg>

        {dto.persons.map(person => {
          const pos = layout.positions.get(person.id);
          if (!pos) return null;
          return (
            <PersonCard
              key={person.id}
              person={person}
              selected={selectedPersonId === person.id}
              style={{ left: pos.x, top: pos.y }}
              onClick={() => onPersonSelect(person.id)}
            />
          );
        })}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 z-10">
        <button
          onClick={() => zoomStep(1 / 1.25)}
          className="w-8 h-8 flex items-center justify-center rounded border border-border bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-base leading-none"
          aria-label="Zoom out"
        >−</button>
        <button
          onClick={fitView}
          className="h-8 px-2 flex items-center justify-center rounded border border-border bg-background/80 backdrop-blur-sm text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Fit to screen"
        >fit</button>
        <button
          onClick={() => zoomStep(1.25)}
          className="w-8 h-8 flex items-center justify-center rounded border border-border bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-base leading-none"
          aria-label="Zoom in"
        >+</button>
      </div>
    </div>
  );
}
