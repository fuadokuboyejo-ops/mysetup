import { Platform } from 'react-native';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

// The tutorial's final page — a whole screen of its own (App.js renders it in
// place of the board, not as an overlay).
export default function TutorialEndScreen({ onDone }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View
        style={[
          styles.sheet,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 28 },
        ]}
      >
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

  sheet: {
    flex: 1,
    backgroundColor: C.sheet,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 14,
  },
  eyebrow: { color: C.purple, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { color: C.ink, fontFamily: serif, fontSize: 30, lineHeight: 38, fontWeight: '600' },
  body: { color: C.body, fontSize: 15, lineHeight: 22 },

  cta: { marginTop: 4, backgroundColor: C.ink, borderRadius: 26, paddingVertical: 17, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
