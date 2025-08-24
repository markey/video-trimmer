import React from 'react';

// Animated header flourish: centered logo text with a soft, waving rectangle lattice
// Uses lightweight 2D canvas for broad compatibility and tasteful motion.

export const HeaderFlourish: React.FC<{
  height?: number;
  text?: string;
  className?: string;
}> = ({ height = 44, text = 'VIDEO TRIMMER', className }) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const lastFrameRef = React.useRef(0);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    const resize = () => {
      const parent = canvas.parentElement;
      const wCss = Math.max(240, Math.floor(parent ? parent.clientWidth : 320));
      const hCss = Math.floor(height);
      canvas.style.width = wCss + 'px';
      canvas.style.height = hCss + 'px';
      canvas.width = Math.floor(wCss * dpr);
      canvas.height = Math.floor(hCss * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement || canvas);

    const draw = (now: number) => {
      // Cap to ~30fps
      const dt = now - lastFrameRef.current;
      if (dt < 1000 / 30) { rafRef.current = requestAnimationFrame(draw); return; }
      lastFrameRef.current = now;

      const t = now / 1000;
      const w = canvas.width;
      const h = canvas.height;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Background gradient to blend with app header
      const g = ctx.createLinearGradient(0, 0, w / dpr, 0);
      g.addColorStop(0, '#15181c');
      g.addColorStop(1, '#171a1f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w / dpr, h / dpr);

      // Waving rectangle lattice
      const cellX = 18; // px
      const cellY = 14; // px
      const cols = Math.ceil((w / dpr) / cellX) + 2;
      const rows = Math.ceil((h / dpr) / cellY) + 2;
      const amp = 3; // wave amplitude
      const speed = 1.1;

      // Subtle global hue pulsation
      const hueBase = 210 + 10 * Math.sin(t * 0.6);
      const sat = 28 + 4 * Math.sin(t * 0.8 + 1.0);
      const light = 36;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.45;

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = (i - 1) * cellX;
          const yBase = (j - 1) * cellY;
          const phase = i * 0.35 + j * 0.55;
          const wave = Math.sin(phase + t * speed) * amp + Math.sin(phase * 0.6 - t * 0.8) * (amp * 0.4);
          const y = yBase + wave;

          // Horizontal line to right neighbor
          if (i < cols - 1) {
            const x2 = i * cellX;
            const phase2 = (i + 1) * 0.35 + j * 0.55;
            const y2 = yBase + Math.sin(phase2 + t * speed) * amp + Math.sin(phase2 * 0.6 - t * 0.8) * (amp * 0.4);
            const hue = hueBase + 8 * Math.sin((i + j) * 0.25 + t * 0.9);
            ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }

          // Vertical line to bottom neighbor
          if (j < rows - 1) {
            const yb = j * cellY;
            const phaseB = i * 0.35 + (j + 1) * 0.55;
            const yb2 = yb + Math.sin(phaseB + t * speed) * amp + Math.sin(phaseB * 0.6 - t * 0.8) * (amp * 0.4);
            const hue = hueBase + 8 * Math.sin((i + j * 1.3) * 0.2 + t * 0.7 + 1.3);
            ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light - 4}%)`;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, yb2);
            ctx.stroke();
          }
        }
      }

      // Top vignette for subtlety
      const vg = ctx.createLinearGradient(0, 0, 0, h / dpr);
      vg.addColorStop(0, 'rgba(0,0,0,0.22)');
      vg.addColorStop(1, 'rgba(0,0,0,0.06)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w / dpr, h / dpr);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [height]);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        height,
        borderRadius: 8,
        overflow: 'hidden',
        background: 'linear-gradient(90deg, #15181c, #171a1f)',
        boxShadow: 'inset 0 0 0 1px #2a2d31',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
          fontWeight: 800,
          letterSpacing: '2px',
          fontSize: Math.max(12, Math.min(24, Math.floor(height * 0.5))),
          color: '#d8e1ea',
          textShadow: '0 1px 0 rgba(0,0,0,0.4), 0 0 6px rgba(80,120,200,0.15)',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          opacity: 0.92,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default HeaderFlourish;
