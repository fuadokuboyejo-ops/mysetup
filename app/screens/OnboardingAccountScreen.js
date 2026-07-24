import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Platform, TextInput,
  KeyboardAvoidingView, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { signUp, signIn, resendSignupConfirmation } from '../config/auth';
import { signInWithGoogle } from '../config/googleAuth';
import { GoogleLogo, AppleLogo } from '../components/SocialIcons';

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

export default function OnboardingAccountScreen({ onContinue, onBack, onSkip }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState('signup'); // 'signup' | 'signin'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pendingEmail, setPendingEmail] = useState(null);
  const [resending, setResending] = useState(false);

  const isSignIn = mode === 'signin';
  const canSubmit = email.length > 0 && password.length >= 8 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    const fn = isSignIn ? signIn : signUp;
    const { user, session, error: err } = await fn(email, password);
    setLoading(false);
    if (err) {
      // Surface Supabase's message (bad password, already registered, email
      // confirmation required, etc.) rather than dead-ending onboarding.
      setError(err);
      return;
    }
    if (!session) {
      setPendingEmail(email.trim());
      setError(null);
      return;
    }
    onContinue({ email, user });
  };

  const handleResend = async () => {
    if (!pendingEmail || resending) return;
    setResending(true);
    setError(null);
    setNotice(null);
    const { error: resendError } = await resendSignupConfirmation(pendingEmail);
    setResending(false);
    if (resendError) setError(resendError);
    else setNotice('Verification email sent again. Open it on this device.');
  };

  // Native Google Sign-In. Requires a development build (does not work in Expo
  // Go) and the two client IDs in .env. See app/config/googleAuth.js.
  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    const { user, error: err, cancelled } = await signInWithGoogle();
    setLoading(false);
    if (cancelled) return;
    if (err) { setError(err); return; }
    onContinue({ user });
  };

  // Apple isn't wired yet (needs a paid Apple Developer account + provider
  // config). Kept stubbed so the button stays in the UI.
  const handleApple = () => {
    setError('Apple sign-in isn’t set up yet — coming soon.');
  };

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
          // iOS: let the ScrollView manage keyboard insets (automaticallyAdjustKeyboardInsets)
          // instead of padding — the padding behavior added keyboard-height whitespace
          // you could scroll into and shoved the footer up over the inputs.
          behavior={Platform.OS === 'android' ? 'height' : undefined}
          style={styles.kav}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          >
            <View style={styles.mascotArea}>
              <Image
                source={PEEKING_BOT}
                style={styles.mascot}
                contentFit="contain"
              />
            </View>

            <Text style={styles.title}>
              {isSignIn ? 'Welcome back.' : 'Claim your space.'}
            </Text>
            <Text style={styles.subtitle}>
              {isSignIn
                ? 'sign in to load your saved setups.'
                : 'create an account to save your setup and browse others.'}
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

            {error && <Text style={styles.error}>{error}</Text>}
            {notice && <Text style={styles.notice}>{notice}</Text>}

            {pendingEmail && (
              <View style={styles.verifyBox}>
                <Text style={styles.verifyTitle}>Check your email</Text>
                <Text style={styles.verifyText}>
                  We sent a verification link to {pendingEmail}. Open it on this device to continue.
                </Text>
                <TouchableOpacity onPress={handleResend} disabled={resending} activeOpacity={0.75}>
                  <Text style={styles.resendText}>{resending ? 'sending…' : 'resend verification email'}</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.cta, !canSubmit && styles.ctaDisabled]}
              onPress={handleSubmit}
              activeOpacity={canSubmit ? 0.85 : 1}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.ctaText, !canSubmit && styles.ctaTextDisabled]}>
                  {isSignIn ? 'Sign in' : 'Create account'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.appleBtn}
              onPress={handleApple}
              activeOpacity={0.85}
            >
              <AppleLogo size={18} color="#FFFFFF" />
              <Text style={styles.appleText}>Continue with Apple</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogle}
              activeOpacity={0.85}
            >
              <GoogleLogo size={18} />
              <Text style={styles.googleText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Footer lives inside the ScrollView so it scrolls with the form.
                As direct KeyboardAvoidingView children (below the flex:1 ScrollView)
                the padding behavior shoved them up over the inputs when the
                keyboard opened, reading as a white block covering the password. */}
            <View style={styles.signinRow}>
              <Text style={styles.signinText}>
                {isSignIn ? "don't have an account? " : 'already have an account? '}
              </Text>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                onPress={() => { setMode(isSignIn ? 'signup' : 'signin'); setError(null); }}
              >
                <Text style={styles.signinLink}>{isSignIn ? 'create one' : 'sign in'}</Text>
              </TouchableOpacity>
            </View>

            {onSkip && (
              <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.7}>
                <Text style={styles.skipText}>skip for now</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
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
  dotOff:      '#B8B4AB',
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

  error: { color: '#D64545', fontSize: 13, marginTop: 16, lineHeight: 18 },
  notice: { color: '#347A55', fontSize: 13, marginTop: 16, lineHeight: 18 },
  verifyBox: { marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: '#F2F0FF' },
  verifyTitle: { color: C.ink, fontSize: 15, fontWeight: '700' },
  verifyText: { color: C.body, fontSize: 13, lineHeight: 19, marginTop: 5 },
  resendText: { color: C.purple, fontSize: 13, fontWeight: '700', marginTop: 12 },

  cta: {
    marginTop: 24, backgroundColor: C.ink,
    borderRadius: 26, paddingVertical: 17, alignItems: 'center',
  },
  ctaDisabled: { backgroundColor: '#E0E0E0' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  divider: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 22, marginBottom: 18,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EAEAEA' },
  dividerText: { color: C.placeholder, fontSize: 13, marginHorizontal: 12 },

  appleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000000', borderRadius: 26,
    paddingVertical: 16, gap: 10,
  },
  appleText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 26,
    borderWidth: 1, borderColor: '#E0E0E0',
    paddingVertical: 16, gap: 10, marginTop: 12,
  },
  googleText: { color: C.ink, fontSize: 16, fontWeight: '600' },
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
