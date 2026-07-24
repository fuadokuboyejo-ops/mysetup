import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Emo, the tutorial mascot ────────────────────────────────────────────────
// Poses reuse the existing mascot art so nothing new needs preloading.
export const EMO_POSES = {
  head: require('../assets/mascot_head.png'),
  peek: require('../assets/peeking_bot.png'),
  dance: require('../assets/mascot.gif'),
};

// ─── Step config ─────────────────────────────────────────────────────────────
// One object per step. Screens look themselves up by `id`, so steps can be
// added, reordered, or reworded here without touching the overlay component.
//
//   kind      'spotlight' — scrim + hole over a real element, waits for the tap
//             'banner'    — non-blocking Emo bubble (used where the user types)
//             'moment'    — full-screen celebration beat (TutorialCelebration)
//   pose      key into EMO_POSES
//   shape     spotlight hole: 'circle' | 'rect'
//   cheer     tiny toast shown at the START of the NEXT step, celebrating this one
//   progress  false → not counted in the step dots (the finale shows all filled)
export const TUTORIAL_STEPS = [
  {
    id: 'home-add',
    kind: 'spotlight',
    introVideo: require('../assets/onboarding_1.mp4'),
    introDurationMs: 4900,
    // Matches the clip's own warm-grey background so the nav band below it
    // (and any letterbox around it) blend seamlessly into the video.
    introBackground: '#EDEAE4',
    introFit: 'contain',
    shape: 'circle',
    padding: 12,
    cheer: 'let’s go 🙌',
  },
  {
    id: 'pick-category',
    kind: 'spotlight',
    pose: 'peek',
    shape: 'rect',
    radius: 20,
    padding: 6,
    text: 'what’s on your desk? pick a category — ‘other’ covers literally anything.',
    cheer: 'good pick.',
  },
  {
    id: 'camera-shutter',
    kind: 'spotlight',
    shape: 'circle',
    padding: 10,
    cheer: 'nice shot. 📸',
  },
  {
    id: 'receipt-save',
    kind: 'spotlight',
    pose: 'peek',
    text: 'make sure you fill out the product receipt — the more information the better.',
  },
  {
    id: 'cutout-reveal',
    kind: 'moment',
    pose: 'dance',
    loadingText: 'watch this…',
    text: 'whoa, look at that. background gone. ✨',
    button: 'keep going',
  },
  {
    id: 'profile-tab',
    kind: 'spotlight',
    mascot: false,
    shape: 'circle',
    padding: 12,
    text: 'your gear’s saved to your profile. tap it to take a look.',
  },
  {
    id: 'setups-tab',
    kind: 'spotlight',
    mascot: false,
    shape: 'rect',
    radius: 14,
    padding: 4,
    text: 'now tap ‘setups’ — that’s where your boards live.',
  },
  {
    id: 'open-setup',
    kind: 'spotlight',
    mascot: false,
    shape: 'rect',
    radius: 20,
    padding: 6,
    text: 'there’s the setup you made earlier — tap it to open your board.',
  },
  {
    id: 'arrange-board',
    kind: 'spotlight',
    mascot: false,
    shape: 'rect',
    radius: 16,
    padding: 6,
    text: 'tap ‘arrange board’ to place your gear.',
  },
  {
    id: 'drag-item',
    kind: 'banner',
    text: 'drag your new item onto the board',
  },
  {
    id: 'all-set',
    kind: 'moment',
    progress: false,
  },
];

export function tutorialStepIndex(id) {
  return TUTORIAL_STEPS.findIndex(step => step.id === id);
}

// ─── Store ───────────────────────────────────────────────────────────────────
// A tiny module-level store (no navigation lib here — App.js swaps screens by
// state), so any screen can read the current step and advance it.
const TUTORIAL_KEY = 'mysetup_tutorial_done_v1';

let state = { status: 'idle', stepIndex: 0 }; // idle | active | done
const listeners = new Set();

function setState(next) {
  state = next;
  listeners.forEach(listener => listener());
}

export function getTutorialState() {
  return state;
}

