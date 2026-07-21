import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

const END_INTRO = require('../assets/end_of_tutorial.gif');
const END_LOOP = require('../assets/end_of_tutorail_loop.gif');

// end_of_tutorial.gif is 5900ms — start the fade a hair before it ends so the
// hand-off to the loop underneath is invisible (same trick as the onboarding
// intro→loop gifs).
const INTRO_DURATION_MS = 5700;
const CROSSFADE_MS = 200;

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

// The tutorial's final page — a whole screen of its own (App.js renders it in
// place of the board, not as an overlay). Built to match the onboarding
// "tabs": the mascot gif fills the whole hero area above a compact white sheet
// that carries the copy and finish button. The gif covers the hero (reaching
// every edge) so its background never leaves a visible seam.
export default function TutorialEndScreen({ onDone }) {
  const insets = useSafeAreaInsets();
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
  }, [introOpacity]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Hero — the gif fills all the space above the sheet. Loop plays
          underneath forever; the intro plays once on top, then fades out. */}
      <View style={styles.hero}>
        <Image source={END_LOOP} style={StyleSheet.absoluteFill} contentFit="cover" autoplay />
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: introOpacity }]}>
          <Image source={END_INTRO} style={StyleSheet.absoluteFill} contentFit="cover" autoplay />
        </Animated.View>
      </View>

      {/* Compact bottom sheet — the onboarding "tab". Negative margin tucks its
          rounded top over the gif's bottom edge. */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 28 }]}>
        <Text style={styles.eyebrow}>YOU DID IT</Text>
        <Text style={styles.title}>Congrats on beating the tutorial!</Text>
        <Text style={styles.body}>
          That’s the whole flow — snap your gear, cut it out, and arrange your board. Now go build something that’s unmistakably you.
        </Text>

        <TouchableOpacity style={styles.cta} onPress={onDone} activeOpacity={0.85}>
          <Text style={styles.ctaText}>Let’s go</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const C = {
  bg:     '#F5F5F0',
  sheet:  '#FFFFFF',
  ink:    '#161616',
  body:   '#6E6E73',
  purple: '#6D5EF0',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Fills everything above the sheet; the gif cover-crops to fill it edge to edge.
  hero: { flex: 1, overflow: 'hidden' },

  // Content-sized sheet at the bottom; rounded top overlaps the gif's lower edge.
  sheet: {
    marginTop: -26,
    backgroundColor: C.sheet,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 24, paddingTop: 28,
    gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 8,
  },
  eyebrow: { color: C.purple, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { color: C.ink, fontFamily: serif, fontSize: 30, lineHeight: 38, fontWeight: '600' },
  body: { color: C.body, fontSize: 15, lineHeight: 22 },

  cta: { marginTop: 4, backgroundColor: C.ink, borderRadius: 26, paddingVertical: 17, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
