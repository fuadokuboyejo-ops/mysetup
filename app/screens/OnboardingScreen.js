import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, SafeAreaView, Platform,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

// Light-mode onboarding — "Show off your setup" slide.
// The hero loops ONLY the seated "typing at the setup" segment of the mascot
// animation (frames 72–140 of the source), forever. We play it via expo-video
// (MP4) rather than an animated GIF because core <Image> freezes a GIF after a
// single play in Expo Go; the video player loops seamlessly and is far lighter.
const MASCOT = require('../assets/mascot_loop.mp4');

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

export default function OnboardingScreen({ onContinue, onBack }) {
  const player = useVideoPlayer(MASCOT, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <Dots />

        {/* Hero — mascot over a purple glow */}
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.8}
          >
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>

          <VideoView
            player={player}
            style={styles.mascot}
            contentFit="contain"
            nativeControls={false}
          />
        </View>

        {/* Content sheet */}
        <View style={styles.sheet}>
          <Text style={styles.eyebrow}>SHOW OFF YOUR SETUP</Text>
          <Text style={styles.title}>Your rig, server, and gear — all in one place.</Text>
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
  bg:        '#F4F1EA', // warm off-white
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

  mascot: { width: 300, aspectRatio: 1230 / 768, backgroundColor: 'transparent' },

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
