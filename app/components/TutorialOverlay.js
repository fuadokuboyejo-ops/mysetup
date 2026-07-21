import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Easing,
  Dimensions, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import Svg, { Mask, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LoadingScreen from './LoadingScreen';
import { EMO_POSES } from '../config/tutorial';

// Opaque cover shown while a step's target is still being measured — hides the
// page entirely so it never flashes before the spotlight. Plays the app's real
// loading animation so the wait matches the rest of the app.
export function TutorialLoadingCover({ steps, stepIndex, onSkip, top }) {
  // absoluteFill (not flex:1) so the cover always has real bounds — a flex root
  // can collapse inside an absolutely-positioned wrapper, which left the scrim
  // invisible while the absolutely-placed header still showed.
  return (
    <View style={[StyleSheet.absoluteFill, styles.loadingScrim]} onStartShouldSetResponder={() => true}>
      <LoadingScreen />
      {steps && <TutorialHeader steps={steps} stepIndex={stepIndex} onSkip={onSkip} top={top} />}
    </View>
  );
}

// The guided first-run tutorial overlay. Reusable: takes the steps array and
// the index of the active step, spotlights a measured target element, and puts
// Emo next to it with a speech bubble. Two presentations:
//
//   'inline' (default) — an absolute-fill sibling rendered inside the screen.
//     The spotlight hole lets touches through to the REAL element, so the app
//     behaves exactly as it will after the tutorial. Use wherever the screen
//     has no elevated siblings that would paint over the overlay.
//
//   'modal' — a transparent Modal, for screens (Home) whose children set
//     elevation and would interleave with an in-tree overlay on Android. The
//     real element shows through the hole visually, but the Modal eats its
//     touches, so a transparent touchable in the hole calls `onTargetPress` —
//     the caller re-triggers the real action there.

const SCRIM = 'rgba(10,10,14,0.75)'; // ~75% dim — target stays the bright spot
const EDGE = 8;                      // spotlight never hugs the screen edge

const clamp = (value, min, max) => Math.min(Math.max(value, min), max < min ? min : max);

// ─── Target measuring ────────────────────────────────────────────────────────
// Attach `ref` + `onLayout` to the element a step points at. Measured in window
// coordinates once the step becomes active (after a beat, so entrance layout
// has settled).
export function useTutorialTarget(active) {
  const ref = useRef(null);
  const [rect, setRect] = useState(null);
  const measure = useCallback(() => {
    requestAnimationFrame(() => {
      ref.current?.measureInWindow?.((x, y, width, height) => {
        if (!(width > 0 && height > 0)) return;
        setRect(previous => (
          previous && previous.x === x && previous.y === y
            && previous.width === width && previous.height === height
            ? previous
            : { x, y, width, height }
        ));
      });
    });
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    // A few quick retries — measureInWindow can return 0s until layout settles,
    // so we try again fast rather than waiting on one slow timer.
    const timers = [0, 60, 160, 400].map(ms => setTimeout(measure, ms));
    return () => timers.forEach(clearTimeout);
  }, [active, measure]);

  return { ref, rect, onLayout: measure };
}

// A lightweight multi-target variant for choice screens. Every supplied card
// stays bright and receives the same breathing outline while the rest of the
// screen is dimmed. It is visual-only, so the real cards remain tappable.
export function TutorialMultiSpotlight({
  steps, stepIndex, targetRects, onSkip, message, coachTargetRect,
  scrollOffset = null, padding = 4, viewportTop = 0, toast = null, toastHoldMs = 3600,
}) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const W = window.width;
  const H = window.height;
  const coachLeft = coachTargetRect
    ? clamp(coachTargetRect.x + coachTargetRect.width + 8, 8, W - 8)
    : 8;
  const coachWidth = Math.max(0, W - coachLeft - 8);
  const coachTop = coachTargetRect ? coachTargetRect.y - 48 : insets.top + 58;
  const scrollLinked = Boolean(scrollOffset);
  // A tall offscreen canvas lets the scrim and every cutout share the native
  // ScrollView translation. No per-frame measuring is needed while scrolling.
  const scrollBuffer = scrollLinked ? H * 2 : 0;
  const layerHeight = H + (scrollBuffer * 2);
  const sourceRects = scrollLinked
    ? targetRects
    : targetRects.filter(rect => (
      rect.y + rect.height + padding > EDGE && rect.y - padding < H - EDGE
    ));
  const holes = sourceRects
    .map(rect => {
      const x = Math.max(EDGE, rect.x - padding);
      const y = scrollLinked ? rect.y - padding : Math.max(EDGE, rect.y - padding);
      const right = Math.min(W - EDGE, rect.x + rect.width + padding);
      const bottom = scrollLinked
        ? rect.y + rect.height + padding
        : Math.min(H - EDGE, rect.y + rect.height + padding);
      return { x, y, width: right - x, height: bottom - y, radius: 18 };
    })
    .filter(hole => hole.width > 0 && hole.height > 0);

  // Before the targets are measured, show the opaque loading cover so the plain
  // page never flashes — the spotlight cutouts replace it once measured.
  if (!holes.length) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.inlineRoot]} pointerEvents="box-none">
        <TutorialLoadingCover steps={steps} stepIndex={stepIndex} onSkip={onSkip} top={insets.top + 12} />
      </View>
    );
  }

  // The coach scrolls with its target, but fades out just before it would
  // slide into the fixed header band — a bubble pointing at a tile that has
  // scrolled away only clutters the top of the screen.
  const coachFadeEnd = Math.max(1, coachTop - viewportTop - 10);
  const coachFadeStart = Math.max(0, coachFadeEnd - 44);
  const coachOpacity = scrollLinked
    ? scrollOffset.interpolate({
      inputRange: [coachFadeStart, coachFadeEnd],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    })
    : 1;

  return (
    <View style={[StyleSheet.absoluteFill, styles.inlineRoot]} pointerEvents="box-none">
      {/* The screen's fixed header band stays uniformly dimmed — the scrolled
          cutouts are clipped below it and can never punch holes into it. */}
      {viewportTop > 0 && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: 0, width: W, height: viewportTop, backgroundColor: SCRIM }}
        />
      )}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, top: viewportTop, width: W, height: H - viewportTop, overflow: 'hidden' }}
      >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.multiMovingLayer,
          { top: -scrollBuffer - viewportTop, width: W, height: layerHeight },
          scrollLinked && {
            transform: [{ translateY: Animated.multiply(scrollOffset, -1) }],
          },
        ]}
      >
        <Svg width={W} height={layerHeight} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Mask id="tutorial-multi-spotlight">
            <Rect x={0} y={0} width={W} height={layerHeight} fill="#fff" />
            {holes.map((hole, index) => (
              <Rect
                key={index}
                x={hole.x}
                y={hole.y + scrollBuffer}
                width={hole.width}
                height={hole.height}
                rx={hole.radius}
                ry={hole.radius}
                fill="#000"
              />
            ))}
          </Mask>
          <Rect
            x={0}
            y={0}
            width={W}
            height={layerHeight}
            fill={SCRIM}
            mask="url(#tutorial-multi-spotlight)"
          />
        </Svg>

        {holes.map((hole, index) => (
          // scaleTo 1 — these rings hug near-full-width rows, so any scale
          // growth visibly slides past the card edges. Opacity-only breathing.
          <PulseRing
            key={index}
            left={hole.x - 2}
            top={hole.y + scrollBuffer - 2}
            size={hole.width + 4}
            height={hole.height + 4}
            radius={hole.radius + 2}
            scaleTo={1}
            opacityRange={[0.85, 0.4]}
          />
        ))}

        {message && coachTargetRect && coachWidth > 150 && (
          <Animated.View
            style={[
              styles.multiCoach,
              { left: coachLeft, top: coachTop + scrollBuffer, width: coachWidth, opacity: coachOpacity },
            ]}
            pointerEvents="none"
          >
            <View style={styles.multiCoachBubble}>
              <Text style={styles.multiCoachText}>{message}</Text>
              <View style={styles.multiCoachTail} />
            </View>
            <Image
              source={EMO_POSES.head}
              style={styles.multiCoachMascot}
              contentFit="contain"
              pointerEvents="none"
            />
          </Animated.View>
        )}
      </Animated.View>
      </View>

      <TutorialHeader
        steps={steps}
        stepIndex={stepIndex}
        onSkip={onSkip}
        top={insets.top + 12}
      />
      {/* Duolingo-style pop-in toast, held a bit longer for instructions. */}
      {toast ? <CheerToast text={toast} top={insets.top + 52} holdMs={toastHoldMs} /> : null}
    </View>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────────────

