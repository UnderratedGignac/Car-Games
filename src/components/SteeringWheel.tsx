import React, { useRef, useState } from 'react';
import { computeWheelSteer } from '../game/controls';

interface SteeringWheelProps {
  value: number; // -1 (left) .. 0 .. +1 (right)
  onChange: (nextValue: number) => void;
  onHorn?: () => void;
  large?: boolean;
}

/**
 * Responsive Motorsport Steering Wheel
 * Supports multi-touch pointerId isolation, smooth rotary + horizontal drag with
 * zero bottom-rim sign inversion, center-hub quick tap for horn, and compact mobile sizing.
 */
export const SteeringWheel: React.FC<SteeringWheelProps> = React.memo(({
  value,
  onChange,
  onHorn,
  large = false,
}) => {
  const wheelRef = useRef<HTMLButtonElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
    hornCandidate: boolean;
    startAngleRad: number;
    startValue: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = wheelRef.current;
    if (!el) return;
    if (dragStateRef.current) return; // Ignore stray extra fingers while wheel is already gripped
    try {
      el.setPointerCapture(e.pointerId);
    } catch {}
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width * 0.5;
    const centerY = rect.top + rect.height * 0.5;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const distFromCenter = Math.hypot(dx, dy);
    const hornCandidate = distFromCenter < rect.width * 0.19 && Boolean(onHorn);

    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      hornCandidate,
      startAngleRad: Math.atan2(dy, dx),
      startValue: Math.max(-1, Math.min(1, value)),
    };
    setIsDragging(true);

    // Touching the left/right rim outside center steers smoothly right away
    if (!hornCandidate && Math.abs(dx) > rect.width * 0.13) {
      const immediate = Math.max(-1, Math.min(1, dx / Math.max(22, rect.width * 0.44)));
      onChange(Number(immediate.toFixed(2)));
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== e.pointerId || !wheelRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    if (!state.moved && Math.hypot(e.clientX - state.startX, e.clientY - state.startY) > 5) {
      state.moved = true;
    }
    if (state.hornCandidate && !state.moved) return;
    const rect = wheelRef.current.getBoundingClientRect();
    onChange(
      computeWheelSteer({
        clientX: e.clientX,
        clientY: e.clientY,
        startX: state.startX,
        startY: state.startY,
        rect,
        startAngleRad: state.startAngleRad,
        startValue: state.startValue,
      })
    );
  };

  const releaseWheel = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    e.stopPropagation();
    dragStateRef.current = null;
    setIsDragging(false);
    try {
      wheelRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
    if (state.hornCandidate && !state.moved && onHorn) {
      onHorn();
    }
    onChange(0);
  };

  const clampedValue = Math.max(-1, Math.min(1, value));
  const angleDeg = Math.round(clampedValue * 82);
  const isTurning = Math.abs(clampedValue) > 0.08;

  return (
    <button
      ref={wheelRef}
      type="button"
      data-hud-btn="true"
      data-testid="steering-wheel"
      tabIndex={-1}
      aria-label="Steering Wheel (Touch or drag left/right to steer, tap center for horn)"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releaseWheel}
      onPointerCancel={releaseWheel}
      onLostPointerCapture={releaseWheel}
      className={`relative ${
        large
          ? 'w-[78px] h-[78px] sm:w-[92px] sm:h-[92px]'
          : 'w-[66px] h-[66px] sm:w-[82px] sm:h-[82px]'
      } shrink-0 rounded-full flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing focus:outline-none transition-shadow ${
        isTurning
          ? 'ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.45)]'
          : 'ring-1 ring-slate-700/90 hover:ring-slate-500 shadow-[0_8px_20px_rgba(0,0,0,0.8)]'
      }`}
      style={{ backgroundColor: '#070a14' }}
    >
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full drop-shadow-lg ${isDragging ? '' : 'transition-transform duration-75'}`}
        style={{ transform: `rotate(${angleDeg}deg)` }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="wheelRimShading" cx="50%" cy="40%" r="55%">
            <stop offset="65%" stopColor="#1e293b" />
            <stop offset="85%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>
          <linearGradient id="spokeTitanium" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="45%" stopColor="#475569" />
            <stop offset="55%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <radialGradient id="hubCarbon" cx="45%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="70%" stopColor="#090d16" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>
        </defs>

        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="url(#wheelRimShading)"
          strokeWidth="11"
        />
        <circle cx="50" cy="50" r="47" fill="none" stroke="#0b0f19" strokeWidth="1.2" />
        <circle cx="50" cy="50" r="37" fill="none" stroke="#0b0f19" strokeWidth="1.2" />
        <circle
          cx="50"
          cy="50"
          r="38.5"
          fill="none"
          stroke="#ef4444"
          strokeWidth="0.8"
          strokeDasharray="1.2 2.2"
          opacity="0.85"
        />

        <path
          d="M 9.5 38 A 42 42 0 0 0 9.5 62"
          fill="none"
          stroke="#334155"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 90.5 38 A 42 42 0 0 1 90.5 62"
          fill="none"
          stroke="#334155"
          strokeWidth="12"
          strokeLinecap="round"
        />

        <path
          d="M 44.5 8.5 A 42 42 0 0 1 55.5 8.5"
          fill="none"
          stroke={isTurning ? '#22d3ee' : '#f59e0b'}
          strokeWidth="11.5"
          strokeLinecap="butt"
        />

        <polygon
          points="13,46 41,47 44,53 13,54"
          fill="url(#spokeTitanium)"
          stroke="#475569"
          strokeWidth="0.6"
        />
        <polygon
          points="87,46 59,47 56,53 87,54"
          fill="url(#spokeTitanium)"
          stroke="#475569"
          strokeWidth="0.6"
        />
        <polygon
          points="46,58 54,58 56,87 44,87"
          fill="url(#spokeTitanium)"
          stroke="#475569"
          strokeWidth="0.6"
        />

        <circle cx="26" cy="50" r="2.8" fill="#070a14" stroke="#1e293b" strokeWidth="0.8" />
        <circle cx="74" cy="50" r="2.8" fill="#070a14" stroke="#1e293b" strokeWidth="0.8" />
        <rect x="48" y="66" width="4" height="12" rx="2" fill="#070a14" stroke="#1e293b" strokeWidth="0.8" />

        <circle
          cx="50"
          cy="50"
          r="15"
          fill="url(#hubCarbon)"
          stroke={isTurning ? '#38bdf8' : '#64748b'}
          strokeWidth="2.2"
        />
        <circle cx="50" cy="38" r="1.2" fill="#cbd5e1" />
        <circle cx="60.4" cy="44" r="1.2" fill="#cbd5e1" />
        <circle cx="60.4" cy="56" r="1.2" fill="#cbd5e1" />
        <circle cx="50" cy="62" r="1.2" fill="#cbd5e1" />
        <circle cx="39.6" cy="56" r="1.2" fill="#cbd5e1" />
        <circle cx="39.6" cy="44" r="1.2" fill="#cbd5e1" />

        <circle
          cx="50"
          cy="50"
          r="8"
          fill={isTurning ? '#0284c7' : '#0f172a'}
          stroke="#38bdf8"
          strokeWidth="1.2"
        />
        <polygon
          points="50,44.5 54.5,52 50,50.2 45.5,52"
          fill={isTurning ? '#ffffff' : '#f59e0b'}
        />
      </svg>
    </button>
  );
});
