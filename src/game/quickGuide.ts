/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GameModeId } from './rules';

export type QuickGuideControlId = 'steer' | 'gas' | 'brake' | 'nitro';
export type ControlSchemeId = 'classic' | 'wheel' | 'swipe';

export interface ControlGuideItem {
  id: QuickGuideControlId;
  label: string;
  actionTag: string;
  keycaps: string[];
  touchHint: string;
  summary: string;
  proTip: string;
}

export interface SecondaryShortcut {
  keycap: string;
  label: string;
}

export interface ModeQuickGuide {
  mode: GameModeId;
  modeTitle: string;
  modeSubtitle: string;
  objective: string;
  accentColor: 'amber' | 'cyan' | 'emerald' | 'orange';
  controls: [ControlGuideItem, ControlGuideItem, ControlGuideItem, ControlGuideItem];
  shortcuts: SecondaryShortcut[];
}

export function getControlSchemeLabel(scheme: ControlSchemeId): string {
  switch (scheme) {
    case 'wheel':
      return 'Analog Steering Wheel';
    case 'swipe':
      return 'One-Thumb Tap & Swipe';
    case 'classic':
    default:
      return 'Classic Touch Buttons';
  }
}

export function getSteerTouchHint(scheme: ControlSchemeId, mode: GameModeId): string {
  if (mode === 'parking') {
    if (scheme === 'wheel') return 'Wheel hub · Left / Right pads';
    if (scheme === 'swipe') return 'Swipe road · Steering wheel';
    return 'Left / Right pads · Wheel';
  }
  if (scheme === 'wheel') return 'Rotate HUD steering wheel';
  if (scheme === 'swipe') return 'Swipe screen · Tap to snap';
  return 'Screen sides · Left / Right pads';
}