// Soft "breathing" ring around the spotlight — a 2s ease-in-out loop, never a
// hard blink.
function PulseRing({
  left, top, size, radius, height, color = 'rgba(255,255,255,0.92)', scaleTo = 1.08,
  opacityRange = [0.9, 0.45], durationMs = 1000,
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1, duration: durationMs, easing: Easing.inOut(Easing.ease),
        useNativeDriver: true, isInteraction: false,
      }),
      Animated.timing(pulse, {
        toValue: 0, duration: durationMs, easing: Easing.inOut(Easing.ease),
        useNativeDriver: true, isInteraction: false,
      }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, durationMs]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left, top,
        width: size, height, borderRadius: radius,
        borderWidth: 2.5, borderColor: color,
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: opacityRange }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }) }],
      }}
    />
  );
}

// The mock nav band mirrors the real Home nav bar, so it stays white rather
// than following the intro clip's background.
function TutorialBottomNav({ width, height, top, targetRect, onAdd, background = '#FFFFFF' }) {
  const targetTop = targetRect.y - top;
  const navItems = [
    ['⌂', 'Home', true],
    ['⌕', 'Search', false],
    null,
    ['✨', 'Revamp', false],
    ['⊙', 'Profile', false],
  ];

  return (
    <View style={[styles.introBottomNav, { width, height, top, backgroundColor: background }]}>
      <View style={[styles.introNavRow, { top: targetTop + 14 }]} pointerEvents="none">
        {navItems.map((item, index) => (
          <View key={index} style={styles.introNavItem}>
            {item && (
              <>
                <Text style={[styles.introNavIcon, item[2] && styles.introNavActive, index === 3 && styles.introNavRevamp]}>
                  {item[0]}
                </Text>
                <Text style={[styles.introNavLabel, item[2] && styles.introNavActive]}>{item[1]}</Text>
              </>
            )}
          </View>
        ))}
      </View>

      {/* Deliberately gentle — a slow, faint breath, not a flash. */}
      <PulseRing
        left={targetRect.x - 10}
        top={targetTop - 10}
        size={targetRect.width + 20}
        height={targetRect.height + 20}
        radius={(targetRect.width + 20) / 2}
        color="rgba(65,65,68,0.72)"
        scaleTo={1.03}
        opacityRange={[0.5, 0.2]}
        durationMs={1300}
      />
      <TouchableOpacity
        style={[
          styles.introAddButton,
          {
            left: targetRect.x,
            top: targetTop,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: Math.min(targetRect.width, targetRect.height) / 2,
          },
        ]}
        activeOpacity={0.82}
        onPress={onAdd}
      >
        <Text style={styles.introAddIcon}>⊕</Text>
      </TouchableOpacity>
    </View>
  );
}

