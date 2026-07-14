import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Ellipse, Circle, Path } from 'react-native-svg';

const serif  = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
const script = Platform.select({ ios: 'Snell Roundhand', android: 'cursive', default: 'cursive' });

function Floral() {
  return (
    <Svg width={54} height={86} viewBox="0 0 54 86" fill="none">
      {[0, 72, 144, 216, 288].map((angle) => (
        <Ellipse
          key={angle}
          cx="27" cy="10" rx="5.5" ry="12.5"
          stroke="#2A2A2A" strokeWidth={1.2}
          transform={`rotate(${angle} 27 22)`}
        />
      ))}
      <Circle cx="27" cy="22" r="2.3" stroke="#2A2A2A" strokeWidth={1.2} />
      <Path
        d="M27 33 C 22 44, 32 50, 28 62 C 25 71, 32 75, 29 84"
        stroke="#2A2A2A" strokeWidth={1.2} strokeLinecap="round"
      />
      <Path
        d="M28 48 C 19 45, 12 50, 8 47 C 14 40, 23 41, 28 48 Z"
        stroke="#2A2A2A" strokeWidth={1.1} strokeLinejoin="round"
      />
    </Svg>
  );
}

function Wrinkles() {
  return (
    <View style={styles.wrinkles} pointerEvents="none">
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.05)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }}
        style={[styles.crease, { top: -30, left: -40, width: 260, transform: [{ rotate: '-16deg' }] }]}
      />
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.5)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.3 }}
        style={[styles.crease, { top: 10, left: -20, width: 240, transform: [{ rotate: '-9deg' }] }]}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.04)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.5 }}
        style={[styles.crease, { top: 70, left: -60, width: 300, transform: [{ rotate: '6deg' }] }]}
      />
    </View>
  );
}

export default function OnboardingFounderScreen({ onContinue }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Wrinkles />
          <View style={styles.floral}>
            <Floral />
          </View>
          <Text style={styles.date}>July 2026</Text>

          <Text style={styles.greeting}>Hey,</Text>

          <Text style={styles.body}>
            welcome to my setup. i'm Fuad — i built this because i couldn't find a good way to show off, catalog, and get real feedback on the setups i cared about.
          </Text>

          <Text style={styles.body}>
            reddit posts get buried. gear lists disappear. no one tells you which switch actually feels better after a month of use.
          </Text>

          <Text style={styles.body}>
            so i built the thing i wanted. photograph your gear, drop the cut-outs onto a board, tag your rack, get advice pinned to the specific piece.
          </Text>

          <Text style={styles.body}>
            this is early. some things will break. if you find something off, i read every message. reach out anytime.
          </Text>

          <Text style={styles.body}>build something you're proud of.</Text>

          <Text style={styles.dash}>—</Text>
          <Text style={styles.signature}>Fuad</Text>
          <Text style={styles.founder}>founder, my setup</Text>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity onPress={onContinue} activeOpacity={0.85} style={styles.footerBtn}>
            <Text style={styles.footerText}>let's go</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  safe: { flex: 1 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 28, paddingTop: 36, paddingBottom: 32 },

  wrinkles: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 220,
    overflow: 'hidden',
  },
  crease: { position: 'absolute', height: 90 },

  floral: { marginBottom: 24 },

  date: {
    position: 'absolute', top: 36, right: 28,
    color: '#ADADAD', fontSize: 13,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontStyle: 'italic',
  },

  greeting: {
    fontFamily: serif, fontSize: 36, fontWeight: '700',
    color: '#161616', marginBottom: 24,
  },

  body: {
    fontFamily: serif, fontSize: 16, lineHeight: 26,
    color: '#2A2A2A', marginBottom: 18,
  },

  dash: {
    fontFamily: serif, fontSize: 18, color: '#2A2A2A',
    marginTop: 8, marginBottom: 12,
  },
  signature: {
    fontFamily: script, fontSize: 42,
    color: '#1B3A8A', marginBottom: 8,
  },
  founder: {
    fontFamily: serif, fontStyle: 'italic',
    fontSize: 13, color: '#888',
  },

  footer: {
    backgroundColor: '#FAFAF8',
    paddingHorizontal: 20, paddingVertical: 20,
    paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: '#EBEBEB',
  },
  footerBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E0E0E0',
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  footerText: { color: '#161616', fontSize: 16, fontWeight: '600' },
});
