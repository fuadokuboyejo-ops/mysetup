import { useEffect, useRef } from 'react';
import {
  View, StyleSheet, Modal, Animated, Easing, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Confetti from './Confetti';
import { TUTORIAL_STEPS, tutorialStepIndex } from '../config/tutorial';
import { TutorialHeader } from './TutorialOverlay';

// The tutorial's cutout-reveal beat, rendered by App.js right after the first
// background removal succeeds: the fresh cutout pops in, then flies into the
// Profile tab on the bottom nav. It shows the user's real photo (their first
// cutout), so the payoff is theirs. (The finale is its own full screen —
// TutorialEndScreen — rendered in place of the board, not here.)

export default function TutorialCelebration({ stepId, cutoutUri, onAdvance, onSkip }) {
  const insets = useSafeAreaInsets();
  const stepIndex = tutorialStepIndex(stepId);
  const step = TUTORIAL_STEPS[stepIndex];
  if (!step) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onSkip}>
      <View style={styles.root}>
        {/* The reveal flies the cutout into the Profile tab, so the nav must
            stay readable behind it — a light dim only. */}
        <View style={[styles.scrim, styles.scrimLight]} />
        <TutorialHeader steps={TUTORIAL_STEPS} stepIndex={stepIndex} onSkip={onSkip} top={insets.top + 12} />
        {stepId === 'cutout-reveal' && (
          <RevealPhase cutoutUri={cutoutUri} onContinue={() => onAdvance('cutout-reveal')} />
        )}
      </View>
    </Modal>
  );
}

// The cutout pops in center-screen, hangs for a beat, then flies down into the
// Profile tab on the bottom nav — "your gear lives in your profile" — and the
// tutorial advances by itself. No bubble, no button: the motion is the message.
function RevealPhase({ cutoutUri, onContinue }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pop = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);

  const size = Math.min(width - 96, 340);
  // Flight target: the Profile slot — last of the five evenly spaced nav
  // items — just above the home indicator.
  const targetX = width * 0.9 - width / 2;
  const targetY = (height - insets.bottom - 46) - height / 2;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true, isInteraction: false }),
      Animated.delay(700),
      Animated.timing(fly, {
        toValue: 1, duration: 620, easing: Easing.in(Easing.cubic),
        useNativeDriver: true, isInteraction: false,
      }),
    ]).start(({ finished: didFinish }) => {
      if (didFinish && !finished.current) {
        finished.current = true;
        onContinue();
      }
    });
  }, [pop, fly, onContinue]);

  return (
    <View style={styles.phase} pointerEvents="box-none">
      <Confetti count={18} />
      <Animated.View
        style={{
          opacity: fly.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, targetX] }) },
            { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [0, targetY] }) },
            { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.12] }) },
          ],
        }}
      >
        <Animated.View
          style={{
            opacity: pop,
            transform: [
              { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
              { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-10deg', '0deg'] }) },
            ],
          }}
        >
          <Image source={{ uri: cutoutUri }} style={{ width: size, height: size }} contentFit="contain" />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,14,0.92)' },
  scrimLight: { backgroundColor: 'rgba(10,10,14,0.3)' },
  phase: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 18 },
});