function IntroPeachBubble({ stageHeight }) {
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(reveal, {
      toValue: 1,
      friction: 7,
      tension: 85,
      useNativeDriver: true,
      isInteraction: false,
    }).start();
  }, [reveal]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.introPeachBubble,
        {
          top: stageHeight * 0.34,
          opacity: reveal,
          transform: [
            { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
            { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          ],
        },
      ]}
    >
      <Text style={styles.introPeachText}>
        hello, my name’s TMO{`\n`}i’ll be taking you through the app.{`\n`}tap the flashing button to get started.
      </Text>
      <View style={styles.introPeachTail} />
    </Animated.View>
  );
}

// Emo with a gentle idle bounce.
export function EmoSprite({ pose = 'peek', width, height, style }) {
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bounce, {
        toValue: 1, duration: 850, easing: Easing.inOut(Easing.ease),
        useNativeDriver: true, isInteraction: false,
      }),
      Animated.timing(bounce, {
        toValue: 0, duration: 850, easing: Easing.inOut(Easing.ease),
        useNativeDriver: true, isInteraction: false,
      }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[style, {
        transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
      }]}
    >
      <Image source={EMO_POSES[pose]} style={{ width, height }} contentFit="contain" autoplay />
    </Animated.View>
  );
}

// Step dots + skip. `steps` with progress:false (the finale) aren't counted;
// while one of those is active, every dot shows filled.
export function TutorialHeader({ steps, stepIndex, onSkip, top, tone = 'light' }) {
  const dotSteps = steps.filter(step => step.progress !== false);
  const activeDot = steps[stepIndex]?.progress === false
    ? dotSteps.length
    : dotSteps.indexOf(steps[stepIndex]);
  const dark = tone === 'dark';
  return (
    <View style={[styles.header, { top }]} pointerEvents="box-none">
      <View style={styles.dots}>
        {dotSteps.map((step, index) => (
          <View
            key={step.id}
            style={[
              styles.dot,
              dark && styles.dotDark,
              index < activeDot && styles.dotDone,
              dark && index < activeDot && styles.dotDoneDark,
              index === activeDot && styles.dotActive,
              dark && index === activeDot && styles.dotActiveDark,
            ]}
          />
        ))}
      </View>
      {onSkip && (
        <TouchableOpacity onPress={onSkip} hitSlop={10} activeOpacity={0.75}>
          <Text style={[styles.skip, dark && styles.skipDark]}>skip tour</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Tiny celebration toast — pops in when a step opens, honoring the PREVIOUS
// step's `cheer`, then fades. Momentum is the point.
export function CheerToast({ text, top, holdMs = 1000, persist = false }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const spring = Animated.spring(anim, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true, isInteraction: false });
    // persist → pop in and stay (the caller unmounts it when the step is done).
    const sequence = persist
      ? [spring]
      : [
        spring,
        Animated.delay(holdMs),
        Animated.timing(anim, { toValue: 2, duration: 320, useNativeDriver: true, isInteraction: false }),
      ];
    Animated.sequence(sequence).start();
  }, [anim, holdMs, persist]);
  if (!text) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.cheer, {
        top,
        opacity: anim.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
        transform: [
          { scale: anim.interpolate({ inputRange: [0, 1, 2], outputRange: [0.6, 1, 0.95] }) },
          { translateY: anim.interpolate({ inputRange: [0, 1, 2], outputRange: [10, 0, -12] }) },
        ],
      }]}
    >
      <Text style={styles.cheerText}>{text}</Text>
    </Animated.View>
  );
}

