import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, StatusBar, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { supabase } from '../config/supabase';
import { getProfileMedia } from '../config/profile';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '../config/legal';

// ─── Line icons (outline style, matching the settings-list aesthetic) ─────────
const ICON = '#222222';
const STROKE = 1.7;

function FeedbackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path
        d="M4 5.5h16A1.5 1.5 0 0 1 21.5 7v8a1.5 1.5 0 0 1-1.5 1.5H9.5L5 20v-3.5H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5z"
        stroke={ICON} strokeWidth={STROKE} fill="none" strokeLinejoin="round"
      />
      <Path d="M7 9.5h10M7 12.5h6" stroke={ICON} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
function BellIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M6 9a6 6 0 0 1 12 0c0 4.5 1.6 5.5 1.6 5.5H4.4S6 13.5 6 9z" stroke={ICON} strokeWidth={STROKE} fill="none" strokeLinejoin="round" />
      <Path d="M10 18.5a2 2 0 0 0 4 0" stroke={ICON} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
function StarIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M12 3.5l2.5 5 5.5.8-4 3.9.95 5.5L12 16.1 7.1 18.7 8 13.2l-4-3.9 5.5-.8z" stroke={ICON} strokeWidth={STROKE} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}
function LogoutIcon({ color = ICON }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" stroke={color} strokeWidth={STROKE} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M17.5 8.5L21 12l-3.5 3.5" stroke={color} strokeWidth={STROKE} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={10} y1={12} x2={21} y2={12} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}
function TrashIcon({ color = '#D1453B' }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M4 7h16" stroke={color} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
      <Path d="M9.5 7V5.4a1.4 1.4 0 0 1 1.4-1.4h2.2a1.4 1.4 0 0 1 1.4 1.4V7" stroke={color} strokeWidth={STROKE} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6.5 7l.9 12.2a1.8 1.8 0 0 0 1.8 1.7h5.6a1.8 1.8 0 0 0 1.8-1.7L17.5 7" stroke={color} strokeWidth={STROKE} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function Chevron() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M9 5l7 7-7 7" stroke="#B0B0B5" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function DocIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M7 3.5h7l3.5 3.5V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" stroke={ICON} strokeWidth={STROKE} fill="none" strokeLinejoin="round" />
      <Path d="M14 3.5V7h3.5" stroke={ICON} strokeWidth={STROKE} fill="none" strokeLinejoin="round" />
      <Path d="M8.5 11.5h7M8.5 14.5h7M8.5 17.5h4" stroke={ICON} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

// A single tappable list row: icon · label · chevron.
function Row({ icon, label, onPress, danger }) {
  return (
    <TouchableOpacity style={S.row} onPress={onPress} activeOpacity={0.6}>
      <View style={S.rowIcon}>{icon}</View>
      <Text style={[S.rowLabel, danger && S.rowLabelDanger]}>{label}</Text>
      <Chevron />
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ onBack, onOpenProfile, onLogout, onManagePlan, onDeleteAccount, onCommunityFeedback, isPremium }) {
  const [profile, setProfile] = useState({ name: 'You', avatarUrl: null });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data?.user) return;
        const media = await getProfileMedia(data.user);
        setProfile({
          name: media.displayName || media.username || 'You',
          avatarUrl: media.avatarUrl,
        });
      } catch { /* keep the placeholder */ }
    })();
  }, []);

  const initial = (profile.name || 'Y').trim().charAt(0).toUpperCase();

  const comingSoon = (title) =>
    Alert.alert(title, 'This is coming soon.');

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => onLogout?.() },
    ]);
  };

  const openLegal = (url) =>
    Linking.openURL(url).catch(() => Alert.alert('Could not open link', 'Please try again.'));

  const confirmDelete = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account, setups, and gear. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDeleteAccount?.() },
      ],
    );
  };

  return (
    <View style={S.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <SafeAreaView style={S.safe} edges={['top']}>
        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

          {/* Title */}
          <View style={S.titleRow}>
            <TouchableOpacity onPress={onBack} style={S.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={S.backText}>‹</Text>
            </TouchableOpacity>
            <Text style={S.title}>Settings</Text>
          </View>

          {/* Profile row */}
          <TouchableOpacity style={S.profileRow} onPress={onOpenProfile} activeOpacity={0.7}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={S.avatar} />
            ) : (
              <View style={[S.avatar, S.avatarFallback]}><Text style={S.avatarText}>{initial}</Text></View>
            )}
            <View style={S.profileText}>
              <Text style={S.profileName}>{profile.name}</Text>
              <Text style={S.profileSub}>Show profile</Text>
            </View>
            <Chevron />
          </TouchableOpacity>

          <View style={S.divider} />

          {/* Pro upsell card — the "promo" slot from the reference */}
          {!isPremium && (
            <TouchableOpacity style={S.promo} onPress={onManagePlan} activeOpacity={0.85}>
              <View style={S.promoText}>
                <Text style={S.promoTitle}>Go Pro</Text>
                <Text style={S.promoSub}>100 AI revamps a month and a bigger gear library.</Text>
              </View>
              <View style={S.promoBadge}><StarIcon /></View>
            </TouchableOpacity>
          )}

          {/* Settings section */}
          <Text style={S.section}>Settings</Text>
          <Row icon={<FeedbackIcon />} label="Community feedback" onPress={onCommunityFeedback} />
          <Row icon={<BellIcon />} label="Notifications" onPress={() => comingSoon('Notifications')} />
          <Row
            icon={<StarIcon />}
            label={isPremium ? 'Subscription · Pro' : 'Subscription'}
            onPress={onManagePlan}
          />

          {/* Account section */}
          <Text style={S.section}>Account</Text>
          <Row icon={<LogoutIcon color="#D1453B" />} label="Log out" onPress={confirmLogout} danger />
          <Row icon={<TrashIcon />} label="Delete account" onPress={confirmDelete} danger />

          {/* Legal section — required in-app (Apple Guideline 3.1.2) */}
          <Text style={S.section}>Legal</Text>
          <Row icon={<DocIcon />} label="Privacy Policy" onPress={() => openLegal(PRIVACY_POLICY_URL)} />
          <Row icon={<DocIcon />} label="Terms of Use" onPress={() => openLegal(TERMS_OF_USE_URL)} />

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const C = {
  bg: '#FFFFFF',
  ink: '#161616',
  sub: '#6E6E73',
  border: '#ECECEE',
  accent: '#3D6BB3',
};

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  scroll: { paddingBottom: 40 },

  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12 },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  backText: { color: C.ink, fontSize: 30, fontWeight: '300', lineHeight: 32 },
  title: { color: C.ink, fontSize: 30, fontWeight: '700', letterSpacing: -0.5, marginLeft: 2 },

  profileRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#EDEDF0' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E2A44' },
  avatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  profileText: { flex: 1, marginLeft: 14 },
  profileName: { color: C.ink, fontSize: 17, fontWeight: '700' },
  profileSub: { color: C.sub, fontSize: 13, marginTop: 2 },

  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 20, marginVertical: 6 },

  promo: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginTop: 14, marginBottom: 6,
    padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, backgroundColor: '#FAFAFB',
  },
  promoText: { flex: 1, paddingRight: 12 },
  promoTitle: { color: C.ink, fontSize: 16, fontWeight: '700' },
  promoSub: { color: C.sub, fontSize: 13, marginTop: 3, lineHeight: 18 },
  promoBadge: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center',
  },

  section: { color: C.ink, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 4 },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  rowIcon: { width: 30, alignItems: 'center' },
  rowLabel: { flex: 1, color: C.ink, fontSize: 15.5, fontWeight: '500', marginLeft: 10 },
  rowLabelDanger: { color: '#D1453B' },
});
