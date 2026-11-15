import React, { useState } from 'react';
import neonTougeImg from '../assets/images/neon_touge_showdown_1794662834025.jpg';
import alpineSakuraImg from '../assets/images/alpine_sakura_vista_1794662835660.jpg';
import studioPaddockImg from '../assets/images/studio_paddock_bay_1794662835288.jpg';

interface ArtGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ArtworkEntry {
  id: string;
  title: string;
  shortLabel: string;
  subtitle: string;
  tag: string;
  imageSrc: string;
  description: string;
}

const ARTWORKS: ArtworkEntry[] = [
  {
    id: 'touge_battle',
    title: 'Tokyo Midnight Touge — Twin Drift Battle',
    shortLabel: 'Touge Battle',
    subtitle: 'Rain-Slicked Hairpin · Midnight Express',
    tag: 'Showcase Art',
    imageSrc: neonTougeImg,
    description:
      'Two widebody JDM coupes sliding door-to-door through a rain-drenched mountain hairpin above Tokyo Bay, with glowing cyan and amber neon reflections cutting across wet asphalt and illuminated tire smoke.',
  },
  {
    id: 'sakura_vista',
    title: 'Sakura Ridge Viaduct — Golden Hour',
    shortLabel: 'Sakura Pass',
    subtitle: 'Alpine Cherry Blossom Pass · Crepuscular Rays',
    tag: 'Biome Concept',
    imageSrc: alpineSakuraImg,
    description:
      'Elevated mountain expressway carved along emerald peaks and cherry blossom slopes at sunset, featuring warm volumetric clouds, steel guardrails, and sweeping canyon switchbacks.',
  },
  {
    id: 'studio_bay',
    title: 'Underground Paddock & Tuning Bay',
    shortLabel: 'Studio Bay',
    subtitle: 'Hex-LED Showroom · Brushed Obsidian Slate',
    tag: 'Paddock Studio',
    imageSrc: studioPaddockImg,
    description:
      'Subterranean motorsport tuning bay bathed in overhead hexagonal softbox LED arrays and dual cyan/amber rim strips reflecting across dark polished studio concrete.',
  },
  {
    id: 'poster',
    title: 'Tokyo Midnight Touge — Key Art Poster',
    shortLabel: 'Key Poster',
    subtitle: 'Midnight Mountain Hairpin Drift',
    tag: 'Official Poster',
    imageSrc: './images/game_poster.jpg',
    description:
      'An aggressive widebody custom supercar drifting sideways through a mountain touge corner in Tokyo at midnight with underbody cyan neon glow and the full moon rising over the skyline.',
  },
  {
    id: 'cockpit',
    title: 'First-Person Shuto Cockpit POV',
    shortLabel: 'Cockpit POV',
    subtitle: 'Tokyo Shuto Expressway at 240 KM/H',
    tag: 'Cockpit View',
    imageSrc: './images/cockpit_pov.jpg',
    description:
      "Driver's cockpit perspective inside a tuned Japanese twin-turbo coupe featuring Alcantara racing wheel, digital LED shift lights, and rain-slicked expressway speed streaks.",
  },
];

export const ArtGalleryModal: React.FC<ArtGalleryModalProps> = React.memo(({
  isOpen,
  onClose,
}) => {
  const [activeId, setActiveId] = useState<string>('touge_battle');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const currentArt = ARTWORKS.find((a) => a.id === activeId) || ARTWORKS[0];
  const hasFailed = Boolean(failedImages[currentArt.id]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 pointer-events-auto"
      style={{ backgroundColor: 'rgba(5, 8, 17, 0.94)' }}
      role="dialog"
      aria-modal="true"
      aria-label="NEON REDLINE Art Gallery"
    >
      <div
        className="relative w-full max-w-2xl max-h-[92dvh] flex flex-col rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#090e1a' }}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/90 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" aria-hidden="true" />
            <h2 className="text-base font-display font-bold text-white tracking-wide">
              NEON REDLINE Gallery
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              {ARTWORKS.length} Plates
            </span>
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

        {/* Artwork Selector Strip */}
        <div className="flex overflow-x-auto scrollbar-none p-2 gap-1.5 bg-slate-950/85 border-b border-slate-800/80 shrink-0">
          {ARTWORKS.map((art) => {
            const isActive = currentArt.id === art.id;
            return (
              <button
                key={art.id}
                type="button"
                onClick={() => setActiveId(art.id)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {art.shortLabel}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5 overscroll-contain">
          {/* Main Visual Image Card */}
          <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-inner group">
            {hasFailed ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs font-mono p-4 text-center">
                <span className="text-amber-400 font-bold mb-1">{currentArt.title}</span>
                <span>Artwork preview unavailable offline</span>
              </div>
            ) : (
              <img
                src={currentArt.imageSrc}
                alt={currentArt.title}
                referrerPolicy="no-referrer"
                onError={() => setFailedImages((prev) => ({ ...prev, [currentArt.id]: true }))}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                loading="eager"
              />
            )}
            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-slate-950/90 border border-white/20 text-[10px] font-mono font-bold tracking-wider text-amber-400">
              {currentArt.tag}
            </div>
          </div>

          {/* Image Information & Description */}
          <div className="space-y-1.5">
            <h3 className="text-base font-display font-bold text-white">
              {currentArt.title}
            </h3>
            <p className="text-xs font-mono text-cyan-300 font-medium">
              {currentArt.subtitle}
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-1">
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
