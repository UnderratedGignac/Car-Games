import React, { useState } from 'react';

interface ArtGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ArtworkEntry {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  imageSrc: string;
  description: string;
}

const ARTWORKS: ArtworkEntry[] = [
  {
    id: 'poster',
    title: 'Tokyo Midnight Touge — Blockbuster Key Art',
    subtitle: 'Midnight Mountain Hairpin Drift',
    tag: 'Official Poster',
    imageSrc: './images/game_poster.jpg',
    description:
      'An aggressive widebody custom supercar drifting sideways through a mountain touge corner in Tokyo at midnight. Underbody cyan neon glow, tire smoke illuminated by neon taillights, massive glowing full moon, and the Tokyo Tower skyline on the horizon.',
  },
  {
    id: 'cockpit',
    title: 'Hyper-Realistic First-Person Cockpit POV',
    subtitle: 'Tokyo Shuto Expressway at 240 KM/H',
    tag: '1st Person Cockpit',
    imageSrc: './images/cockpit_pov.jpg',
    description:
      "A photorealistic driver's cockpit view inside a tuned Japanese twin-turbo coupe. Features the sculpted electric-blue hood projecting onto rain-slicked Tokyo asphalt, Alcantara racing steering wheel with yellow 12 o'clock marker, digital LED shift lights, and optical speed streaks.",
  },
];

export const ArtGalleryModal: React.FC<ArtGalleryModalProps> = React.memo(({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'poster' | 'cockpit'>('poster');

  if (!isOpen) return null;

  const currentArt = ARTWORKS.find((a) => a.id === activeTab) || ARTWORKS[0];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 pointer-events-auto"
      style={{ backgroundColor: 'rgba(5, 8, 17, 0.90)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="NEON REDLINE Art Gallery"
    >
      <div
        className="relative w-full max-w-lg max-h-[92dvh] flex flex-col rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#090e1a' }}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between p-3.5 border-b border-slate-800/90 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" aria-hidden="true" />
            <h2 className="text-base font-display font-bold text-white tracking-wide">
              NEON REDLINE Gallery
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Gallery"
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 p-2 gap-1.5 bg-slate-950/80 border-b border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('poster')}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'poster'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <span>🏎️ Key Art Poster</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cockpit')}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'cockpit'
                ? 'bg-cyan-400 text-slate-950 font-bold shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <span>👁️ Cockpit POV Art</span>
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 overscroll-contain">
          {/* Main Visual Image Card */}
          <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-inner group">
            <img
              src={currentArt.imageSrc}
              alt={currentArt.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              loading="eager"
            />
            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-slate-950/85 border border-white/20 text-[10px] font-mono font-bold tracking-wider text-amber-400">
              {currentArt.tag}
            </div>
          </div>

          {/* Image Information & Description */}
          <div className="space-y-1.5">
            <h3 className="text-sm font-display font-bold text-white">
              {currentArt.title}
            </h3>
            <p className="text-xs font-mono text-cyan-300 font-medium">
              {currentArt.subtitle}
            </p>
            <p className="text-xs text-slate-300 leading-relaxed pt-1">
              {currentArt.description}
            </p>
          </div>
        </div>

        {/* Footer Dismiss Button */}
        <div className="p-3 border-t border-slate-800/90 bg-slate-950/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs tracking-wider uppercase transition-colors"
          >
            Back to Garage &amp; Track
          </button>
        </div>
      </div>
    </div>
  );
});
