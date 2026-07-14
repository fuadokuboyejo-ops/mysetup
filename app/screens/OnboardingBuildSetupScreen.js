import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

const BUILD_GIF = require('../assets/buildboard.gif');

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

export default function OnboardingBuildSetupScreen({ onContinue, onSkip }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <Image
        source={BUILD_GIF}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        autoplay
      />

      <View style={styles.sheet}>
        <SafeAreaView edges={['bottom']}>
          <Text style={styles.eyebrow}>LET'S BUILD</Text>
          <Text style={styles.title}>create your first build</Text>
          <Text style={styles.body}>
            Drop your gear onto a board and share your setup with the world.
          </Text>
          <TouchableOpacity style={styles.cta} onPress={onContinue} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Start building</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSkip} activeOpacity={0.6} style={styles.skipBtn}>
            <Text style={styles.skipText}>maybe later</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FCFCFC' },

  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 24, paddingTop: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.07, shadowRadius: 16, elevation: 8,
    gap: 12,
  },
  eyebrow: { color: '#6D5EF0', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: {
    fontFamily: serif, fontSize: 30, fontWeight: '700',
    color: '#161616', lineHeight: 38,
  },
  body: { color: '#6E6E73', fontSize: 15, lineHeight: 22 },

  cta: {
    marginTop: 4, backgroundColor: '#161616', borderRadius: 26,
    paddingVertical: 17, alignItems: 'center',
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipBtn: { alignItems: 'center', paddingVertical: 6, marginBottom: 8 },
  skipText: { color: '#6E6E73', fontSize: 14 },
});
