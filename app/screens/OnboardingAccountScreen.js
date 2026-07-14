import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Platform, TextInput,
  KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

const PEEKING_BOT = require('../assets/peeking_bot.png');

const TOTAL_SLIDES = 8;
const ACTIVE_INDEX = 7;

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

export default function OnboardingAccountScreen({ onContinue, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = email.length > 0 && password.length >= 8;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.8}
          >
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <Dots />
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.mascotArea}>
              <Image
                source={PEEKING_BOT}
                style={styles.mascot}
                contentFit="contain"
              />
            </View>

            <Text style={styles.title}>Claim your space.</Text>
            <Text style={styles.subtitle}>
              create an account to save your setup and browse others.
            </Text>

            <View style={styles.inputBox}>
              <Text style={styles.inputLabel}>EMAIL</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@domain.com"
                placeholderTextColor={C.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
            </View>

            <View style={[styles.inputBox, { marginTop: 12 }]}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="at least 8 characters"
                  placeholderTextColor={C.placeholder}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.showBtn}>{showPassword ? 'hide' : 'show'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.cta, !canSubmit && styles.ctaDisabled]}
              onPress={() => canSubmit && onContinue({ email, password })}
              activeOpacity={canSubmit ? 0.85 : 1}
            >
              <Text style={[styles.ctaText, !canSubmit && styles.ctaTextDisabled]}>
                Create account
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.signinRow}>
            <Text style={styles.signinText}>already have an account? </Text>
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Text style={styles.signinLink}>sign in</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => onContinue({})}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          >
            <Text style={styles.skipText}>skip for now</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const C = {
  bg:          '#FFFFFF',
  ink:         '#161616',
  body:        '#6E6E73',
  purple:      '#6D5EF0',
  placeholder: '#ADADAD',
  inputBg:     '#F2F2F2',
  dotOff:      '#D8D5CC',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  kav: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center',
  },
  backChevron: { color: C.ink, fontSize: 24, fontWeight: '400', marginTop: -2, marginLeft: -2 },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.dotOff },
  dotActive: { width: 20, backgroundColor: C.ink },
  headerSpacer: { width: 36 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },

  eyebrow: {
    color: C.purple, fontSize: 12, fontWeight: '700',
    letterSpacing: 2, textAlign: 'center', marginBottom: 20,
  },

  mascotArea: { alignItems: 'center', marginBottom: 28 },
  mascot: { width: 220, aspectRatio: 1230 / 768 },
  laterPill: {
    marginTop: 12,
    backgroundColor: '#EBEBEB', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 7,
  },
  laterText: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },

  title: {
    color: C.ink, fontFamily: serif,
    fontSize: 38, lineHeight: 46, fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: { color: C.body, fontSize: 15, lineHeight: 22, marginBottom: 28 },

  inputBox: {
    backgroundColor: C.inputBg, borderRadius: 14,
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14,
  },
  inputLabel: {
    color: '#ADADAD', fontSize: 11, fontWeight: '700',
    letterSpacing: 1.2, marginBottom: 6,
  },
  input: { color: C.ink, fontSize: 16, padding: 0 },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1 },
  showBtn: { color: C.purple, fontSize: 14, fontWeight: '600', marginLeft: 12 },

  cta: {
    marginTop: 24, backgroundColor: C.ink,
    borderRadius: 26, paddingVertical: 17, alignItems: 'center',
  },
  ctaDisabled: { backgroundColor: '#E0E0E0' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ctaTextDisabled: { color: '#AAAAAA' },

  signinRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingTop: 12,
  },
  signinText: { color: C.body, fontSize: 14 },
  signinLink: { color: C.ink, fontSize: 14, fontWeight: '700' },
  skipBtn: { alignItems: 'center', paddingBottom: 32, paddingTop: 10 },
  skipText: { color: C.placeholder, fontSize: 13 },
});
