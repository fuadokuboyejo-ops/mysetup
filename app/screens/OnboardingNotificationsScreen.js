import { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';

const NOTIF_VIDEO = require('../assets/onboardingnew4.mp4');

// Clip runs ~3.03s and fades the cards out at the very end (to loop cleanly).
// We stop it here — right after the third notification lands, before the fade —
// so the finished stack stays on screen instead of freezing on a blank frame.
const FREEZE_AT = 2.5;

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

export default function OnboardingNotificationsScreen({ onContinue, onBack }) {
  const player = useVideoPlayer(NOTIF_VIDEO, (p) => {
    p.loop = false;
    p.muted = true;
    p.timeUpdateEventInterval = 0.05;
    p.play();
  });

  // Pause once the stack is fully shown so the three notifications stay put.
  useEffect(() => {
    const sub = player.addListener('timeUpdate', ({ currentTime }) => {
      if (currentTime >= FREEZE_AT) {
        player.currentTime = FREEZE_AT;
        player.pause();
      }
    });
    return () => sub.remove();
  }, [player]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          {onBack ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.8}
            >
              <Text style={styles.backChevron}>‹</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>stay in the loop{'\n'}throughout the day</Text>
          <Text style={styles.subtitle}>never miss a like, comment, or new follower</Text>

          {/* Big centered notification animation — the focus of the screen. */}
          <View style={styles.videoWrap}>
            <VideoView
              player={player}
              style={styles.video}
              contentFit="contain"
              nativeControls={false}
              pointerEvents="none"
            />
          </View>
        </View>

        <View style={styles.footer}>
          {/* TODO: wire to the real OS permission request once expo-notifications
              is added; for now both paths just continue into the feed. */}
          <TouchableOpacity style={styles.cta} onPress={() => onContinue?.()} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Enable notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onContinue?.()} activeOpacity={0.6} style={styles.skipBtn}>
            <Text style={styles.skipText}>skip for now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const C = {
  bg:     '#FFFFFF',
  ink:    '#161616',
  body:   '#6E6E73',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center',
  },
  backChevron: { color: C.ink, fontSize: 24, fontWeight: '400', marginTop: -2, marginLeft: -2 },
  headerTitle: { flex: 1, textAlign: 'center', color: C.ink, fontSize: 16, fontWeight: '700' },
  headerSpacer: { width: 36 },

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },

  title: { color: C.ink, fontFamily: serif, fontSize: 30, lineHeight: 38, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: C.body, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10 },

  // Fills all the space between the subtitle and the Next button so the
  // animation sits centered on the page.
  videoWrap: { flex: 1, alignItems: 'stretch', justifyContent: 'center', marginTop: 8 },
  video: { width: '100%', height: '100%' },

  footer: { paddingHorizontal: 24, paddingBottom: 28, paddingTop: 12 },
  cta: { backgroundColor: C.ink, borderRadius: 26, paddingVertical: 17, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  skipText: { color: C.body, fontSize: 13 },
});
