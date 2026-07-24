import { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

const BOARD_INTRO = require('../assets/board.gif');
const BOARD_LOOP  = require('../assets/board_loop.gif');

const INTRO_DURATION_MS = 3850; // board.gif is 4080ms — start fade 230ms before end
const CROSSFADE_MS = 200;

const TOTAL_SLIDES = 8;
const ACTIVE_INDEX = 2;

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

function Dots() {
  return (
    <View style={styles.dots}>
      {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
        <View key={i} style={[styles.dot, i === ACTIVE_INDEX && styles.dotActive]} />
      ))}
    </View>
  );
}

function StepCard({ number, label }) {
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepNumber}>{number}</Text>
      </View>
      <Text style={styles.stepLabel}>{label}</Text>
    </View>
  );
}

export default function OnboardingBoardScreen({ onContinue, onBack }) {
  const introOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(introOpacity, {
        toValue: 0,
        duration: CROSSFADE_MS,
        useNativeDriver: true,
      }).start();
    }, INTRO_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <Dots />

        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.8}
          >
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>

          <View style={styles.videoWrapper}>
            {/* Loop GIF sits underneath — autoloops forever */}
            <Image
              source={BOARD_LOOP}
              style={styles.video}
              contentFit="contain"
              autoplay
            />
            {/* Intro GIF on top — plays once then fades out to reveal loop */}
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: introOpacity }]}>
              <Image
                source={BOARD_INTRO}
                style={styles.video}
                contentFit="contain"
                autoplay
              />
            </Animated.View>
          </View>
        </View>

        <View style={styles.sheet}>
          <Text style={styles.eyebrow}>MAKE IT YOURS</Text>
          <Text style={styles.title}>Build a board that's as unique as your setup.</Text>
          <Text style={styles.body}>
            Every board is a blank canvas. Arrange your gear, pick your layout, and create something that's unmistakably you.
          </Text>

          <View style={styles.stepsRow}>
            <StepCard number="1" label="Pick your layout" />
            <StepCard number="2" label="Add your gear" />
            <StepCard number="3" label="Make it yours" />
          </View>

          <TouchableOpacity style={styles.cta} onPress={onContinue} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const C = {
  bg:        '#F5F5F0',
  sheet:     '#FFFFFF',
  ink:       '#161616',
  body:      '#6E6E73',
  purple:    '#6D5EF0',
  purpleTint:'#EEEBFB',
  border:    '#E7E4DB',
  dotOff:    '#B8B4AB',
  stepBg:    '#F4F1EA',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.dotOff },
  dotActive: { width: 20, backgroundColor: C.ink },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', position: 'relative', overflow: 'hidden' },
  backBtn: {
    position: 'absolute', top: 8, left: 20, zIndex: 2,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  backChevron: { color: C.ink, fontSize: 26, fontWeight: '400', marginTop: -2, marginLeft: -2 },

  videoWrapper: { width: '100%', aspectRatio: 1230 / 768, transform: [{ scale: 1.12 }], transformOrigin: 'bottom' },
  video: { width: '100%', aspectRatio: 1230 / 768, backgroundColor: 'transparent' },

  sheet: {
    backgroundColor: C.sheet,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 36,
    gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 8,
  },
  eyebrow: { color: C.purple, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { color: C.ink, fontFamily: serif, fontSize: 30, lineHeight: 38, fontWeight: '600' },
  body: { color: C.body, fontSize: 15, lineHeight: 22 },

  stepsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  stepCard: {
    flex: 1, backgroundColor: C.stepBg, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    paddingVertical: 16, paddingHorizontal: 12,
    alignItems: 'center', gap: 10,
  },
  stepBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.purpleTint, alignItems: 'center', justifyContent: 'center',
  },
  stepNumber: { color: C.purple, fontSize: 15, fontWeight: '700' },
  stepLabel: { color: C.ink, fontSize: 13, fontWeight: '600', textAlign: 'center' },

  cta: { marginTop: 8, backgroundColor: C.ink, borderRadius: 26, paddingVertical: 17, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