export function getQuickGuideForMode(
  mode: GameModeId,
  controlScheme: ControlSchemeId = 'classic'
): ModeQuickGuide {
  const steerTouch = getSteerTouchHint(controlScheme, mode);

  if (mode === 'highway_traffic') {
    return {
      mode: 'highway_traffic',
      modeTitle: 'Highway Traffic Clash',
      modeSubtitle: 'Multi-lane expressway · Slipstream & near-miss overtakes',
      objective:
        'Weave past live multi-lane traffic at high speed, draft behind bumpers for slipstream surges, and chain clean overtakes.',
      accentColor: 'cyan',
      controls: [
        {
          id: 'steer',
          label: 'Steer',
          actionTag: 'Lane Weave',
          keycaps: ['A / D', '← / →'],
          touchHint: steerTouch,
          summary:
            'Thread cleanly between fast and slow lanes without clipping traffic bumpers or outer guardrails.',
          proTip: 'Skim close alongside vehicles to trigger Near-Miss combo multipliers.',
        },
        {
          id: 'gas',
          label: 'Gas',
          actionTag: 'Top-End Surge',
          keycaps: ['W', '↑'],
          touchHint: 'Hold GAS pedal',
          summary:
            'Accelerate toward 200+ km/h to close gaps quickly and turn slipstream drafts into clean overtakes.',
          proTip: 'Release briefly when drafting behind a truck before lunging into an open lane.',
        },
        {
          id: 'brake',
          label: 'Brake',
          actionTag: 'Speed Check',
          keycaps: ['S', '↓'],
          touchHint: 'Hold BRAKE pedal',
          summary:
            'Feather braking when boxed across all lanes so you drop behind a slower car rather than rear-ending it.',
          proTip: 'Short brake taps preserve combo flow without losing steering authority.',
        },
        {
          id: 'nitro',
          label: 'Nitro',
          actionTag: 'Fever Turbo',
          keycaps: ['SPACE', 'SHIFT'],
          touchHint: 'Tap NITRO button (Fever ≥ 40%)',
          summary:
            'Ignite stored Fever Nitro for a high-velocity burst down open expressway lanes and across boost pads.',
          proTip: 'Pair Nitro runs with Flash [F] or Horn [E] to clear stubborn lane blockers.',
        },
      ],
      shortcuts: [
        { keycap: 'L', label: 'Headlights' },
        { keycap: 'F', label: 'Flash Yield' },
        { keycap: 'E', label: 'Horn' },
        { keycap: 'P', label: 'Pause' },
      ],
    };
  }

  if (mode === 'parking') {
    return {
      mode: 'parking',
      modeTitle: 'Precision Parking',
      modeSubtitle: '12 technical bays · Tight angles & obstacle clearance',
      objective:
        'Navigate around cones and parked cars into the glowing target bay, align straight within tolerance, and come to a clean stop.',
      accentColor: 'emerald',
      controls: [
        {
          id: 'steer',
          label: 'Steer',
          actionTag: 'Front Lock',
          keycaps: ['A / D', '← / →'],
          touchHint: steerTouch,
          summary:
            'Turn the front axle into tight corners, docks, and parallel bays while watching your corner clearance radar.',
          proTip: 'Remember steering reverses direction laterally while backing in Reverse [R].',
        },
        {
          id: 'gas',
          label: 'Gas',
          actionTag: 'Manual Crawl',
          keycaps: ['W', '↑'],
          touchHint: 'Hold GAS pedal',
          summary:
            'Manual throttle only—your car stays stationary until you apply Gas, rolling forward in [D] or backing in [R].',
          proTip: 'Feather short Gas taps near cones instead of flooring the pedal.',
        },
        {
          id: 'brake',
          label: 'Brake',
          actionTag: 'Stall Stop',
          keycaps: ['S', '↓'],
          touchHint: 'Hold BRAKE pedal',
          summary:
            'Slow down smoothly before hitting curbs or parked bumpers, and bring speed near zero inside the glowing bay.',
          proTip: 'Hold Brake while switching between [D] and [R] on three-point K-turns.',
        },
        {
          id: 'nitro',
          label: 'Nitro (Handbrake)',
          actionTag: 'Lot Lock-In',
          keycaps: ['SPACE', 'SHIFT'],
          touchHint: 'Hold H-BRK pedal (Nitro off on lot)',
          summary:
            'Nitro Boost is disabled inside parking lots—Space / Shift triggers the Handbrake instead to plant the rear wheels.',
          proTip: 'Pull Handbrake once centered in the bay to settle cleanly and lock the stage.',
        },
      ],
      shortcuts: [
        { keycap: 'G', label: 'Swap D / R' },
        { keycap: '1·2·3', label: 'P · R · D Gear' },
        { keycap: 'L', label: 'Headlights' },
        { keycap: 'R', label: 'Retry Stage' },
      ],
    };
  }

  if (mode === 'mountain_drive') {
    return {
      mode: 'mountain_drive',
      modeTitle: 'Mountain Drive',
      modeSubtitle: 'No asphalt · Raw mountain dirt ridges & peak-to-peak jumps',
      objective:
        'Tear straight up and down rugged mountain dirt, hit natural rock-and-earth jump crests at full speed to soar from one mountain to the next, and stay on the ridge.',
      accentColor: 'orange',
      controls: [
        {
          id: 'steer',
          label: 'Steer',
          actionTag: 'Ridge & Air Line',
          keycaps: ['A / D', '← / →'],
          touchHint: steerTouch,
          summary:
            'Hold your line along bumpy mountain dirt crests toward flagged jump peaks and make subtle mid-air corrections to land on the next mountain.',
          proTip: 'Exposed mountain cliffs have no guardrails—avoid sliding sideways off steep dirt bends.',
        },
        {
          id: 'gas',
          label: 'Gas',
          actionTag: 'Climb & Launch',
          keycaps: ['W', '↑'],
          touchHint: 'Hold GAS pedal',
          summary:
            'Keep Gas pinned up heavy earthen climbs to fight gravity and carry huge takeoff momentum off the mountain lip across the canyon.',
          proTip: 'Steep downhill dirt chutes accelerate you fast—ride that rush to clear wide mountain chasms.',
        },
        {
          id: 'brake',
          label: 'Brake',
          actionTag: 'Descent Control',
          keycaps: ['S', '↓'],
          touchHint: 'Hold BRAKE pedal',
          summary:
            'Tap Brake on steep dirt drops before sharp ridge turns so your tires bite into the soil instead of sliding over the cliff.',
          proTip: 'Never brake right on the takeoff crest—let the car fly cleanly off the mountain lip.',
        },
        {
          id: 'nitro',
          label: 'Nitro',
          actionTag: 'Mega Air Surge',
          keycaps: ['SPACE', 'SHIFT'],
          touchHint: 'Tap NITRO button (Fever ≥ 40%)',
          summary:
            'Ignite Fever Nitro up steep dirt climbs or right off a mountain jump crest (and mid-air!) to clear massive canyons.',
          proTip: 'Chain trail nitro crystals with Fever Nitro to fly across huge mountain-to-mountain gaps.',
        },
      ],
      shortcuts: [
        { keycap: 'L', label: 'Headlights' },
        { keycap: 'F', label: 'Flash Beams' },
        { keycap: 'E', label: 'Horn' },
        { keycap: 'P', label: 'Pause' },
      ],
    };
  }

  return {
    mode: 'drift',
    modeTitle: 'Touge S-Curve Drift',
    modeSubtitle: 'Mountain switchbacks · Rhythm flips & Fever chains',
    objective:
      'Carve through mountain S-curves, snap crisp drift flips across apexes to stack xN combos, and unleash Fever boosts.',
    accentColor: 'amber',
    controls: [
      {
        id: 'steer',
        label: 'Steer',
        actionTag: 'Apex Carve',
        keycaps: ['A / D', '← / →'],
        touchHint: steerTouch,
        summary:
          'Sweep into corners and snap counter-steer on exit to trigger Drift Flips and build consecutive combo multipliers.',
        proTip: 'Hold smooth arc angles through tunnels and chicanes rather than over-correcting.',
      },
      {
        id: 'gas',
        label: 'Gas',
        actionTag: 'Power Slide',
        keycaps: ['W', '↑'],
        touchHint: 'Hold GAS pedal',
        summary:
          'Auto-cruise keeps steady baseline momentum; hold Gas to push deeper entry speeds and generate faster Fever charge.',
        proTip: 'Stay on Gas through open straights to link distant corners into one chain.',
      },
      {
        id: 'brake',
        label: 'Brake',
        actionTag: 'Hairpin Check',
        keycaps: ['S', '↓'],
        touchHint: 'Hold BRAKE pedal',
        summary:
          'Tap Brake right before sharp hairpins to scrub excess entry speed and keep your chassis clear of outer guardrails.',
        proTip: 'Lightly brushing Brake tightens your turn radius without killing momentum.',
      },
      {
        id: 'nitro',
        label: 'Nitro',
        actionTag: 'Fever Surge',
        keycaps: ['SPACE', 'SHIFT'],
        touchHint: 'Tap NITRO button (Fever ≥ 40%)',
        summary:
          'Spend charged Fever gauge (40%+ or MAX) for an explosive turbo burst that stretches your combo timer across straights.',
        proTip: 'Trigger Nitro exiting hairpins or hit glowing cyan road pads for instant speed.',
      },
    ],
    shortcuts: [
      { keycap: 'L', label: 'Headlights' },
      { keycap: 'F', label: 'Flash Beams' },
      { keycap: 'E', label: 'Horn' },
      { keycap: 'P', label: 'Pause' },
    ],
  };
}