export function subscribeTutorial(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isTutorialActive() {
  return state.status === 'active';
}

// Dev-only: start the tour at this step id instead of the beginning — handy
// for testing a later step without replaying the whole flow. Set to null for
// the real experience. Ignored in production builds.
const DEV_START_STEP = null;

// The "tutorial already completed" flag, read once from AsyncStorage at startup
// (see preloadTutorial) and cached here. Having it in memory lets initTutorial
// flip the tutorial on synchronously — otherwise Home paints a frame before the
// async read resolves and the first spotlight pops in a beat late (a visible
// flash of the bare feed on the onboarding → tutorial handoff).
let doneFlagLoaded = false;
let tutorialDone = false;

// Load the completion flag during the launch loading screen so initTutorial can
// decide without awaiting. Safe to call more than once.
export async function preloadTutorial() {
  try {
    tutorialDone = (await AsyncStorage.getItem(TUTORIAL_KEY)) === '1';
  } catch {
    tutorialDone = false;
  }
  doneFlagLoaded = true;
}

// Called when the user first lands on Home. Shows the tutorial exactly once —
// except in dev, where it replays every launch (same convenience the old
// coach mark had).
export function initTutorial() {
  if (state.status !== 'idle') return;
  const startIndex = __DEV__ && DEV_START_STEP ? Math.max(0, tutorialStepIndex(DEV_START_STEP)) : 0;
  const activate = (done) =>
    setState(!done || __DEV__ ? { status: 'active', stepIndex: startIndex } : { status: 'done', stepIndex: 0 });

  // Preloaded at startup → decide synchronously so the first spotlight is on
  // screen the instant Home mounts, with no flash of the bare feed.
  if (doneFlagLoaded) {
    activate(tutorialDone);
    return;
  }
  // Not preloaded yet (shouldn't normally happen) — fall back to the async read.
  AsyncStorage.getItem(TUTORIAL_KEY)
    .then(value => {
      if (state.status !== 'idle') return;
      activate(value === '1');
    })
    .catch(() => {});
}

// `fromId` guards against double-advances from async completion handlers —
// the call is a no-op unless that step is the one currently showing.
export function advanceTutorial(fromId) {
  if (state.status !== 'active') return;
  if (fromId && TUTORIAL_STEPS[state.stepIndex]?.id !== fromId) return;
  const next = state.stepIndex + 1;
  if (next >= TUTORIAL_STEPS.length) {
    completeTutorial();
  } else {
    setState({ status: 'active', stepIndex: next });
  }
}

// Jump forward to a named step (used when background removal fails and the
// reveal/board moments have nothing to show).
export function jumpTutorial(id) {
  if (state.status !== 'active') return;
  const index = tutorialStepIndex(id);
  if (index > state.stepIndex) setState({ status: 'active', stepIndex: index });
}

// Rewind to a named step (used when back-navigation returns the user to an
// earlier tutorial screen, e.g. camera/receipt → picker) — without this the
// active step stays ahead of what's actually on screen, so the step's screen
// never sees itself as active again and the tutorial silently stalls.
export function rewindTutorial(id) {
  if (state.status !== 'active') return;
  const index = tutorialStepIndex(id);
  if (index >= 0 && index < state.stepIndex) setState({ status: 'active', stepIndex: index });
}

function finish() {
  tutorialDone = true;
  doneFlagLoaded = true;
  setState({ status: 'done', stepIndex: TUTORIAL_STEPS.length });
  AsyncStorage.setItem(TUTORIAL_KEY, '1').catch(() => {});
}

export function completeTutorial() {
  finish();
}

export function skipTutorial() {
  finish();
}

export function useTutorialState() {
  return useSyncExternalStore(subscribeTutorial, getTutorialState);
}

// Convenience for screens: "is MY step the active one, and what is it?"
export function useTutorialStep(id) {
  const current = useTutorialState();
  const step = TUTORIAL_STEPS[current.stepIndex] || null;
  return {
    active: current.status === 'active' && step?.id === id,
    step,
    stepIndex: current.stepIndex,
  };
}
