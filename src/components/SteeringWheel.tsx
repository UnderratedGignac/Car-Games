import React, { useRef } from 'react';

interface SteeringWheelProps {
  value: number; // -1 (left) .. 0 .. +1 (right)
  onChange: (nextValue: number) => void;
  onHorn?: () => void;
}

/**
 * Photorealistic Alcantara & Anodized Titanium 3-Spoke Motorsport Steering Wheel
 * Features hand-stitched inner rim seam, 12 o'clock yellow centering line,
 * brushed titanium spokes with lightening cutouts, center horn hub with Allen bolts,
 * and fluid touch-drag steering physics.
 */
export const SteeringWheel: React.FC<SteeringWheelProps> = React.memo(({
  value,
  onChange,
  onHorn,
}) => {
  const wheelRef = useRef<HTMLButtonElement | null>(null);
  const dragAnchorXRef = useRef<number | null>(null);

  const computeSteerFromPointer = (clientX: number, rect: DOMRect) => {
    const centerX = rect.left + rect.width * 0.5;
    const dx = clientX - centerX;
    const maxRadius = Math.max(20, rect.width * 0.44);
    const normalized = Math.max(-1, Math.min(1, dx / maxRadius));
    // Soft center deadzone
    if (Math.abs(normalized) < 0.10 && dragAnchorXRef.current !== null) {
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

    // Check if user tapped directly in the dead center hub (Horn button!)
    const centerX = rect.left + rect.width * 0.5;
    const centerY = rect.top + rect.height * 0.5;
    const distFromCenter = Math.hypot(e.clientX - centerX, e.clientY - centerY);
    if (distFromCenter < rect.width * 0.20 && onHorn) {
      onHorn();
      return;
    }

    const next = computeSteerFromPointer(e.clientX, rect);
    if (next === 0) {
      onChange(e.clientX < centerX ? -0.80 : 0.80);
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

  const angleDeg = Math.round(Math.max(-1, Math.min(1, value)) * 62);
  const isTurning = Math.abs(value) > 0.08;

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
      className={`relative w-[68px] h-[68px] sm:w-[84px] sm:h-[84px] shrink-0 rounded-full flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing focus:outline-none transition-shadow ${
        isTurning
          ? 'ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.45)]'
          : 'ring-1 ring-slate-700/90 hover:ring-slate-500 shadow-[0_8px_20px_rgba(0,0,0,0.8)]'
      }`}
      style={{ backgroundColor: '#070a14' }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full transition-transform duration-75 drop-shadow-lg"
        style={{ transform: `rotate(${angleDeg}deg)` }}
        aria-hidden="true"
      >
        <defs>
          {/* Wheel Rim Depth & Texture */}
          <radialGradient id="wheelRimShading" cx="50%" cy="40%" r="55%">
            <stop offset="65%" stopColor="#1e293b" />
            <stop offset="85%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>

          {/* Brushed Anodized Titanium Spokes */}
          <linearGradient id="spokeTitanium" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="45%" stopColor="#475569" />
            <stop offset="55%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          {/* Carbon Fiber Hub Center */}
          <radialGradient id="hubCarbon" cx="45%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="70%" stopColor="#090d16" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>
        </defs>

        {/* 1. Deep Outer Alcantara / Leather Rim */}
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="url(#wheelRimShading)"
          strokeWidth="11"
        />

        {/* Outer Rim Edge Highlight & Seam */}
        <circle
          cx="50"
          cy="50"
          r="47"
          fill="none"
          stroke="#0b0f19"
          strokeWidth="1.2"
        />
        <circle
          cx="50"
          cy="50"
          r="37"
          fill="none"
          stroke="#0b0f19"
          strokeWidth="1.2"
        />

        {/* Inner Red Baseball Stitching Along Rim */}
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

        {/* Ergonomic Molded 9 and 3 O'clock Thumb Grips */}
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

        {/* 12 O'Clock Racing Centering Stripe */}
        <path
          d="M 44.5 8.5 A 42 42 0 0 1 55.5 8.5"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="11.5"
          strokeLinecap="butt"
        />

        {/* 2. Brushed Titanium 3-Spoke Assembly */}
        {/* Left Spoke */}
        <polygon
          points="13,46 41,47 44,53 13,54"
          fill="url(#spokeTitanium)"
          stroke="#475569"
          strokeWidth="0.6"
        />
        {/* Right Spoke */}
        <polygon
          points="87,46 59,47 56,53 87,54"
          fill="url(#spokeTitanium)"
          stroke="#475569"
          strokeWidth="0.6"
        />
        {/* Bottom Vertical Spoke */}
        <polygon
          points="46,58 54,58 56,87 44,87"
          fill="url(#spokeTitanium)"
          stroke="#475569"
          strokeWidth="0.6"
        />

        {/* Precision Drilled Weight-Saving Spoke Cutouts */}
        <circle cx="26" cy="50" r="2.8" fill="#070a14" stroke="#1e293b" strokeWidth="0.8" />
        <circle cx="74" cy="50" r="2.8" fill="#070a14" stroke="#1e293b" strokeWidth="0.8" />
        <rect x="48" y="66" width="4" height="12" rx="2" fill="#070a14" stroke="#1e293b" strokeWidth="0.8" />

        {/* 3. Center Horn Hub with Hex Bolt Ring */}
        <circle
          cx="50"
          cy="50"
          r="15"
          fill="url(#hubCarbon)"
          stroke={isTurning ? '#38bdf8' : '#64748b'}
          strokeWidth="2.2"
        />

        {/* 6 Stainless Socket-Head Allen Screws */}
        <circle cx="50" cy="38" r="1.2" fill="#cbd5e1" />
        <circle cx="60.4" cy="44" r="1.2" fill="#cbd5e1" />
        <circle cx="60.4" cy="56" r="1.2" fill="#cbd5e1" />
        <circle cx="50" cy="62" r="1.2" fill="#cbd5e1" />
        <circle cx="39.6" cy="56" r="1.2" fill="#cbd5e1" />
        <circle cx="39.6" cy="44" r="1.2" fill="#cbd5e1" />

        {/* Center Raised Enamel Horn Button */}
        <circle
          cx="50"
          cy="50"
          r="8"
          fill={isTurning ? '#0284c7' : '#0f172a'}
          stroke="#38bdf8"
          strokeWidth="1.2"
        />

        {/* Redline Emblem / Arrow Logo on Horn */}
        <polygon
          points="50,44.5 54.5,52 50,50.2 45.5,52"
          fill={isTurning ? '#ffffff' : '#f59e0b'}
        />
      </svg>
    </button>
  );
});
