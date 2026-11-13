import React, { useState } from 'react';
import { CarSpec } from '../game/rules';

interface AiPitStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCar: CarSpec;
  bestScore: number;
  lastScore: number;
  maxCombo: number;
  onApplyCustomSprite: (dataUrl: string) => void;
  onSetCustomBgm: (audioUrl: string, title: string) => void;
}

type StudioTab = 'coach' | 'tts' | 'music' | 'livery' | 'poster' | 'video';

export const AiPitStudioModal: React.FC<AiPitStudioModalProps> = ({
  isOpen,
  onClose,
  selectedCar,
  bestScore,
  lastScore,
  maxCombo,
  onApplyCustomSprite,
  onSetCustomBgm,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('coach');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  // 1. Gemini Intelligence (gemini-4-carbon, gemini-4-argon, gemini-3.8-flash, gemini-3.1-flash-lite)
  const [coachMode, setCoachMode] = useState<'instant' | 'fast' | 'interactive' | 'deep'>('interactive');
  const [coachPrompt, setCoachPrompt] = useState<string>('');
  const [coachReply, setCoachReply] = useState<string>(
    'Select a reasoning tier or ask Chief Engineer Keiichi how to chain tighter / and \\ canyon hairpins.'
  );
  const [coachModelUsed, setCoachModelUsed] = useState<string>('gemini-4-argon');

  // 2. TTS Announcer (gemini-3.8-flash-tts)
  const [ttsScript, setTtsScript] = useState<string>('');
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string>('');
  const [ttsTranscript, setTtsTranscript] = useState<string>('');

  // 3. Lyria Music (lyria-3-clip-preview & lyria-3-pro-preview)
  const [musicPrompt, setMusicPrompt] = useState<string>(
    'High-tempo Tokyo drift phonk and analog synthwave with distorted cowbell 808s and roaring twin-turbo bass'
  );
  const [musicDuration, setMusicDuration] = useState<'clip' | 'full'>('clip');
  const [musicAudioUrl, setMusicAudioUrl] = useState<string>('');
  const [musicNotes, setMusicNotes] = useState<string>('');

  // 4. Create & Edit Car Sprite / Livery (gemini-nano-banana-2.1)
  const [liveryPrompt, setLiveryPrompt] = useState<string>(
    'Diagonal rear-three-quarter 2D arcade drift car sprite, midnight purple and neon gold livery, wide GT wing, isolated on dark background'
  );
  const [liverySourceImg, setLiverySourceImg] = useState<string>('');
  const [liveryResultUrl, setLiveryResultUrl] = useState<string>('');

  // 5. High-Quality Pro Image (gemini-3-pro-image-preview with 1K, 2K, 4K)
  const [posterPrompt, setPosterPrompt] = useState<string>(
    'Stylized vertical racing poster of a widebody drift coupe sliding along a cliffside canyon road at sunset with tire smoke'
  );
  const [posterSize, setPosterSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [posterResultUrl, setPosterResultUrl] = useState<string>('');

  // 6. Animate Photo into Video (gemini-omni-1.2-flash via Interactions API, 9:16 or 16:9)
  const [videoPrompt, setVideoPrompt] = useState<string>(
    'The drift car slides sideways in slow motion, throwing glowing orange sparks and thick tire smoke across the canyon road.'
  );
  const [videoAspectRatio, setVideoAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [videoSourceImg, setVideoSourceImg] = useState<string>('');
  const [videoResultUrl, setVideoResultUrl] = useState<string>('');

  if (!isOpen) return null;

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  async function runCoach() {
    setBusy(true);
    setErrorMsg('');
    setStatusMsg('Consulting AI Race Engineer...');
    try {
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: coachMode,
          prompt: coachPrompt,
          carName: selectedCar.name,
          bestScore,
          lastScore,
          maxCombo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Coach request failed');
      setCoachReply(data.text);
      setCoachModelUsed(data.modelUsed);
      setStatusMsg('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Coach request failed');
      setStatusMsg('');
    } finally {
      setBusy(false);
    }
  }

  async function runTts() {
    setBusy(true);
    setErrorMsg('');
    setStatusMsg('Synthesizing dual-speaker commentary with gemini-3.8-flash-tts...');
    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: Math.max(bestScore, lastScore, 1500),
          combo: Math.max(maxCombo, 6),
          carName: selectedCar.name,
          customScript: ttsScript,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'TTS generation failed');
      setTtsAudioUrl(data.audioDataUrl);
      setTtsTranscript(data.transcript);
      setStatusMsg('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'TTS generation failed');
      setStatusMsg('');
    } finally {
      setBusy(false);
    }
  }

  async function runMusic() {
    setBusy(true);
    setErrorMsg('');
    setStatusMsg(
      `Generating drift track with ${
        musicDuration === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview'
      }...`
    );
    try {
      const res = await fetch('/api/ai/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: musicPrompt,
          durationMode: musicDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Music generation failed');
      setMusicAudioUrl(data.audioDataUrl);
      setMusicNotes(data.lyrics || 'Instrumental Drift Track Ready');
      onSetCustomBgm(data.audioDataUrl, `${data.modelUsed} Drift Track`);
      setStatusMsg('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Music generation failed');
      setStatusMsg('');
    } finally {
      setBusy(false);
    }
  }

  async function runLivery() {
    setBusy(true);
    setErrorMsg('');
    setStatusMsg('Generating/editing car sprite with gemini-nano-banana-2.1...');
    try {
      const res = await fetch('/api/ai/image-livery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: liveryPrompt,
          base64Image: liverySourceImg || undefined,
          aspectRatio: '1:1',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Livery generation failed');
      setLiveryResultUrl(data.imageUrl);
      setStatusMsg('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Livery generation failed');
      setStatusMsg('');
    } finally {
      setBusy(false);
    }
  }

  async function runPoster() {
    setBusy(true);
    setErrorMsg('');
    setStatusMsg(`Rendering ${posterSize} image with gemini-3-pro-image-preview...`);
    try {
      const res = await fetch('/api/ai/image-pro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: posterPrompt,
          imageSize: posterSize,
          aspectRatio: '9:16',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'High-res image generation failed');
      setPosterResultUrl(data.imageUrl);
      setStatusMsg('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'High-res image generation failed');
      setStatusMsg('');
    } finally {
      setBusy(false);
    }
  }

  async function runVideoAnimate() {
    const sourceToUse = videoSourceImg || liveryResultUrl || posterResultUrl;
    if (!sourceToUse) {
      setErrorMsg('Please upload a car photo or generate one in Sprite/Poster tabs first.');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    setStatusMsg(`Animating ${videoAspectRatio} video with gemini-omni-1.2-flash...`);
    try {
      const res = await fetch('/api/ai/video-animate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Image: sourceToUse,
          prompt: videoPrompt,
          aspectRatio: videoAspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Video animation failed');
      setVideoResultUrl(data.videoUrl);
      setStatusMsg('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Video animation failed');
      setStatusMsg('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 pointer-events-auto"
      style={{ backgroundColor: 'rgba(5, 8, 17, 0.9)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Gemini AI Pit Studio"
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 p-4 sm:p-6 text-slate-100 shadow-2xl"
        style={{ backgroundColor: '#0b101e' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <p className="text-xs font-semibold tracking-wider text-amber-400">
              GEMINI MULTIMODAL MOTORSPORT LAB
            </p>
            <h2 className="text-xl sm:text-2xl font-bold font-display">
              AI Pit Studio & Media Deck
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Studio"
            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Close
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 my-4 rounded-xl bg-slate-950 border border-slate-800">
          {(
            [
              ['coach', '1. AI Engineer'],
              ['tts', '2. Voice TTS'],
              ['music', '3. Lyria Music'],
              ['livery', '4. Sprite Edit'],
              ['poster', '5. Pro 1K/2K/4K'],
              ['video', '6. Omni Video'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                setErrorMsg('');
              }}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === id
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {statusMsg && (
          <div className="mb-4 p-3 rounded-xl border border-cyan-800 bg-cyan-950/60 text-xs text-cyan-200">
            {statusMsg}
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl border border-rose-800 bg-rose-950/60 text-xs text-rose-200">
            {errorMsg}
          </div>
        )}

        {/* TAB 1: Gemini Intelligence Coach */}
        {activeTab === 'coach' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-400">
                Select Gemini Model Intelligence Tier:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['instant', 'Fast Lite (gemini-3.1-flash-lite)'],
                    ['fast', 'General (gemini-3.8-flash)'],
                    ['interactive', 'Interactive (gemini-4-argon)'],
                    ['deep', 'Deep Reasoning (gemini-4-carbon)'],
                  ] as const
                ).map(([mKey, mLabel]) => (
                  <button
                    key={mKey}
                    type="button"
                    onClick={() => setCoachMode(mKey)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors whitespace-nowrap ${
                      coachMode === mKey
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-900 text-slate-300 border border-slate-800'
                    }`}
                  >
                    {mLabel}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1.5" htmlFor="coach-input">
                Ask Chief Engineer Keiichi (optional custom question or leave blank for telemetry analysis)
              </label>
              <input
                id="coach-input"
                type="text"
                value={coachPrompt}
                onChange={(e) => setCoachPrompt(e.target.value)}
                placeholder="e.g. How should I time my / and \ flips on narrow sky-spire bridges?"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={runCoach}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-sm font-bold transition-colors whitespace-nowrap"
            >
              Analyze Telemetry & Strategy
            </button>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950">
              <div className="text-xs text-slate-400 mb-1 font-mono">
                ACTIVE MODEL · {coachModelUsed}
              </div>
              <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">
                {coachReply}
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: Convert Text to Speech (gemini-3.8-flash-tts) */}
        {activeTab === 'tts' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Generate dual-speaker drift commentary with backchanneling and vocal bursts using{' '}
              <span className="font-mono text-amber-400">gemini-3.8-flash-tts</span>.
            </p>
            <div>
              <label className="block text-xs text-slate-300 mb-1.5" htmlFor="tts-script-input">
                Custom Announcer Line (supports &lt;gasp&gt;, &lt;laugh&gt;, |yeah|)
              </label>
              <input
                id="tts-script-input"
                type="text"
                value={ttsScript}
                onChange={(e) => setTtsScript(e.target.value)}
                placeholder={`Blaze: <gasp> Insane diagonal drift in the ${selectedCar.name}!`}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={runTts}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-sm font-bold transition-colors whitespace-nowrap"
            >
              Generate Voice Commentary (WAV)
            </button>

            {ttsAudioUrl && (
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-2">
                <p className="text-xs text-slate-300">{ttsTranscript}</p>
                <audio controls src={ttsAudioUrl} className="w-full" />
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Generate Music (lyria-3-clip-preview / lyria-3-pro-preview) */}
        {activeTab === 'music' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">Select Lyria Music Engine:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMusicDuration('clip')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap ${
                    musicDuration === 'clip'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 border border-slate-800'
                  }`}
                >
                  30s Clip (lyria-3-clip-preview)
                </button>
                <button
                  type="button"
                  onClick={() => setMusicDuration('full')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap ${
                    musicDuration === 'full'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 border border-slate-800'
                  }`}
                >
                  Full Track (lyria-3-pro-preview)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1.5" htmlFor="music-prompt-input">
                Drift Soundtrack Prompt
              </label>
              <input
                id="music-prompt-input"
                type="text"
                value={musicPrompt}
                onChange={(e) => setMusicPrompt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={runMusic}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-sm font-bold transition-colors whitespace-nowrap"
            >
              Generate Custom Drift Soundtrack
            </button>

            {musicAudioUrl && (
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-2">
                <div className="text-xs text-emerald-400 font-semibold">
                  Soundtrack Ready & Linked to Game Audio Deck
                </div>
                {musicNotes && <p className="text-xs text-slate-400">{musicNotes}</p>}
                <audio controls src={musicAudioUrl} className="w-full" />
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Create & Edit Images (gemini-nano-banana-2.1) */}
        {activeTab === 'livery' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Create or edit custom 2D car sprites and liveries with{' '}
              <span className="font-mono text-amber-400">gemini-nano-banana-2.1</span>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1.5" htmlFor="livery-prompt-input">
                  Sprite / Livery Prompt
                </label>
                <input
                  id="livery-prompt-input"
                  type="text"
                  value={liveryPrompt}
                  onChange={(e) => setLiveryPrompt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1.5" htmlFor="livery-upload">
                  Optional Reference Image to Edit
                </label>
                <input
                  id="livery-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, setLiverySourceImg)}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={runLivery}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-sm font-bold transition-colors whitespace-nowrap"
              >
                {liverySourceImg ? 'Edit Image with Nano Banana 2.1' : 'Create Sprite with Nano Banana 2.1'}
              </button>

              {liveryResultUrl && (
                <button
                  type="button"
                  onClick={() => {
                    onApplyCustomSprite(liveryResultUrl);
                    onClose();
                  }}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold transition-colors whitespace-nowrap"
                >
                  Apply as Active 2D Car Sprite in Game
                </button>
              )}
            </div>

            {liveryResultUrl && (
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 flex justify-center">
                <img
                  src={liveryResultUrl}
                  alt="Generated custom car livery"
                  referrerPolicy="no-referrer"
                  className="max-h-60 rounded-lg object-contain"
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Generate High-Quality Images (gemini-3-pro-image-preview 1K / 2K / 4K) */}
        {activeTab === 'poster' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">
                High-Resolution Output Size (<span className="font-mono text-amber-400">gemini-3-pro-image-preview</span>):
              </span>
              <div className="flex gap-1.5">
                {(['1K', '2K', '4K'] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setPosterSize(sz)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap ${
                      posterSize === sz
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-900 text-slate-300 border border-slate-800'
                    }`}
                  >
                    {sz} Resolution
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1.5" htmlFor="poster-prompt-input">
                High-Resolution Drift Key Art Prompt
              </label>
              <input
                id="poster-prompt-input"
                type="text"
                value={posterPrompt}
                onChange={(e) => setPosterPrompt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
              />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={runPoster}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-sm font-bold transition-colors whitespace-nowrap"
            >
              Generate {posterSize} Drift Key Art
            </button>

            {posterResultUrl && (
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 flex justify-center">
                <img
                  src={posterResultUrl}
                  alt="Generated Pro Drift Poster"
                  referrerPolicy="no-referrer"
                  className="max-h-64 rounded-lg object-contain"
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 6: Animate Images into Video (gemini-omni-1.2-flash via Interactions API) */}
        {activeTab === 'video' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">
                Video Aspect Ratio (<span className="font-mono text-amber-400">gemini-omni-1.2-flash</span>):
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVideoAspectRatio('9:16')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap ${
                    videoAspectRatio === '9:16'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 border border-slate-800'
                  }`}
                >
                  9:16 Portrait (Phone Vertical)
                </button>
                <button
                  type="button"
                  onClick={() => setVideoAspectRatio('16:9')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap ${
                    videoAspectRatio === '16:9'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 border border-slate-800'
                  }`}
                >
                  16:9 Landscape
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1.5" htmlFor="video-upload">
                  Upload Photo to Animate (or use generated Sprite/Poster)
                </label>
                <input
                  id="video-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, setVideoSourceImg)}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1.5" htmlFor="video-prompt-input">
                  Motion Prompt
                </label>
                <input
                  id="video-prompt-input"
                  type="text"
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={runVideoAnimate}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-sm font-bold transition-colors whitespace-nowrap"
            >
              Animate Photo into {videoAspectRatio} Video
            </button>

            {videoResultUrl && (
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 flex justify-center">
                <video
                  controls
                  autoPlay
                  loop
                  src={videoResultUrl}
                  className="max-h-72 rounded-lg"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
