import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform,
  TextInput, ScrollView, KeyboardAvoidingView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getCurrentUser } from '../config/auth';
import { getProfileMedia, saveProfileImage, saveProfileUsername } from '../config/profile';

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

// Usernames: lowercase letters, numbers and underscores, 3–20 chars. Sanitized
// as the user types so the input can never hold something the backend rejects.
const USERNAME_MAX = 20;
const USERNAME_MIN = 3;
function sanitizeUsername(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, USERNAME_MAX);
}

export default function OnboardingProfileScreen({ onDone }) {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  const [bannerUri, setBannerUri] = useState(null);
  const [savingImage, setSavingImage] = useState(null); // 'avatar' | 'banner' | null
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const valid = username.length >= USERNAME_MIN;

  useEffect(() => {
    let active = true;
    (async () => {
      const u = await getCurrentUser();
      if (!active) return;
      setUser(u);
      // Prefill any images they already have; leave username blank so they
      // deliberately choose one (the auto-generated user-xxxx isn't a real pick).
      try {
        const media = await getProfileMedia(u);
        if (!active) return;
        setAvatarUri(media.avatarUrl || null);
        setBannerUri(media.bannerUrl || null);
      } catch { /* new account may have no profile row yet — ignore */ }
    })();
    return () => { active = false; };
  }, []);

  const pickImage = async (kind) => {
    if (!user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to choose an image.');
      return;
    }
    const isAvatar = kind === 'avatar';
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: isAvatar ? [1, 1] : [16, 9],
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setSavingImage(kind);
    try {
      const resized = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: isAvatar ? 512 : 1440 } }],
        { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      const saved = await saveProfileImage(user, kind, resized.base64);
      if (isAvatar) setAvatarUri(saved.avatarUrl || result.assets[0].uri);
      else setBannerUri(saved.bannerUrl || result.assets[0].uri);
    } catch (e) {
      Alert.alert('Could not save image', e?.message || 'Please try again.');
    } finally {
      setSavingImage(null);
    }
  };

  const handleContinue = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfileUsername(user, username);
      onDone?.();
    } catch (e) {
      setError(e?.message || 'Could not save your username.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your profile</Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'android' ? 'height' : undefined}
          style={styles.kav}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          >
            <Text style={styles.title}>Make it yours</Text>
            <Text style={styles.subtitle}>Pick a username and add a banner and photo.</Text>

            {/* Banner + overlapping avatar preview, each tappable to change */}
            <View style={styles.previewWrap}>
              <TouchableOpacity style={styles.banner} onPress={() => pickImage('banner')} activeOpacity={0.85}>
                {bannerUri ? (
                  <Image source={{ uri: bannerUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <View style={styles.bannerPlaceholder}>
                    <Text style={styles.bannerPlaceholderText}>＋ Add banner</Text>
                  </View>
                )}
                {savingImage === 'banner' && (
                  <View style={styles.imageSaving}><ActivityIndicator color="#fff" /></View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.avatar} onPress={() => pickImage('avatar')} activeOpacity={0.85}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarPlaceholderText}>＋</Text>
                  </View>
                )}
                {savingImage === 'avatar' && (
                  <View style={[styles.imageSaving, styles.avatarSaving]}><ActivityIndicator color="#fff" /></View>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>USERNAME</Text>
            <View style={styles.usernameBox}>
              <Text style={styles.at}>@</Text>
              <TextInput
                style={styles.usernameInput}
                value={username}
                onChangeText={(t) => { setUsername(sanitizeUsername(t)); setError(null); }}
                placeholder="username"
                placeholderTextColor="#ADADAD"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                maxLength={USERNAME_MAX}
                returnKeyType="done"
              />
            </View>
            {error
              ? <Text style={styles.error}>{error}</Text>
              : <Text style={styles.hint}>Lowercase letters, numbers and underscores · at least {USERNAME_MIN} characters</Text>}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.cta, (!valid || saving) && styles.ctaDisabled]}
              onPress={handleContinue}
              activeOpacity={valid && !saving ? 0.85 : 1}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={[styles.ctaText, !valid && styles.ctaTextDisabled]}>Continue</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const C = {
  bg: '#FFFFFF',
  ink: '#161616',
  body: '#6E6E73',
  purple: '#6D5EF0',
  inputBg: '#F2F2F2',
  tint: '#EDEBF3',
};

const AVATAR = 84;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  kav: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  headerTitle: { color: C.ink, fontSize: 16, fontWeight: '700' },

  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },

  title: { color: C.ink, fontFamily: serif, fontSize: 30, lineHeight: 38, fontWeight: '700' },
  subtitle: { color: C.body, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 24 },

  previewWrap: { marginBottom: 44, position: 'relative' },
  banner: {
    width: '100%', aspectRatio: 16 / 9, borderRadius: 20, overflow: 'hidden',
    backgroundColor: C.tint,
  },
  bannerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bannerPlaceholderText: { color: C.purple, fontSize: 14, fontWeight: '700' },
  imageSaving: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },

  avatar: {
    position: 'absolute', left: 20, bottom: -AVATAR / 2,
    width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2,
    borderWidth: 4, borderColor: '#FFFFFF', backgroundColor: C.tint,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.tint },
  avatarPlaceholderText: { color: C.purple, fontSize: 26, fontWeight: '400' },
  avatarSaving: { borderRadius: AVATAR / 2 },

  label: { color: '#ADADAD', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  usernameBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.inputBg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
  },
  at: { color: C.body, fontSize: 17, fontWeight: '600', marginRight: 4 },
  usernameInput: { flex: 1, color: C.ink, fontSize: 17, fontWeight: '600', padding: 0 },
  hint: { color: '#ADADAD', fontSize: 12.5, marginTop: 10, lineHeight: 17 },
  error: { color: '#D64545', fontSize: 13, marginTop: 10, lineHeight: 18 },

  footer: { paddingHorizontal: 24, paddingBottom: 28, paddingTop: 12 },
  cta: { backgroundColor: C.ink, borderRadius: 26, paddingVertical: 17, alignItems: 'center' },
  ctaDisabled: { backgroundColor: '#E0E0E0' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ctaTextDisabled: { color: '#AAAAAA' },
});
