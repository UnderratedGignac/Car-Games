import React, { useRef } from 'react';

interface SteeringWheelProps {
  value: number; // -1 (left) .. 0 .. +1 (right)
  onChange: (nextValue: number) => void;
}

export const SteeringWheel: React.FC<SteeringWheelProps> = React.memo(({ value, onChange }) => {
  const wheelRef = useRef<HTMLButtonElement | null>(null);
  const dragAnchorXRef = useRef<number | null>(null);

  const computeSteerFromPointer = (clientX: number, rect: DOMRect) => {
    const centerX = rect.left + rect.width * 0.5;
    // Anchor at center so touching left/right rim gives instant steer, and dragging across tunes lock cleanly
    const dx = clientX - centerX;
    const maxRadius = Math.max(18, rect.width * 0.42);
    const normalized = Math.max(-1, Math.min(1, dx / maxRadius));
    // Slight deadzone right at exact dead-center if dragging back through zero
    if (Math.abs(normalized) < 0.12 && dragAnchorXRef.current !== null) {
      return 0;
    }
    return Number(normalized.toFixed(2));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = wheelRef.current;
    if (!el) return;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {}
    dragAnchorXRef.current = e.clientX;
    const rect = el.getBoundingClientRect();
    const next = computeSteerFromPointer(e.clientX, rect);
    // Tapping near center defaults softly right or left based on half
    if (next === 0) {
      const centerX = rect.left + rect.width * 0.5;
      onChange(e.clientX < centerX ? -0.75 : 0.75);
    } else {
      onChange(next);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragAnchorXRef.current === null || !wheelRef.current) return;
    e.preventDefault();
    const rect = wheelRef.current.getBoundingClientRect();
    onChange(computeSteerFromPointer(e.clientX, rect));
  };

  const releaseWheel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragAnchorXRef.current === null) return;
    dragAnchorXRef.current = null;
    try {
      wheelRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
    onChange(0);
  };

  const angleDeg = Math.round(Math.max(-1, Math.min(1, value)) * 56);
  const isTurning = Math.abs(value) > 0.08;

  return (
    <button
      ref={wheelRef}
      type="button"
      data-hud-btn="true"
      data-testid="steering-wheel"
      tabIndex={-1}
      aria-label="Steering Wheel (Drag or Hold Left/Right to Steer)"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releaseWheel}
      onPointerCancel={releaseWheel}
      onLostPointerCapture={releaseWheel}
      className={`relative w-[60px] h-[60px] sm:w-[76px] sm:h-[76px] shrink-0 rounded-full flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing focus:outline-none transition-shadow ${
        isTurning
          ? 'ring-2 ring-amber-400/90 shadow-[0_0_16px_rgba(245,158,11,0.35)]'
          : 'ring-1 ring-slate-700/90 hover:ring-slate-500'
      }`}
      style={{ backgroundColor: '#090e1a' }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full transition-transform duration-75"
        style={{ transform: `rotate(${angleDeg}deg)` }}
        aria-hidden="true"
      >
        {/* Outer Alcantara/Carbon Wheel Rim */}
        <circle
          cx="50"
          cy="50"
          r="41"
          fill="none"
          stroke="#1e293b"
          strokeWidth="12"
        />
        <circle
          cx="50"
          cy="50"
          r="41"
          fill="none"
          stroke="#0f172a"
          strokeWidth="8.5"
        />
        {/* Side Ergonomic Thumb Bolsters */}
        <path
          d="M 11 40 A 41 41 0 0 0 11 60"
          fill="none"
          stroke="#334155"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 89 40 A 41 41 0 0 1 89 60"
          fill="none"
          stroke="#334155"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* 12 O'Clock Yellow Centering Stripe */}
        <path
          d="M 45 9.5 A 41 41 0 0 1 55 9.5"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="10.5"
          strokeLinecap="butt"
        />
        {/* Brushed Titanium 3-Spoke Core */}
        <path
          d="M 14 48 L 41 48 L 44 54 L 14 55 Z"
          fill="#64748b"
        />
        <path
          d="M 86 48 L 59 48 L 56 54 L 86 55 Z"
          fill="#64748b"
        />
        <path
          d="M 46 58 L 54 58 L 55 88 L 45 88 Z"
          fill="#475569"
        />
        {/* Weight-Saving Spoke Cutouts */}
        <circle cx="27" cy="51.5" r="2.2" fill="#090e1a" />
        <circle cx="73" cy="51.5" r="2.2" fill="#090e1a" />
        <rect x="48.2" y="68" width="3.6" height="11" rx="1.5" fill="#090e1a" />
        {/* Center Horn Hub & 6-Bolt Ring */}
        <circle
          cx="50"
          cy="50"
          r="14"
          fill="#0f172a"
          stroke={isTurning ? '#f59e0b' : '#475569'}
          strokeWidth="2.4"
        />
        <circle
          cx="50"
          cy="50"
          r="7"
          fill={isTurning ? '#f59e0b' : '#1e293b'}
        />
        <polygon
          points="50,45 53.5,52 50,50.5 46.5,52"
          fill={isTurning ? '#090e1a' : '#22d3ee'}
        />
      </svg>
    </button>
  );
});
