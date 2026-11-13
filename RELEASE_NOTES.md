# 🏎️ NEON REDLINE v1.0.0 — Mobile Edition & 3D Interactive Garage

Welcome to the first official release of **NEON REDLINE** (formerly Car-Games)! This major release completely overhauls the game with mobile-first touch architecture, a full 3D WebGL car customization garage, and high-octane Tokyo Touge arcade physics.

---

## 📱 What's New for Mobile Phones

### 1. 🏎️ 3D Interactive Three.js Garage Showroom
- **360° Touch-Drag Orbit**: Spin any car around all angles with natural rotational inertia.
- **Pinch-to-Zoom**: 2-finger touch gesture smoothly zooms between panoramic showcase and extreme component detail.
- **Component Inspection Presets**: One-tap camera focus targeting:
  - 🔍 **Hood & Engine**: Inspect vented louvers, chrome supercharger blowers, twin scoops.
  - 🔍 **Wheels & Rims**: Close-up inspection of alloy spokes, brake rotors, and calipers.
  - 🔍 **Downforce Wing**: Rear aerodynamics (elevated GT carbon wings, vortex fins).
  - 🔍 **Exhaust Pipes**: Titanium exhaust tips with live rev flame particle bursts.
  - 🔍 **Neon Underglow**: Chassis underglow lighting in real time.
- **Mobile Bottom Action Bar**: Sticky `✓ Equipped · Race` / `Unlock (XXX CR)` button pinned above the safe-area gesture bar so you never have to scroll.
- **Swipeable 14-Car Roster**: Touch-scrollable horizontal carousel (T1 Starter to T14 Apex Carbon Valkyrie).

### 2. 🎮 Mobile Touch Cockpit & Controls
- **One-Thumb Tap-to-Drift**: In Tokyo Touge mode, tap anywhere on the screen to flip drift direction between right (`/`) and left (`\`).
- **Highway Cockpit Deck**:
  - **Left Thumb**: Smooth rotatable steering wheel pad.
  - **Center Cluster**: Quick-action buttons for High-Beam Flash (yields traffic), Horn, and Nitro Boost.
  - **Right Thumb**: Vertical brushed-metal **Brake** and **Gas** pedals with instantaneous touch reaction.

### 3. 📐 Viewport & PWA Web-App
- **Dynamic 100dvh Sizing**: Eliminates address-bar clipping on iOS Safari and Android Chrome.
- **Notch Safe Areas**: `pt-safe` and `pb-safe` keep all HUD counters and buttons away from camera cutouts.
- **Anti-Bounce & No Rubber-Banding**: Eliminates pull-to-refresh accidental reloads.
- **PWA Ready**: Includes `manifest.json` for full standalone "Add to Home Screen" installation on iOS & Android.

---

## 📥 How to Test on Mobile

### Option A: Direct Web / PWA (Instant)
1. Visit the repository GitHub Pages: `https://underratedgignac.github.io/Car-Games/`
2. In your mobile browser (Safari / Chrome), tap **Share** or **Menu (⋮)** → **"Add to Home Screen"**.
3. Launch from your home screen for the full-screen native mobile experience!

### Option B: Download Release ZIP
1. Download `neon-redline-v1.0.0-mobile.zip` attached below.
2. Unpack on any device or web server.
3. Open `index.html` or serve with any static server (`npx serve`, `python -m http.server`, etc.).
