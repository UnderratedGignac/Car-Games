import React from 'react';

interface RealisticPedalsProps {
  accelHold: boolean;
  brakeHold: boolean;
  onAccelChange: (holding: boolean) => void;
  onBrakeChange: (holding: boolean) => void;
}

/**
 * Photorealistic Brushed Billet-Aluminum Motorsport Racing Pedals
 * Precision drilled lightning holes, non-slip knurled rubber traction studs,
 * beveled chamfer edges, and 3D mechanical depression upon thumb contact.
 */
export const RealisticPedals: React.FC<RealisticPedalsProps> = React.memo(({
  accelHold,
  brakeHold,
  onAccelChange,
  onBrakeChange,
}) => {
  return (
    <div
      className="flex items-end gap-2 sm:gap-3 shrink-0 select-none touch-none"
      style={{ perspective: '320px' }}
      role="group"
      aria-label="Vehicle Foot Pedals"
    >
      {/* ============================================================ */}
      {/* 1. BRAKE PEDAL (Heavy-duty wide forged aluminum footplate)    */}
      {/* ============================================================ */}
      <button
        type="button"
        data-hud-btn="true"
        data-testid="pedal-brake"
        tabIndex={-1}
        aria-label="Brake Pedal"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
          onAccelChange(false);
          onBrakeChange(true);
        }}
        onPointerUp={(e) => {
          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
          onBrakeChange(false);
        }}
        onPointerCancel={() => onBrakeChange(false)}
        onPointerLeave={(e) => {
          // If pointer captured, ignore leave
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
            onBrakeChange(false);
          }
        }}
        className={`relative w-[56px] h-[58px] sm:w-[68px] sm:h-[68px] rounded-xl flex items-center justify-center cursor-pointer transition-all duration-75 outline-none focus:outline-none ${
          brakeHold
            ? 'scale-[0.94] translate-y-1 shadow-[0_2px_8px_rgba(239,68,68,0.5)]'
            : 'shadow-[0_8px_18px_rgba(0,0,0,0.85),0_2px_0_#1e293b] hover:brightness-105'
        }`}
        style={{
          transform: brakeHold
            ? 'rotateX(18deg) translateY(3px) scale(0.95)'
            : 'rotateX(8deg)',
          transformOrigin: 'top center',
        }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-md"
          aria-hidden="true"
        >
          <defs>
            {/* Metallic Brushed Aluminum Plate Gradient */}
            <linearGradient id="brakePlateGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={brakeHold ? '#ef4444' : '#94a3b8'} />
              <stop offset="25%" stopColor={brakeHold ? '#b91c1c' : '#cbd5e1'} />
              <stop offset="50%" stopColor={brakeHold ? '#991b1b' : '#64748b'} />
              <stop offset="75%" stopColor={brakeHold ? '#dc2626' : '#cbd5e1'} />
              <stop offset="100%" stopColor={brakeHold ? '#7f1d1d' : '#475569'} />
            </linearGradient>

            {/* Inner Plate Bevel */}
            <linearGradient id="plateInnerBevel" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="15%" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="85%" stopColor="#000000" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.7" />
            </linearGradient>

            {/* Rubber Traction Stud Gradient */}
            <radialGradient id="rubberStudGrad" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="60%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </radialGradient>
          </defs>

          {/* Cast Iron Throttle Linkage Arm (Visible behind top) */}
          <path d="M 44 0 L 56 0 L 54 18 L 46 18 Z" fill="#1e293b" />
          <rect x="42" y="10" width="16" height="5" rx="2" fill="#0f172a" />

          {/* Outer Beveled Footplate Base */}
          <rect
            x="6"
            y="14"
            width="88"
            height="78"
            rx="12"
            fill="url(#brakePlateGrad)"
            stroke={brakeHold ? '#fca5a5' : '#e2e8f0'}
            strokeWidth="2.2"
          />

          {/* Machined Chamfer Inner Border */}
          <rect
            x="9"
            y="17"
            width="82"
            height="72"
            rx="9"
            fill="url(#plateInnerBevel)"
          />

          {/* Dark Rubber Grip Inset Tray */}
          <rect
            x="14"
            y="22"
            width="72"
            height="62"
            rx="6"
            fill="#090d16"
            stroke="#1e293b"
            strokeWidth="1.2"
          />

          {/* 6 Drilled High-Traction Rubber Grip Studs */}
          {/* Row 1 */}
          <circle cx="28" cy="36" r="6.5" fill="url(#rubberStudGrad)" stroke="#64748b" strokeWidth="1" />
          <circle cx="50" cy="36" r="6.5" fill="url(#rubberStudGrad)" stroke="#64748b" strokeWidth="1" />
          <circle cx="72" cy="36" r="6.5" fill="url(#rubberStudGrad)" stroke="#64748b" strokeWidth="1" />

          {/* Row 2 */}
          <circle cx="28" cy="54" r="6.5" fill="url(#rubberStudGrad)" stroke="#64748b" strokeWidth="1" />
          <circle cx="50" cy="54" r="6.5" fill="url(#rubberStudGrad)" stroke="#64748b" strokeWidth="1" />
          <circle cx="72" cy="54" r="6.5" fill="url(#rubberStudGrad)" stroke="#64748b" strokeWidth="1" />

          {/* Rubber Stud Centers (Grip Texture) */}
          <circle cx="28" cy="36" r="3" fill="#020617" />
          <circle cx="50" cy="36" r="3" fill="#020617" />
          <circle cx="72" cy="36" r="3" fill="#020617" />
          <circle cx="28" cy="54" r="3" fill="#020617" />
          <circle cx="50" cy="54" r="3" fill="#020617" />
          <circle cx="72" cy="54" r="3" fill="#020617" />

          {/* 4 Stainless Steel Countersunk Allen Mounting Bolts */}
          <circle cx="13" cy="21" r="2.2" fill="#0f172a" stroke="#cbd5e1" strokeWidth="0.8" />
          <circle cx="87" cy="21" r="2.2" fill="#0f172a" stroke="#cbd5e1" strokeWidth="0.8" />
          <circle cx="13" cy="85" r="2.2" fill="#0f172a" stroke="#cbd5e1" strokeWidth="0.8" />
          <circle cx="87" cy="85" r="2.2" fill="#0f172a" stroke="#cbd5e1" strokeWidth="0.8" />

          {/* Heavy Duty Stamped Steel Bottom Lip */}
          <rect x="18" y="70" width="64" height="8" rx="2" fill={brakeHold ? '#ef4444' : '#334155'} />
          <text
            x="50"
            y="76.5"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="6.5"
            fontWeight="bold"
            letterSpacing="0.8"
            fontFamily="monospace"
          >
            BRAKE
          </text>
        </svg>
      </button>

      {/* ============================================================ */}
      {/* 2. GAS (THROTTLE) PEDAL (Slender curved racing organ pedal)  */}
      {/* ============================================================ */}
      <button
        type="button"
        data-hud-btn="true"
        data-testid="pedal-gas"
        tabIndex={-1}
        aria-label="Gas Accelerator Pedal"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
          onBrakeChange(false);
          onAccelChange(true);
        }}
        onPointerUp={(e) => {
          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
          onAccelChange(false);
        }}
        onPointerCancel={() => onAccelChange(false)}
        onPointerLeave={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
            onAccelChange(false);
          }
        }}
        className={`relative w-[50px] h-[72px] sm:w-[62px] sm:h-[84px] rounded-xl flex items-center justify-center cursor-pointer transition-all duration-75 outline-none focus:outline-none ${
          accelHold
            ? 'scale-[0.95] translate-y-1.5 shadow-[0_2px_10px_rgba(34,197,94,0.55)]'
            : 'shadow-[0_10px_22px_rgba(0,0,0,0.88),0_3px_0_#1e293b] hover:brightness-105'
        }`}
        style={{
          transform: accelHold
            ? 'rotateX(22deg) translateY(4px) scale(0.96)'
            : 'rotateX(10deg)',
          transformOrigin: 'top center',
        }}
      >
        <svg
          viewBox="0 0 90 120"
          className="w-full h-full drop-shadow-md"
          aria-hidden="true"
        >
          <defs>
            {/* Anodized Brushed Silver / Active Neon Green Gradient */}
            <linearGradient id="gasPlateGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={accelHold ? '#22c55e' : '#cbd5e1'} />
              <stop offset="20%" stopColor={accelHold ? '#15803d' : '#f1f5f9'} />
              <stop offset="50%" stopColor={accelHold ? '#166534' : '#64748b'} />
              <stop offset="80%" stopColor={accelHold ? '#22c55e' : '#cbd5e1'} />
              <stop offset="100%" stopColor={accelHold ? '#14532d' : '#334155'} />
            </linearGradient>

            {/* Chamfer Edge Sheen */}
            <linearGradient id="gasSheen" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="30%" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="70%" stopColor="#000000" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.75" />
            </linearGradient>
          </defs>

          {/* Top Pivot Bushing & Mechanical Throttle Cable Bracket */}
          <rect x="36" y="0" width="18" height="12" rx="3" fill="#1e293b" />
          <circle cx="45" cy="6" r="3" fill="#0f172a" stroke="#64748b" strokeWidth="1" />

          {/* Ergonomic Curved Organ Footplate Body */}
          <path
            d="M 12 16 
               Q 10 14 16 14 
               L 74 14 
               Q 80 14 78 16 
               L 72 108 
               Q 70 114 64 114 
               L 26 114 
               Q 20 114 18 108 
               Z"
            fill="url(#gasPlateGrad)"
            stroke={accelHold ? '#86efac' : '#e2e8f0'}
            strokeWidth="2.2"
          />

          {/* Polished Surface Chamfer */}
          <path
            d="M 16 18 L 74 18 L 68 108 L 22 108 Z"
            fill="url(#gasSheen)"
          />

          {/* Inner Recessed Grip Bed */}
          <path
            d="M 20 22 L 70 22 L 65 104 L 25 104 Z"
            fill="#090d16"
            stroke="#1e293b"
            strokeWidth="1.2"
          />

          {/* Vertical Precision Drilled Lightning Slots with Rubber Underlay */}
          {/* Column 1 */}
          <rect x="27" y="28" width="8" height="22" rx="4" fill={accelHold ? '#22c55e' : '#334155'} />
          <rect x="27" y="56" width="8" height="22" rx="4" fill={accelHold ? '#22c55e' : '#334155'} />
          <circle cx="31" cy="90" r="4.5" fill="url(#rubberStudGrad)" stroke="#64748b" strokeWidth="1" />

          {/* Column 2 (Center) */}
          <rect x="41" y="28" width="8" height="22" rx="4" fill={accelHold ? '#22c55e' : '#334155'} />
          <rect x="41" y="56" width="8" height="22" rx="4" fill={accelHold ? '#22c55e' : '#334155'} />
          <circle cx="45" cy="90" r="4.5" fill="url(#rubberStudGrad)" stroke="#64748b" strokeWidth="1" />

          {/* Column 3 */}
          <rect x="55" y="28" width="8" height="22" rx="4" fill={accelHold ? '#22c55e' : '#334155'} />
          <rect x="55" y="56" width="8" height="22" rx="4" fill={accelHold ? '#22c55e' : '#334155'} />
          <circle cx="59" cy="90" r="4.5" fill="url(#rubberStudGrad)" stroke="#64748b" strokeWidth="1" />

          {/* Rubber Friction Gripping Stud Centers */}
          <rect x="29" y="32" width="4" height="14" rx="2" fill="#020617" />
          <rect x="43" y="32" width="4" height="14" rx="2" fill="#020617" />
          <rect x="57" y="32" width="4" height="14" rx="2" fill="#020617" />
          <rect x="29" y="60" width="4" height="14" rx="2" fill="#020617" />
          <rect x="43" y="60" width="4" height="14" rx="2" fill="#020617" />
          <rect x="57" y="60" width="4" height="14" rx="2" fill="#020617" />
          <circle cx="31" cy="90" r="2" fill="#020617" />
          <circle cx="45" cy="90" r="2" fill="#020617" />
          <circle cx="59" cy="90" r="2" fill="#020617" />

          {/* Bottom Heel Rest & Emossed Label */}
          <rect x="26" y="99" width="38" height="6.5" rx="2" fill={accelHold ? '#22c55e' : '#1e293b'} />
          <text
            x="45"
            y="104.5"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="5.5"
            fontWeight="bold"
            letterSpacing="0.8"
            fontFamily="monospace"
          >
            GAS
          </text>
        </svg>
      </button>
    </div>
  );
});