// Speech bubble with a tail aimed at Emo / the spotlight.
function Bubble({ title, text, width, left, tailLeft, tailSide = 'bottom' }) {
  return (
    <View style={[styles.bubble, { width, marginLeft: left }]}>
      {title ? <Text style={styles.bubbleTitle}>{title}</Text> : null}
      <Text style={styles.bubbleText}>{text}</Text>
      <View
        style={[
          styles.bubbleTail,
          tailSide === 'bottom' ? { bottom: -8 } : { top: -8 },
          { left: tailLeft },
        ]}
      />
    </View>
  );
}

// Blocks touches over the dimmed area in inline mode. A plain View lets
// touches fall through to siblings underneath, so it must claim the responder.
function TouchBlocker({ style }) {
  return <View style={style} onStartShouldSetResponder={() => true} />;
}

// The first hello stays on a white stage until the user taps the highlighted
// add button. The GIF and final still stay mounted together; revealing the
// preloaded still over the GIF prevents a blank frame when Emo finishes falling.
function TutorialMascotIntro({
  step, steps, stepIndex, width, height, stageHeight, top, targetRect, onTargetPress, onSkip,
}) {
  const [displayed, setDisplayed] = useState(false);
  const [showFinalFrame, setShowFinalFrame] = useState(false);
  const isVideo = !!step.introVideo;
  const offsetX = width * (step.introOffsetXPct ?? 0);

  // Video intro: plays once, muted, and holds its last frame (loop off).
  const player = useVideoPlayer(step.introVideo || null, (p) => {
    if (!p) return;
    p.loop = false;
    p.muted = true;
    p.play();
  });

  // Video: reveal the peach bubble when playback reaches the end, with a
  // duration fallback so the bubble always shows.
  useEffect(() => {
    if (!isVideo) return undefined;
    const duration = step.introDurationMs ?? 4900;
    const timer = setTimeout(() => setShowFinalFrame(true), duration);
    const sub = player?.addListener?.('playToEnd', () => setShowFinalFrame(true));
    return () => { clearTimeout(timer); sub?.remove?.(); };
  }, [isVideo, player, step.introDurationMs]);

  // GIF: swap to the final still as the loop comes back around.
  useEffect(() => {
    if (isVideo || !displayed) return undefined;
    const duration = step.introDurationMs ?? 4900;
    const timer = setTimeout(() => setShowFinalFrame(true), Math.max(0, duration - 50));
    return () => clearTimeout(timer);
  }, [isVideo, displayed, step.introDurationMs]);

  // Drives the stage + letterbox around the clip (the nav band below keeps the
  // real app's white so it reads as the actual bottom bar).
  const introBg = step.introBackground || '#FEFEFE';

  return (
    <View
      style={[
        styles.intro,
        {
          width,
          height,
          backgroundColor: introBg,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={{ width, height: stageHeight, backgroundColor: introBg }}>
        {isVideo ? (
          <VideoView
            player={player}
            style={[StyleSheet.absoluteFill, { transform: [{ translateX: offsetX }] }]}
            contentFit={step.introFit || 'contain'}
            nativeControls={false}
            pointerEvents="none"
          />
        ) : (
          <>
            <Image
              source={step.introAsset}
              style={[StyleSheet.absoluteFill, { transform: [{ translateX: offsetX }] }]}
              contentFit="contain"
              autoplay
              onDisplay={() => setDisplayed(true)}
              pointerEvents="none"
            />
            <Image
              source={step.introFinalAsset}
              style={[
                StyleSheet.absoluteFill,
                { opacity: showFinalFrame ? 1 : 0, transform: [{ translateX: offsetX }] },
              ]}
              contentFit="contain"
              pointerEvents="none"
            />
          </>
        )}
        <TouchBlocker style={StyleSheet.absoluteFill} />
        {showFinalFrame && <IntroPeachBubble stageHeight={stageHeight} />}
      </View>
      <TutorialBottomNav
        width={width}
        height={height - stageHeight}
        top={stageHeight}
        targetRect={targetRect}
        onAdd={onTargetPress}
      />
      <TutorialHeader
        steps={steps}
        stepIndex={stepIndex}
        onSkip={onSkip}
        top={top}
        tone="dark"
      />
    </View>
  );
}

// ─── The overlay ─────────────────────────────────────────────────────────────
export default function TutorialOverlay({
  steps, stepIndex, targetRect, onTargetPress, onSkip, presentation = 'inline',
}) {
  const step = steps[stepIndex];
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();

  if (!step) return null;

  // Show the opaque loading cover the instant the step is active — before the
  // target is measured — so the plain page never flashes. The spotlight hole
  // replaces it a frame later once targetRect lands.
  if (!targetRect) {
    const cover = (
      <TutorialLoadingCover steps={steps} stepIndex={stepIndex} onSkip={onSkip} top={insets.top + 12} />
    );
    if (presentation === 'modal') {
      return (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onSkip}>
          {cover}
        </Modal>
      );
    }
    return <View style={[StyleSheet.absoluteFill, styles.inlineRoot]} pointerEvents="box-none">{cover}</View>;
  }

  const W = window.width;
  // A statusBarTranslucent Modal spans the full screen; the inline overlay
  // spans the app window.
  const H = presentation === 'modal'
    ? Math.max(window.height, Dimensions.get('screen').height)
    : window.height;

  // measureInWindow already returns full-window coordinates for the target,
  // including when this overlay is rendered in a translucent Modal. Adding the
  // Android status-bar height again shifts the spotlight below the real button.
  const offsetY = 0;

  // Spotlight hole: target + padding, squared up for circles, clamped on-screen.
  const pad = step.padding ?? 10;
  let hx = targetRect.x - pad;
  let hy = targetRect.y + offsetY - pad;
  let hw = targetRect.width + pad * 2;
  let hh = targetRect.height + pad * 2;
  if (step.shape === 'circle') {
    const size = Math.max(hw, hh);
    hx -= (size - hw) / 2;
    hy -= (size - hh) / 2;
    hw = size;
    hh = size;
  }
  hx = clamp(hx, EDGE, W - EDGE);
  hy = clamp(hy, EDGE, H - EDGE);
  hw = clamp(hw, 0, W - EDGE - hx);
  hh = clamp(hh, 0, H - EDGE - hy);
  const radius = step.shape === 'circle' ? Math.min(hw, hh) / 2 : (step.radius ?? 18);

  const holeCX = hx + hw / 2;
  const placeAbove = hy + hh / 2 > H * 0.5;

  // Bubble centered on the spotlight, clamped to the screen; the tail tracks
  // the spotlight's center so it always points the right way.
  const bubbleW = Math.min(320, W - 48);
  const bubbleLeft = clamp(holeCX - bubbleW / 2, 16, W - 16 - bubbleW);
  const tailLeft = clamp(holeCX - bubbleLeft - 9, 14, bubbleW - 32);

  const pose = step.pose || 'peek';
  const emoW = 96;
  const emoH = 96;
  const emoLeft = clamp(holeCX - emoW / 2, 12, W - 12 - emoW);

  const headerTop = insets.top + offsetY + 12;
  const cheer = steps[stepIndex - 1]?.cheer;
  const showingIntro = !!(step.introAsset || step.introVideo);

  const content = (
    <View style={styles.root} pointerEvents="box-none">
      {/* The animated white stage already isolates the first action. Later
          steps use the dark scrim with a punched-out spotlight. */}
      {!showingIntro && (
        <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Mask id="tutorial-spotlight">
            <Rect x={0} y={0} width={W} height={H} fill="#fff" />
            <Rect x={hx} y={hy} width={hw} height={hh} rx={radius} ry={radius} fill="#000" />
          </Mask>
          <Rect x={0} y={0} width={W} height={H} fill={SCRIM} mask="url(#tutorial-spotlight)" />
        </Svg>
      )}

      {presentation === 'inline' && (
        <>
          {/* Dimmed regions swallow touches; the hole stays live for the real
              element underneath. */}
          <TouchBlocker style={{ position: 'absolute', left: 0, top: 0, width: W, height: hy }} />
          <TouchBlocker style={{ position: 'absolute', left: 0, top: hy + hh, width: W, height: H - hy - hh }} />
          <TouchBlocker style={{ position: 'absolute', left: 0, top: hy, width: hx, height: hh }} />
          <TouchBlocker style={{ position: 'absolute', left: hx + hw, top: hy, width: W - hx - hw, height: hh }} />
        </>
      )}

      {!showingIntro && (
        <PulseRing left={hx - 6} top={hy - 6} size={hw + 12} height={hh + 12} radius={radius + 6} />
      )}

      {presentation === 'modal' && !showingIntro && (
        // The Modal eats touches, so this transparent hit area re-fires the
        // real action.
        <TouchableOpacity
          style={{ position: 'absolute', left: hx, top: hy, width: hw, height: hh }}
          activeOpacity={0.85}
          onPress={onTargetPress}
        />
      )}

      {!showingIntro && (
        <TutorialHeader steps={steps} stepIndex={stepIndex} onSkip={onSkip} top={headerTop} />
      )}
      {!showingIntro && <CheerToast text={cheer} top={headerTop + 44} />}

      {/* Steps without text run spotlight-only — no bubble, no mascot.
          `mascot: false` on a step keeps the bubble but drops the sprite. */}
      {!showingIntro && !!(step.title || step.text) && (placeAbove ? (
          <View style={[styles.stack, { bottom: H - hy + 14 }]} pointerEvents="none">
            <Bubble title={step.title} text={step.text} width={bubbleW} left={bubbleLeft} tailLeft={tailLeft} tailSide="bottom" />
            {step.mascot !== false && (
              <EmoSprite pose={pose} width={emoW} height={emoH} style={{ marginLeft: emoLeft, marginTop: 2 }} />
            )}
          </View>
        ) : (
          <View style={[styles.stack, { top: hy + hh + 16 }]} pointerEvents="none">
            <Bubble title={step.title} text={step.text} width={bubbleW} left={bubbleLeft} tailLeft={tailLeft} tailSide="top" />
            {step.mascot !== false && (
              <EmoSprite pose="peek" width={96} height={96} style={{ marginLeft: clamp(holeCX - 48, 12, W - 108), marginTop: 8 }} />
            )}
          </View>
        ))}

      {showingIntro && (
        <TutorialMascotIntro
          step={step}
          steps={steps}
          stepIndex={stepIndex}
          width={W}
          height={H}
          stageHeight={Math.max(0, targetRect.y + offsetY - 10)}
          top={headerTop}
          targetRect={targetRect}
          onTargetPress={onTargetPress}
          onSkip={onSkip}
        />
      )}
    </View>
  );

  if (presentation === 'modal') {
    return (
      <Modal
        visible
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={onSkip}
      >
        {content}
      </Modal>
    );
  }
  // elevation outranks zIndex on Android — must beat any elevated siblings.
  return <View style={[StyleSheet.absoluteFill, styles.inlineRoot]} pointerEvents="box-none">{content}</View>;
}

// Non-blocking Emo banner for steps where the user needs the whole screen
// (typing into the gear receipt). No scrim, no spotlight — just guidance.
export function TutorialBanner({ steps, stepIndex, onSkip, top = 100 }) {
  const step = steps[stepIndex];
  const cheer = steps[stepIndex - 1]?.cheer;
  if (!step) return null;
  return (
    <View style={[styles.bannerRoot, { top }]} pointerEvents="box-none">
      <CheerToast text={cheer} top={-52} />
      <View style={styles.bannerCard}>
        <EmoSprite pose={step.pose || 'peek'} width={54} height={54} />
        <View style={styles.bannerBody}>
          <Text style={styles.bannerText}>{step.text}</Text>
          {onSkip && (
            <TouchableOpacity onPress={onSkip} hitSlop={8} activeOpacity={0.75}>
              <Text style={styles.bannerSkip}>skip tour</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// Emo whispering over the full-screen loader while the background removal
// runs — "watch this…"
export function EmoWhisper({ text }) {
  return (
    <View style={styles.whisperRoot} pointerEvents="none">
      <View style={styles.whisperBubble}>
        <Text style={styles.whisperText}>{text}</Text>
        <View style={[styles.bubbleTail, { bottom: -8, left: '50%', marginLeft: -9 }]} />
      </View>
      <EmoSprite pose="peek" width={84} height={84} style={{ marginTop: 10 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: 'relative' },
  inlineRoot: { zIndex: 100, elevation: 40 },
  // Opaque loading cover — hides the page until the spotlight is measured.
  loadingScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0E0E10',
    alignItems: 'center', justifyContent: 'center',
  },

  multiCoach: {
    position: 'absolute', alignItems: 'center',
    gap: 4, zIndex: 4, elevation: 45,
  },
  multiMovingLayer: { position: 'absolute', left: 0 },
  multiCoachBubble: {
    width: '70%',
    backgroundColor: '#FFFFFF', borderRadius: 18,
    paddingVertical: 7, paddingHorizontal: 8,
    borderWidth: 1, borderColor: '#E2E2E2',
    shadowColor: '#000', shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 10,
  },
  multiCoachText: {
    color: '#161616', fontSize: 11.5, lineHeight: 15,
    fontWeight: '700', textAlign: 'center',
  },
  multiCoachTail: {
    position: 'absolute', left: '50%', bottom: -7,
    width: 14, height: 14, marginLeft: -7,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#E2E2E2',
    transform: [{ rotate: '45deg' }],
  },
  multiCoachMascot: { width: 175, height: 110, marginTop: 10 },

  header: {
    position: 'absolute', left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotDark: { backgroundColor: 'rgba(14,14,16,0.22)' },
  dotDone: { backgroundColor: 'rgba(255,255,255,0.85)' },
  dotDoneDark: { backgroundColor: 'rgba(14,14,16,0.72)' },
  dotActive: { width: 20, backgroundColor: '#FFFFFF' },
  dotActiveDark: { backgroundColor: '#0E0E10' },
  skip: { color: 'rgba(255,255,255,0.78)', fontSize: 13, fontWeight: '700', paddingVertical: 6 },
  skipDark: { color: 'rgba(14,14,16,0.72)' },

  intro: { position: 'absolute', left: 0, top: 0, zIndex: 200, elevation: 80 },
  introBottomNav: {
    position: 'absolute', left: 0,
    backgroundColor: '#FEFEFE',
  },
  introNavRow: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
  },
  introNavItem: { width: '20%', height: 38, alignItems: 'center', justifyContent: 'center' },
  introNavIcon: { color: '#8A8792', fontSize: 20, lineHeight: 21 },
  introNavLabel: { color: '#8A8792', fontSize: 9, marginTop: 2 },
  introNavActive: { color: '#161616' },
  introNavRevamp: { color: '#C8A400' },
  introAddButton: {
    position: 'absolute', zIndex: 3,
    backgroundColor: '#161616',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 8,
  },
  introAddIcon: { color: '#FFFFFF', fontSize: 26, fontWeight: '300' },
  introPeachBubble: {
    position: 'absolute', alignSelf: 'center',
    width: '82%', maxWidth: 330,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: '#E2E2E2',
    borderRadius: 20,
    paddingVertical: 16, paddingHorizontal: 18,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 14, elevation: 10,
  },
  introPeachText: {
    color: '#3B241B', fontSize: 16, lineHeight: 23, fontWeight: '700',
    textAlign: 'center',
  },
  introPeachTail: {
    position: 'absolute', left: '50%', bottom: -9,
    width: 18, height: 18, marginLeft: -9,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderColor: '#E2E2E2',
    transform: [{ rotate: '45deg' }],
  },

  cheer: {
    position: 'absolute', alignSelf: 'center', maxWidth: '86%',
    backgroundColor: '#FFFFFF', borderRadius: 18,
    paddingVertical: 8, paddingHorizontal: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 12,
  },
  cheerText: { color: '#0E0E10', fontSize: 14, fontWeight: '800', textAlign: 'center' },

  stack: { position: 'absolute', left: 0, right: 0 },

  bubble: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 16, marginBottom: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 18,
  },
  bubbleTitle: { color: '#0E0E10', fontFamily: 'serif', fontSize: 17, fontWeight: '700', marginBottom: 5 },
  bubbleText: { color: '#4A4A52', fontSize: 14, lineHeight: 21 },
  bubbleTail: {
    position: 'absolute',
    width: 18, height: 18, borderRadius: 3, backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },

  bannerRoot: { position: 'absolute', left: 16, right: 16, zIndex: 100, elevation: 40 },
  bannerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: '#161616',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 12,
  },
  bannerBody: { flex: 1, gap: 4 },
  bannerText: { color: '#2B2B31', fontSize: 13.5, lineHeight: 19 },
  bannerSkip: { color: '#8A8792', fontSize: 12, fontWeight: '700' },

  whisperRoot: { position: 'absolute', left: 0, right: 0, bottom: 64, alignItems: 'center' },
  whisperBubble: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 14, elevation: 12,
  },
  whisperText: { color: '#0E0E10', fontSize: 15, fontWeight: '700' },
});
