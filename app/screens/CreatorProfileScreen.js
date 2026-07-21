import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { imageUri } from '../config/media';

const TABS = ['Setups', 'Items'];

// Public profile of another user — opened by tapping a creator's avatar/handle
// from a post or search. Mirrors the signed-in user's profile view: hero banner
// with the profile picture top-right, centered identity, pill actions, then
// Setups / Items tabs. Private accounts show a locked placeholder instead of the
// grids; the banner and identity stay visible either way.
export default function CreatorProfileScreen({ creator, onBack, onOpenSetup }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('Setups');
  const locked = creator.isPrivate;
  const items = creator.items || [];
  // Banner backdrop: a real setup photo if they have one, else a setup gradient,
  // else a flat dark fill.
  const bannerPhoto = creator.setups?.find(s => s.photo)?.photo || null;
  const bannerGradient = !bannerPhoto ? (creator.setups?.find(s => s.gradient)?.gradient || null) : null;
  const avatarUrl = creator.avatarUrl || creator.avatar || null;

  return (
    <View style={S.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Banner hero */}
      <View style={S.banner}>
        {bannerPhoto ? (
          <Image source={{ uri: imageUri(bannerPhoto) }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : bannerGradient ? (
          <LinearGradient colors={bannerGradient} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, S.bannerPlaceholder]} />
        )}
        <View style={[StyleSheet.absoluteFill, S.bannerScrim]} />

        {/* Back + profile picture (top-right) */}
        <View style={[S.bannerTop, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onBack} style={S.bannerBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={S.bannerBackText}>‹</Text>
          </TouchableOpacity>
          <View style={S.bannerAvatarButton}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={S.bannerAvatar} contentFit="cover" />
            ) : (
              <View style={[S.bannerAvatar, S.bannerAvatarFallback]}>
                <Text style={S.bannerAvatarText}>{creator.initials}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Identity */}
        <View style={S.bannerBody}>
          <Text style={S.bannerName}>{creator.username}</Text>
          <View style={S.bannerStats}>
            <Text style={S.bannerStat}><Text style={S.bannerStatNum}>{creator.setupsCount}</Text> setups</Text>
            <Text style={S.bannerDot}>·</Text>
            <Text style={S.bannerStat}><Text style={S.bannerStatNum}>{creator.followers}</Text> followers</Text>
            <Text style={S.bannerDot}>·</Text>
            <Text style={S.bannerStat}><Text style={S.bannerStatNum}>{creator.following}</Text> following</Text>
          </View>
          <View style={S.bannerBtns}>
            <TouchableOpacity style={S.bannerBtn} activeOpacity={0.85}>
              <Text style={S.bannerBtnText}>{locked ? 'Request' : 'Follow'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.bannerBtn} activeOpacity={0.85}>
              <Text style={S.bannerBtnText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={S.tabBar}>
        {TABS.map(tab => {
          const active = activeTab === tab;
          return (
            <TouchableOpacity key={tab} style={S.tab} onPress={() => setActiveTab(tab)} activeOpacity={0.8}>
              <Text style={[S.tabText, active && S.tabTextActive]}>{tab}</Text>
              {active && <View style={S.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {locked ? (
        <View style={S.lockedWrap}>
          <View style={S.lockedCard}>
            <Text style={S.lockedIcon}>🔒</Text>
            <Text style={S.lockedTitle}>this profile is private</Text>
            <Text style={S.lockedSubtitle}>follow to see {creator.username}'s {activeTab.toLowerCase()}</Text>
          </View>
        </View>
      ) : activeTab === 'Setups' ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.body}>
          {(creator.bioTitle || creator.bioSubtitle) && (
            <View style={S.bio}>
              {!!creator.bioTitle && <Text style={S.bioTitle}>{creator.bioTitle}</Text>}
              {!!creator.bioSubtitle && <Text style={S.bioSubtitle}>{creator.bioSubtitle}</Text>}
            </View>
          )}
          <View style={S.grid}>
            {creator.setups.map(setup => (
              <TouchableOpacity
                key={setup.id}
                style={S.tile}
                onPress={() => onOpenSetup(setup)}
                activeOpacity={0.85}
              >
                {setup.photo ? (
                  <Image source={{ uri: imageUri(setup.photo) }} style={S.tilePhoto} contentFit="cover" />
                ) : setup.gradient ? (
                  <LinearGradient colors={setup.gradient} style={S.tilePhoto} />
                ) : (
                  <View style={[S.tilePhoto, S.tilePhotoEmpty]}>
                    <Text style={S.tilePhotoEmptyText}>No photo</Text>
                  </View>
                )}
                <View style={S.tileFooter}>
                  <Text style={S.tileName} numberOfLines={1}>{setup.name}</Text>
                  <View style={S.tileLikes}>
                    <Text style={S.tileLikesIcon}>♡</Text>
                    <Text style={S.tileLikesText}>{setup.likes}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : items.length === 0 ? (
        <View style={S.emptyWrap}>
          <Text style={S.emptyTitle}>No public items</Text>
          <Text style={S.emptySubtitle}>{creator.username} hasn’t shared any gear yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={S.itemListWrap} showsVerticalScrollIndicator={false}>
          {items.map((item, i) => (
            <View key={item.id} style={[S.itemRow, i > 0 && S.itemRowDivider]}>
              <View style={S.itemThumb}>
                {item.photoBase64 ? (
                  <Image source={{ uri: imageUri(item.photoBase64, 'image/png') }} style={S.itemThumbImg} contentFit="contain" />
                ) : item.gradient ? (
                  <LinearGradient colors={item.gradient} style={StyleSheet.absoluteFill} />
                ) : (
                  <Text style={S.itemThumbEmpty}>—</Text>
                )}
              </View>
              <View style={S.itemInfo}>
                <Text style={S.itemName} numberOfLines={1}>{item.product?.product_name || 'Unnamed'}</Text>
                <Text style={S.itemCat} numberOfLines={1}>{item.product?.category || 'gear'}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const C = {
  bg: '#FAFAF8', card: '#FFFFFF', border: '#E5E3DC', text: '#161616', sub: '#8A8792', accent: '#161616',
};

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // ── Banner hero (mirrors ProfileScreen) ──────────────────────────────────
  banner: { width: '100%', minHeight: 300, justifyContent: 'space-between', overflow: 'hidden' },
  bannerPlaceholder: { backgroundColor: '#2A2A2E' },
  bannerScrim: { backgroundColor: 'rgba(0,0,0,0.32)' },
  bannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  bannerBack: { width: 30, alignItems: 'center', justifyContent: 'center' },
  bannerBackText: { color: '#FFFFFF', fontSize: 30, fontWeight: '300' },
  bannerAvatarButton: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'transparent', overflow: 'hidden' },
  bannerAvatar: { width: '100%', height: '100%', borderRadius: 27 },
  bannerAvatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#4E6FA8' },
  bannerAvatarText: { color: '#FFFFFF', fontSize: 21, fontWeight: '800' },
  bannerBody: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 22, gap: 10 },
  bannerName: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  bannerStats: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerStat: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '500' },
  bannerStatNum: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  bannerDot: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  bannerBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  bannerBtn: { backgroundColor: 'rgba(60,60,64,0.78)', borderRadius: 22, paddingVertical: 11, paddingHorizontal: 26 },
  bannerBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // ── Tabs ─────────────────────────────────────────────────────────────────
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg },
  tab: { flex: 1, alignItems: 'center', paddingTop: 14, paddingBottom: 12 },
  tabText: { color: C.sub, fontSize: 15, fontWeight: '600' },
  tabTextActive: { color: C.text, fontWeight: '800' },
  tabUnderline: { position: 'absolute', bottom: -1, height: 2.5, width: '55%', borderRadius: 2, backgroundColor: C.text },

  body: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },

  bio: { alignItems: 'center', gap: 4, marginBottom: 18 },
  bioTitle: { color: C.text, fontSize: 15.5, fontWeight: '700', textAlign: 'center' },
  bioSubtitle: { color: C.sub, fontSize: 13.5, textAlign: 'center', lineHeight: 19 },

  // Setups grid (photo/gradient tiles)
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47%', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  tilePhoto: { width: '100%', aspectRatio: 1 },
  tilePhotoEmpty: { backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center' },
  tilePhotoEmptyText: { color: C.sub, fontSize: 11 },
  tileFooter: { padding: 10, gap: 3 },
  tileName: { color: C.text, fontSize: 14, fontWeight: '700' },
  tileLikes: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileLikesIcon: { color: C.sub, fontSize: 12 },
  tileLikesText: { color: C.sub, fontSize: 12 },

  // Items list (row layout — thumbnail · name/category)
  itemListWrap: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 60 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  itemRowDivider: { borderTopWidth: 1, borderTopColor: C.border },
  itemThumb: {
    width: 56, height: 56, borderRadius: 12, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  itemThumbImg: { width: 44, height: 44 },
  itemThumbEmpty: { color: C.sub, fontSize: 16 },
  itemInfo: { flex: 1, minWidth: 0, gap: 2 },
  itemName: { color: C.text, fontSize: 15, fontWeight: '700' },
  itemCat: { color: C.sub, fontSize: 13 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  emptySubtitle: { color: C.sub, fontSize: 13, marginTop: 6, textAlign: 'center' },

  lockedWrap: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  lockedCard: {
    backgroundColor: '#F4F4F4', borderRadius: 18, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', paddingVertical: 44, paddingHorizontal: 20, gap: 8,
  },
  lockedIcon: { fontSize: 30, marginBottom: 4 },
  lockedTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  lockedSubtitle: { color: C.sub, fontSize: 13.5, textAlign: 'center' },
});
