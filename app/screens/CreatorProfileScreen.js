import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

// Public profile of another user — opened by tapping a creator's avatar/handle
// from one of their posts. Private accounts (isPrivate, and the viewer isn't
// already following) show a locked placeholder instead of the setup grid;
// the header, avatar, stats, and bio stay visible either way.
export default function CreatorProfileScreen({ creator, onBack, onOpenSetup }) {
  const locked = creator.isPrivate;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.headerBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{creator.username}</Text>
          <TouchableOpacity style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.headerBtnText}>•••</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          {/* Avatar + stats */}
          <View style={styles.statsRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{creator.initials}</Text></View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{creator.setupsCount}</Text>
              <Text style={styles.statLabel}>setups</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{creator.followers}</Text>
              <Text style={styles.statLabel}>followers</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{creator.following}</Text>
              <Text style={styles.statLabel}>following</Text>
            </View>
          </View>

          {/* Bio */}
          <View style={styles.bio}>
            <Text style={styles.bioTitle}>{creator.bioTitle}</Text>
            <Text style={styles.bioSubtitle}>{creator.bioSubtitle}</Text>
          </View>

          {locked ? (
            <>
              <TouchableOpacity style={styles.requestBtn} activeOpacity={0.85}>
                <Text style={styles.requestBtnIcon}>🔒</Text>
                <Text style={styles.requestBtnText}>Request to follow</Text>
              </TouchableOpacity>

              <View style={styles.lockedCard}>
                <Text style={styles.lockedIcon}>🔒</Text>
                <Text style={styles.lockedTitle}>this profile is private</Text>
                <Text style={styles.lockedSubtitle}>follow to see {creator.username}'s setups</Text>
              </View>
            </>
          ) : (
            <>
              {/* Follow / Message */}
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.followBtn} activeOpacity={0.85}>
                  <Text style={styles.followBtnText}>Follow</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.messageBtn} activeOpacity={0.85}>
                  <Text style={styles.messageBtnText}>Message</Text>
                </TouchableOpacity>
              </View>

              {/* Setup grid */}
              <View style={styles.grid}>
                {creator.setups.map(setup => (
                  <TouchableOpacity
                    key={setup.id}
                    style={styles.tile}
                    onPress={() => onOpenSetup(setup)}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={setup.gradient} style={styles.tilePhoto} />
                    <View style={styles.tileFooter}>
                      <Text style={styles.tileName} numberOfLines={1}>{setup.name}</Text>
                      <View style={styles.tileLikes}>
                        <Text style={styles.tileLikesIcon}>♡</Text>
                        <Text style={styles.tileLikesText}>{setup.likes}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.footerHint}>tap a setup → its explore view (photo/board)</Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const C = {
  bg: '#FAFAF8', card: '#FFFFFF', border: '#E5E3DC', text: '#161616', sub: '#8A8792', accent: '#161616',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F2ED', alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { color: C.text, fontSize: 18, fontWeight: '600' },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '700' },

  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 24, marginBottom: 18 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#4E6FA8', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  stat: { alignItems: 'center', gap: 2 },
  statNum: { color: C.text, fontSize: 19, fontWeight: '700' },
  statLabel: { color: C.sub, fontSize: 12.5 },

  bio: { alignItems: 'center', gap: 4, marginBottom: 20 },
  bioTitle: { color: C.text, fontSize: 15.5, fontWeight: '700', textAlign: 'center' },
  bioSubtitle: { color: C.sub, fontSize: 13.5, textAlign: 'center', lineHeight: 19 },

  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  followBtn: { flex: 1, backgroundColor: C.accent, borderRadius: 22, paddingVertical: 12, alignItems: 'center' },
  followBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  messageBtn: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: C.accent, borderRadius: 22, paddingVertical: 12, alignItems: 'center' },
  messageBtnText: { color: C.text, fontSize: 15, fontWeight: '700' },

  requestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: C.accent,
    borderRadius: 22, paddingVertical: 13, marginBottom: 20,
  },
  requestBtnIcon: { fontSize: 14 },
  requestBtnText: { color: C.text, fontSize: 15, fontWeight: '700' },

  lockedCard: {
    backgroundColor: '#F4F4F4', borderRadius: 18, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', paddingVertical: 44, paddingHorizontal: 20, gap: 8,
  },
  lockedIcon: { fontSize: 30, marginBottom: 4 },
  lockedTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  lockedSubtitle: { color: C.sub, fontSize: 13.5, textAlign: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  tile: {
    width: '47%', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  tilePhoto: { width: '100%', aspectRatio: 1 },
  tileFooter: { padding: 10, gap: 3 },
  tileName: { color: C.text, fontSize: 14, fontWeight: '700' },
  tileLikes: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileLikesIcon: { color: C.sub, fontSize: 12 },
  tileLikesText: { color: C.sub, fontSize: 12 },

  footerHint: { color: C.sub, fontSize: 12.5, textAlign: 'center' },
});
