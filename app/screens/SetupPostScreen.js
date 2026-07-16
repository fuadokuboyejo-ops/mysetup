import { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MiniBoard } from './HomeScreen';

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

// A single tagged dot on the hero photo — same ring treatment as SetupScreen's
// scan dots, sized down for a read-only view (no drag, no remove button).
function PhotoDot({ x, y }) {
  return (
    <View style={[styles.dot, { left: `${x}%`, top: `${y}%` }]} pointerEvents="none">
      <View style={styles.dotGlow}>
        <View style={styles.dotInner} />
      </View>
    </View>
  );
}

// Read-only public view of someone else's setup post — opened from the Home
// feed. Distinct from SetupScreen (which edits your own board): this one is
// about following, liking, and exploring someone else's gear, not arranging.
// Sections stagger in on mount: creator row, title+tags, photo, the board, extras.
const SECTION_COUNT = 5;

export default function SetupPostScreen({ post, onBack, onOpenCreator }) {
  const [tagsOn, setTagsOn] = useState(true);
  const sectionOpacity = useRef([...Array(SECTION_COUNT)].map(() => new Animated.Value(0))).current;
  const sectionTranslate = useRef([...Array(SECTION_COUNT)].map(() => new Animated.Value(22))).current;

  useEffect(() => {
    Animated.stagger(90, sectionOpacity.map((opacity, i) => Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(sectionTranslate[i], { toValue: 0, friction: 8, useNativeDriver: true }),
    ]))).start();
  }, []);

  const sectionStyle = i => ({ opacity: sectionOpacity[i], transform: [{ translateY: sectionTranslate[i] }] });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.headerBtnText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{post.title}</Text>
            <Text style={styles.headerSub}>{post.items} items · {post.likes} likes</Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.headerBtnText}>•••</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          {/* Creator row — tap the avatar/handle to view their full profile */}
          <Animated.View style={[styles.creatorRow, sectionStyle(0)]}>
            <TouchableOpacity style={styles.creatorTap} onPress={onOpenCreator} activeOpacity={0.75}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{post.initials}</Text></View>
              <View style={styles.creatorInfo}>
                <View style={styles.creatorNameRow}>
                  <Text style={styles.creatorHandle}>{post.handle}</Text>
                  <Text style={styles.creatorBadge}>✦ creator</Text>
                </View>
                <Text style={styles.creatorSub}>{post.setupsCount} setups · {post.followers} followers</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.followBtn} activeOpacity={0.85}>
              <Text style={styles.followBtnText}>Follow</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={sectionStyle(1)}>
            <Text style={styles.title}>{post.title}</Text>

            {/* Tags */}
            <View style={styles.tagRow}>
              {post.tags.map(tag => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={styles.tagPillText}>{tag}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Hero photo with tagged dots */}
          <Animated.View style={[styles.photoWrap, sectionStyle(2)]}>
            <LinearGradient colors={post.gradient} style={StyleSheet.absoluteFill} />
            {tagsOn && post.dots.map((d, i) => <PhotoDot key={i} x={d.x} y={d.y} />)}
            <TouchableOpacity style={styles.tagsToggle} onPress={() => setTagsOn(v => !v)} activeOpacity={0.85}>
              <Text style={styles.tagsToggleIcon}>{tagsOn ? '◉' : '◯'}</Text>
              <Text style={styles.tagsToggleText}>tags {tagsOn ? 'on' : 'off'}</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={sectionStyle(3)}>
            {/* Section divider */}
            <View style={styles.sectionDivider}>
              <View style={styles.sectionDividerLine} />
              <Text style={styles.sectionDividerText}>THE BOARD</Text>
              <View style={styles.sectionDividerLine} />
            </View>

            {/* The board — same interactive board treatment as the feed card */}
            <View style={styles.boardPanel}>
              <MiniBoard slots={post.slots} />
            </View>
          </Animated.View>

          {/* Extra peripherals — the gear that doesn't fit on the board itself */}
          {post.extras?.length > 0 && (
            <Animated.View style={[styles.extrasSection, sectionStyle(4)]}>
              <View style={styles.extrasHeader}>
                <Text style={styles.extrasTitle}>Extras</Text>
                <Text style={styles.extrasSubtitle}> · peripherals & accessories</Text>
              </View>
              <View style={styles.extrasCards}>
                {post.extras.map((extra, i) => (
                  <View key={i} style={[styles.extraRow, i > 0 && styles.extraRowBorder]}>
                    <Text style={styles.extraRowIcon}>{extra.icon}</Text>
                    <Text style={styles.extraRowText}>{extra.label}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const C = {
  bg: '#FAFAF8', card: '#FFFFFF', border: '#E5E3DC', text: '#161616', sub: '#8A8792',
  tagBg: '#EAF0FB', tagText: '#3B6FD6', accent: '#161616',
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
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  headerSub: { color: C.sub, fontSize: 12.5, marginTop: 1 },

  body: { paddingBottom: 40 },

  creatorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  creatorTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#4E6FA8', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  creatorInfo: { flex: 1, gap: 2 },
  creatorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  creatorHandle: { color: C.text, fontSize: 16, fontWeight: '700' },
  creatorBadge: { color: '#3B6FD6', fontSize: 13, fontWeight: '600' },
  creatorSub: { color: C.sub, fontSize: 13 },
  followBtn: { backgroundColor: C.accent, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 20 },
  followBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  title: {
    fontFamily: serif, color: C.text, fontSize: 30, fontWeight: '700',
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 14,
  },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 18 },
  tagPill: { backgroundColor: C.tagBg, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14 },
  tagPillText: { color: C.tagText, fontSize: 13.5, fontWeight: '600' },

  photoWrap: {
    marginHorizontal: 20, height: 320, borderRadius: 18, overflow: 'hidden', position: 'relative',
  },
  tagsToggle: {
    position: 'absolute', top: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#3B6FD6', borderRadius: 18,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  tagsToggleIcon: { color: '#FFFFFF', fontSize: 12 },
  tagsToggleText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  dot: { position: 'absolute', marginLeft: -13, marginTop: -13 },
  dotGlow: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  dotInner: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF' },

  sectionDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginTop: 28, marginBottom: 16 },
  sectionDividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  sectionDividerText: { color: C.sub, fontSize: 12, fontWeight: '700', letterSpacing: 2 },

  boardPanel: {
    marginHorizontal: 20,
    backgroundColor: '#F0EFEA', borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    padding: 14,
  },

  extrasSection: { marginTop: 22, paddingHorizontal: 20 },
  extrasHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  extrasTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  extrasSubtitle: { color: C.sub, fontSize: 13 },
  extrasCards: { backgroundColor: '#F4F4F4', borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  extraRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  extraRowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  extraRowIcon: { fontSize: 20, width: 72, textAlign: 'center' },
  extraRowText: { color: C.text, fontSize: 15, fontWeight: '600' },
});
