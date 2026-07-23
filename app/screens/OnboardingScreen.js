import { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';

// Hero plays the full mascot GIF once (intro = frames 1–71, ~2960ms),
// then seamlessly hands off to the looping MP4 (frames 72–140, ~2910ms).
const MASCOT_GIF  = require('../assets/mascot.gif');
const MASCOT_LOOP = require('../assets/mascot_loop.mp4');
const INTRO_DURATION_MS = 4000;

const TOTAL_SLIDES = 8;
const ACTIVE_INDEX = 1; // this is slide 2

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

function CompareCard({ eyebrow, title, variant }) {
  const isBoard = variant === 'board';
  return (
    <View style={[styles.compareCard, isBoard ? styles.compareBoard : styles.compareScattered]}>
      <Text style={[styles.compareEyebrow, isBoard && styles.compareEyebrowBoard]}>{eyebrow}</Text>
      <Text style={[styles.compareTitle, !isBoard && styles.compareTitleMuted]}>{title}</Text>
    </View>
  );
}

const CROSSFADE_MS = 200;

export default function OnboardingScreen({ onContinue, onBack }) {
  const gifOpacity = useRef(new Animated.Value(1)).current;

  // Start the loop video playing immediately so it's warm when we reveal it.
  const player = useVideoPlayer(MASCOT_LOOP, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(gifOpacity, { toValue: 0, duration: CROSSFADE_MS, useNativeDriver: true }).start();
    }, INTRO_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <Dots />

        {/* Hero — both layers always mounted; opacity swap avoids mount freeze */}
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.8}
          >
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>

          <View style={styles.mascotWrapper}>
            {/* Video sits underneath at full opacity — no white flash */}
            <VideoView
              player={player}
              style={styles.mascot}
              contentFit="contain"
              nativeControls={false}
            />
            {/* GIF on top, fades out to reveal the video */}
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: gifOpacity }]}>
              <Image
                source={MASCOT_GIF}
                style={styles.mascot}
                contentFit="contain"
                autoplay
              />
            </Animated.View>
          </View>
        </View>

        {/* Content sheet */}
        <View style={styles.sheet}>
          <Text style={styles.eyebrow}>SHOW OFF YOUR SETUP</Text>
          <Text style={styles.title}>Your rig, server, and gear all in one place.</Text>
          <Text style={styles.body}>
            Scan what you own, drop it onto your board, and show the community exactly how your
            setup comes together.
          </Text>

          <View style={styles.compareRow}>
            <CompareCard variant="scattered" eyebrow="SCATTERED" title="gear notes in 5 apps" />
            <Text style={styles.arrow}>→</Text>
            <CompareCard variant="board" eyebrow="ONE BOARD" title="setup + gear in one place" />
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
  scattered: '#ECEAE3',
  border:    '#E7E4DB',
  dotOff:    '#D8D5CC',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  // Pagination
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.dotOff },
  dotActive: { width: 20, backgroundColor: C.ink },

  // Hero
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  backBtn: {
    position: 'absolute', top: 8, left: 20, zIndex: 2,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  backChevron: { color: C.ink, fontSize: 26, fontWeight: '400', marginTop: -2, marginLeft: -2 },

  mascotWrapper: { width: 420, aspectRatio: 1230 / 768 },
  mascot: { width: 420, aspectRatio: 1230 / 768, backgroundColor: 'transparent' },

  // Sheet
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

  // Compare cards
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  compareCard: { flex: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 16, gap: 8, minHeight: 92, justifyContent: 'center' },
  compareScattered: { backgroundColor: C.scattered, borderColor: C.border },
  compareBoard: { backgroundColor: C.purpleTint, borderColor: 'rgba(109,94,240,0.35)' },
  compareEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: '#9A968C' },
  compareEyebrowBoard: { color: C.purple },
  compareTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
  compareTitleMuted: { color: '#3A3A3A' },
  arrow: { color: '#B8B4AB', fontSize: 18 },

  // CTA
  cta: { marginTop: 8, backgroundColor: C.ink, borderRadius: 26, paddingVertical: 17, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
