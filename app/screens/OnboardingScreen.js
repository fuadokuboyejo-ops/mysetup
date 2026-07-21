import { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Platform, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

// Gear pieces drift in a slow orbit around the glow. Each is offset from the
// orbit's centre, tilted slightly, and bobs on its own timing so the group
// never looks mechanical.
const PIECES = [
  { label: 'monitor',  x: -66,  y: -126, w: 112, h: 64, tilt: '-6deg', bob: 3200 },
  { label: 'keyboard', x: -112, y: -8,   w: 90,  h: 40, tilt: '5deg',  bob: 3800 },
  { label: 'mouse',    x: 40,   y: -28,  w: 32,  h: 50, tilt: '-8deg', bob: 2900, vertical: true },
  { label: 'pc',       x: 14,   y: 44,   w: 70,  h: 88, tilt: '7deg',  bob: 3500 },
  { label: 'deskmat',  x: -98,  y: 88,   w: 102, h: 28, tilt: '-4deg', bob: 4100 },
  { label: 'headset',  x: 70,   y: -92,  w: 70,  h: 38, tilt: '8deg',  bob: 3400 },
  { label: 'laptop',   x: -166, y: -66,  w: 86,  h: 48, tilt: '-5deg', bob: 3000 },
  { label: 'console',  x: 88,   y: 20,   w: 74,  h: 34, tilt: '-7deg', bob: 3900 },
  { label: 'mic',      x: -132, y: 26,   w: 34,  h: 62, tilt: '6deg',  bob: 3300, vertical: true },
];

const ORBIT_MS = 30000;

export default function OnboardingScreen({ onContinue }) {
  const spin = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const bobs = useRef(PIECES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Slow continuous orbit.
    const orbit = Animated.loop(Animated.timing(spin, {
      toValue: 1, duration: ORBIT_MS, easing: Easing.linear,
      useNativeDriver: true, isInteraction: false,
    }));

    // Glow breathes in and out.
    const glow = Animated.loop(Animated.sequence([
      Animated.timing(breathe, {
        toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease),
        useNativeDriver: true, isInteraction: false,
      }),
      Animated.timing(breathe, {
        toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease),
        useNativeDriver: true, isInteraction: false,
      }),
    ]));

    // Each piece bobs on its own cycle.
    const bobbing = bobs.map((value, index) => Animated.loop(Animated.sequence([
      Animated.timing(value, {
        toValue: 1, duration: PIECES[index].bob / 2, easing: Easing.inOut(Easing.ease),
        useNativeDriver: true, isInteraction: false,
      }),
      Animated.timing(value, {
        toValue: 0, duration: PIECES[index].bob / 2, easing: Easing.inOut(Easing.ease),
        useNativeDriver: true, isInteraction: false,
      }),
    ])));

    orbit.start();
    glow.start();
    bobbing.forEach(loop => loop.start());

    // Sheet rises in once on mount.
    Animated.timing(rise, {
      toValue: 1, duration: 700, delay: 150,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();

    return () => {
      orbit.stop();
      glow.stop();
      bobbing.forEach(loop => loop.stop());
    };
  }, [spin, breathe, rise, bobs]);

  const orbitRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  // Counter-rotation keeps every piece upright while the group turns.
  const counterRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.hero}>
        <LinearGradient colors={[C.heroTop, C.heroBottom]} style={StyleSheet.absoluteFill} />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            {
              opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
              transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
            },
          ]}
        >
          <Svg width={230} height={230}>
            <Defs>
              <RadialGradient id="glowFill" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={C.accent} stopOpacity="0.10" />
                <Stop offset="0.7" stopColor={C.accent} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={115} cy={115} r={115} fill="url(#glowFill)" />
          </Svg>
        </Animated.View>

        <Animated.View style={[styles.orbit, { transform: [{ rotate: orbitRotate }] }]} pointerEvents="none">
          {PIECES.map((piece, index) => (
            <Animated.View
              key={piece.label}
              style={[
                styles.piece,
                {
                  left: piece.x,
                  top: piece.y,
                  width: piece.w,
                  height: piece.h,
                  transform: [
                    { translateY: bobs[index].interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
                    { rotate: counterRotate },
                    { rotate: piece.tilt },
                  ],
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.pieceLabel, piece.vertical && styles.pieceLabelVertical]}
              >
                {piece.label}
              </Text>
            </Animated.View>
          ))}
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.sheet,
          {
            opacity: rise,
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
          },
        ]}
      >
        <SafeAreaView edges={['bottom']}>
          <Text style={styles.wordmark}>
            my setup<Text style={styles.wordmarkDot}>.</Text>
          </Text>
          <Text style={styles.tagline}>your gear, laid out.</Text>

          <TouchableOpacity style={styles.cta} onPress={onContinue} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Rack up</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const C = {
  heroTop:    '#FFFFFF',
  heroBottom: '#F5F5F7',
  sheet:      '#FFFFFF',
  border:     '#ECECEE',
  ink:        '#0E0E10',
  sub:        '#6A6A72',
  accent:     '#3D6BB3',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.sheet },

  hero: { flex: 1, position: 'relative', overflow: 'hidden' },

  glow: {
    position: 'absolute', top: '50%', left: '50%',
    width: 230, height: 230, marginLeft: -115, marginTop: -115,
  },

  // Zero-size anchor at the orbit's centre; pieces are offset from it.
  orbit: { position: 'absolute', top: '52%', left: '50%', width: 0, height: 0 },

  piece: {
    position: 'absolute',
    backgroundColor: C.sheet,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12, shadowRadius: 14, elevation: 6,
  },
  pieceLabel: { color: C.sub, fontSize: 10 },
  // Rotation doesn't change the layout box, so give the label room along the
  // card's long side first — otherwise it wraps inside the narrow width.
  pieceLabelVertical: {
    width: 46, textAlign: 'center',
    transform: [{ rotate: '90deg' }],
  },

  sheet: {
    backgroundColor: C.sheet,
    borderTopWidth: 1, borderTopColor: C.border,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 26, paddingTop: 42, paddingBottom: 34,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.05, shadowRadius: 16, elevation: 8,
  },
  wordmark: {
    fontFamily: serif, fontSize: 42, fontWeight: '600',
    color: C.ink, letterSpacing: -0.5,
  },
  wordmarkDot: { color: C.accent },
  tagline: { fontSize: 16, color: C.sub, marginTop: 8, marginBottom: 30 },

  cta: {
    width: '100%', paddingVertical: 19,
    backgroundColor: C.ink, borderRadius: 32,
    alignItems: 'center',
  },
  ctaText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
