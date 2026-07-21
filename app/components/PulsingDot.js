import { useRef, useEffect } from 'react';
import { Animated, Pressable, Easing, StyleSheet } from 'react-native';

// An Instagram-style photo tag: a small white dot pinned on a piece of gear,
// with a slow "breathing" halo that signals it's tappable without being noisy.
//
// React Native can't animate box-shadow spread directly, so two native-driven
// layers expand behind the dot: a soft fill plus a crisp ring. The dot itself
// stays stable, while press scales it to 0.85 for tactile feedback.
//
// The 16px white dot stays fixed while its halo reaches roughly 36px. The 2.4s
// loop is staggered by index * 0.5s so dots never peak in sync (ambient
// "breathing", not a synchronized strobe).

const DOT = 16;
const CYCLE = 2400;          // ms — deliberate; below ~2s feels anxious, above ~3s stops reading as interactive
const STAGGER = 500;         // ms between each dot's phase

function useTagPulse(index) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1, duration: CYCLE / 2, easing: Easing.inOut(Easing.ease),
          useNativeDriver: true, isInteraction: false,
        }),
        Animated.timing(pulse, {
          toValue: 0, duration: CYCLE / 2, easing: Easing.inOut(Easing.ease),
          useNativeDriver: true, isInteraction: false,
        }),
      ]),
    );
    // Offset each dot's phase. Modulo keeps the initial wait under one cycle even
    // with many dots, so nothing sits idle for long.
    const delay = (index * STAGGER) % CYCLE;
    const timer = setTimeout(() => loop.start(), delay);
    return () => { clearTimeout(timer); loop.stop(); };
  }, [index, pulse]);

  return pulse;
}

// Exported so edit-mode drag handles can use the exact same ambient pulse.
export function TagPulseHalo({ index = 0, selected = false }) {
  const pulse = useTagPulse(index);
  // Let the pulse travel well beyond the dot so it remains obvious over busy
  // photos. The 16px tag itself stays fixed; only these decorative layers grow.
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.2, 1.9] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 0.06] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.05, 2.25] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0.8, 0.35, 0] });

  return (
    <Animated.View pointerEvents="none" style={styles.haloAnchor}>
      <Animated.View
        style={[
          styles.haloFill,
          selected && styles.haloFillSelected,
          { opacity: haloOpacity, transform: [{ scale: haloScale }] },
        ]}
      />
      <Animated.View
        style={[
          styles.haloRing,
          selected && styles.haloRingSelected,
          { opacity: ringOpacity, transform: [{ scale: ringScale }] },
        ]}
      />
    </Animated.View>
  );
}

export default function PulsingDot({ x, y, index = 0, selected = false, onPress }) {
  const press = useRef(new Animated.Value(0)).current;   // 0 → 1 on press-in

  const dotScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] });

  return (
    <Pressable
      style={[styles.wrap, { left: `${x}%`, top: `${y}%` }]}
      onPress={onPress}
      onPressIn={() => Animated.timing(press, { toValue: 1, duration: 120, useNativeDriver: true }).start()}
      onPressOut={() => Animated.timing(press, { toValue: 0, duration: 120, useNativeDriver: true }).start()}
      hitSlop={12}
    >
      <TagPulseHalo index={index} selected={selected} />
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
  haloAnchor: {
    position: 'absolute', width: DOT, height: DOT, left: 0, top: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  haloFill: {
    position: 'absolute', width: DOT, height: DOT, left: 0, top: 0,
    borderRadius: DOT / 2,
    backgroundColor: '#ffffff',
    transformOrigin: 'center',
  },
  haloFillSelected: { backgroundColor: '#8fb8f0' },
  haloRing: {
    position: 'absolute', width: DOT, height: DOT, left: 0, top: 0,
    borderRadius: DOT / 2,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    transformOrigin: 'center',
  },
  haloRingSelected: { borderColor: '#8fb8f0' },
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
