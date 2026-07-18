import { useRef, useEffect } from 'react';
import { Animated, Pressable, Easing, StyleSheet } from 'react-native';

// An Instagram-style photo tag: a small white dot pinned on a piece of gear,
// with a slow "breathing" halo that signals it's tappable without being noisy.
//
// React Native can't animate box-shadow the way the CSS spec does, so the halo
// is a separate Animated.View behind the dot that scales up + fades out (native
// driver, so it stays smooth). The dot itself never resizes — only the halo —
// keeping the tap target stable. Press scales the dot to 0.85 for tactile feel.
//
// Spec: 16px white dot, 2px dark border; halo 3px@20% → 8px@5%; 2.4s ease-in-out
// loop; dots staggered by index * 0.5s so they never peak in sync (ambient
// "breathing", not a synchronized strobe).

const DOT = 16;
const CYCLE = 2400;          // ms — deliberate; below ~2s feels anxious, above ~3s stops reading as interactive
const STAGGER = 500;         // ms between each dot's phase

export default function PulsingDot({ x, y, index = 0, selected = false, onPress }) {
  const pulse = useRef(new Animated.Value(0)).current;   // 0 → 1 → 0, drives the halo
  const press = useRef(new Animated.Value(0)).current;   // 0 → 1 on press-in

  useEffect(() => {
    // JS-driven (not native): these dots render inside <Modal>s (post composer,
    // post detail), and on Android the native animation driver frequently fails
    // to run inside a Modal's separate window. A few small dots on the JS thread
    // is cheap, and it runs reliably everywhere.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: CYCLE / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: CYCLE / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    // Offset each dot's phase. Modulo keeps the initial wait under one cycle even
    // with many dots, so nothing sits idle for long.
    const delay = (index * STAGGER) % CYCLE;
    const timer = setTimeout(() => loop.start(), delay);
    return () => { clearTimeout(timer); loop.stop(); };
  }, [index, pulse]);

  // Halo grows from a tight ring to a wide one while fading. Opacity range is
  // boosted above the CSS spec's 0.2/0.05 because a white halo that faint is
  // nearly invisible over a photo on-device.
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.375, 2.4] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.08] });
  const dotScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] });

  return (
    <Pressable
      style={[styles.wrap, { left: `${x}%`, top: `${y}%` }]}
      onPress={onPress}
      onPressIn={() => Animated.timing(press, { toValue: 1, duration: 120, useNativeDriver: false }).start()}
      onPressOut={() => Animated.timing(press, { toValue: 0, duration: 120, useNativeDriver: false }).start()}
      hitSlop={12}
    >
      <Animated.View style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />
      <Animated.View style={[styles.dot, selected && styles.dotSelected, { transform: [{ scale: dotScale }] }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Centered on its % coordinate. Overflow is visible so the halo can bleed past.
  wrap: {
    position: 'absolute', width: DOT, height: DOT,
    marginLeft: -DOT / 2, marginTop: -DOT / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  // The expanding/fading breathing ring behind the dot (a translucent white disc).
  halo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: DOT / 2,
    backgroundColor: '#ffffff',
  },
  dot: {
    width: DOT, height: DOT, borderRadius: DOT / 2,
    backgroundColor: '#ffffff',
    borderWidth: 2, borderColor: 'rgba(0,0,0,0.3)',
    // The constant "0 2px 6px rgba(0,0,0,0.5)" depth shadow from the spec.
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 6,
    elevation: 4,
  },
  dotSelected: { borderColor: '#8fb8f0', backgroundColor: '#eaf2ff' },
});
