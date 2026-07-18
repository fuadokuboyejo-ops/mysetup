import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, SafeAreaView, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SetupPostScreen from './SetupPostScreen';
import CreatorProfileScreen from './CreatorProfileScreen';
import BoardPreview from '../components/BoardPreview';
import { getPosts, getSetups, getAllItems } from '../config/setup';

// `gradient` stands in for each user's real setup photo until posts carry an
// actual photo_path — same warm dusk-toned look as the reference mockup.
// The extra fields (handle, tags, setupsCount, followers, dots) back the
// post-detail view opened when a card is tapped.
const MOCK_SETUPS = [
  {
    id: '1', username: 'jordan', handle: '@jordan_r', initials: 'JR',
    title: "jordan's battlestation", tags: ['battlestation', 'minimal', 'mech'],
    description: 'walnut · minimal', likes: 412, comments: 38, trending: true,
    items: 6, setupsCount: 3, followers: '1.2k',
    gradient: ['#4A4368', '#8B5A56', '#C08552'],
    dots: [{ x: 52, y: 42 }, { x: 44, y: 62 }, { x: 68, y: 65 }, { x: 28, y: 72 }],
    slots: { monitor: true, keyboard: true, mouse: false, tower: true },
    extras: [
      { icon: '🎧', label: 'Headset' },
      { icon: '🔊', label: 'Speakers' },
      { icon: '🖱️', label: 'Mousepad' },
    ],
  },
  {
    id: '2', username: 'sookie', handle: '@sookie', initials: 'SK',
    title: "sookie's white setup", tags: ['white', 'gaming'],
    description: 'white · gaming', likes: 287, comments: 21, trending: false,
    items: 5, setupsCount: 1, followers: '640',
    gradient: ['#2E4B5E', '#4E7A8C', '#8FBFC7'],
    dots: [{ x: 50, y: 38 }, { x: 40, y: 68 }, { x: 62, y: 70 }],
    slots: { monitor: true, keyboard: true, mouse: true, tower: false },
    extras: [
      { icon: '🎙️', label: 'Mic' },
      { icon: '💡', label: 'Desk lamp' },
    ],
  },
  {
    id: '3', username: 'marcus', handle: '@marcus.codes', initials: 'MC',
    title: "marcus's productivity rig", tags: ['black', 'productivity', 'minimal'],
    description: 'black · productivity', likes: 534, comments: 61, trending: true,
    items: 7, setupsCount: 2, followers: '2.4k',
    gradient: ['#3A2E4B', '#6B4066', '#A85C6B'],
    dots: [{ x: 46, y: 40 }, { x: 36, y: 66 }, { x: 58, y: 68 }, { x: 70, y: 45 }],
    slots: { monitor: true, keyboard: false, mouse: true, tower: true },
    extras: [
      { icon: '🎧', label: 'Headset' },
      { icon: '🎙️', label: 'Mic' },
      { icon: '🔌', label: 'Dock' },
      { icon: '💡', label: 'Desk lamp' },
    ],
  },
  {
    id: '4', username: 'priya', handle: '@priya.setups', initials: 'PR',
    title: "priya's cozy corner", tags: ['pastel', 'cozy'],
    description: 'pastel · cozy', likes: 198, comments: 14, trending: false,
    items: 4, setupsCount: 1, followers: '310',
    gradient: ['#5B4B5E', '#9B6B72', '#D9A26B'],
    dots: [{ x: 48, y: 45 }, { x: 55, y: 70 }],
    slots: { monitor: false, keyboard: true, mouse: true, tower: false },
    extras: [
      { icon: '🪴', label: 'Plant' },
      { icon: '💡', label: 'Desk lamp' },
    ],
  },
];

// Public creator-profile data, keyed by username — opened by tapping a
// creator's avatar/handle from their post. `isPrivate` decides whether the
// viewer (not yet following) sees the setup grid or a locked placeholder.
const MOCK_CREATORS = {
  jordan: {
    username: 'jordan', initials: 'JR', isPrivate: false,
    setupsCount: 3, followers: '1.2k', following: 189,
    bioTitle: "jordan · battlestation builder",
    bioSubtitle: 'walnut + warm light · always tweaking. mech keebs & ultrawides.',
    setups: [
      { id: '1', name: 'main rig', likes: 412, gradient: ['#4A4368', '#8B5A56', '#C08552'] },
      { id: '1b', name: 'work corner', likes: 88, gradient: ['#3E5240', '#6B7A4E', '#8C935A'] },
      { id: '1c', name: 'old setup', likes: 203, gradient: ['#3A4152', '#4E5D6E', '#5E6B72'] },
    ],
  },
  sookie: {
    username: 'sookie', initials: 'SK', isPrivate: true,
    setupsCount: 2, followers: '540', following: 97,
    bioTitle: 'sookie',
    bioSubtitle: 'white & rgb · gaming setups',
    setups: [
      { id: '2', name: 'white setup', likes: 287, gradient: ['#2E4B5E', '#4E7A8C', '#8FBFC7'] },
    ],
  },
  marcus: {
    username: 'marcus', initials: 'MC', isPrivate: false,
    setupsCount: 2, followers: '2.4k', following: 240,
    bioTitle: 'marcus · productivity nerd',
    bioSubtitle: 'black and minimal · optimized for deep work.',
    setups: [
      { id: '3', name: 'productivity rig', likes: 534, gradient: ['#3A2E4B', '#6B4066', '#A85C6B'] },
      { id: '3b', name: 'home office', likes: 121, gradient: ['#2E3A4B', '#4E637A', '#7A93A8'] },
    ],
  },
  priya: {
    username: 'priya', initials: 'PR', isPrivate: false,
    setupsCount: 1, followers: '310', following: 158,
    bioTitle: 'priya · cozy corner curator',
    bioSubtitle: 'pastel tones · plants · soft lighting only.',
    setups: [
      { id: '4', name: 'cozy corner', likes: 198, gradient: ['#5B4B5E', '#9B6B72', '#D9A26B'] },
    ],
  },
};

const TABS = ['Trending', 'Following', 'New'];

function Avatar({ initials }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

export function MiniBoard({ slots }) {
  const SlotBox = ({ wide, tall, filled }) => (
    <View style={[
      styles.miniSlot,
      wide && styles.miniSlotWide,
      tall && styles.miniSlotTall,
      filled && styles.miniSlotFilled,
    ]} />
  );

  return (
    <View style={styles.miniBoard}>
      {/* Monitor row */}
      <View style={styles.miniMonitorRow}>
        <SlotBox wide filled={slots.monitor} />
      </View>
      {/* Bottom row */}
      <View style={styles.miniBottomRow}>
        <SlotBox filled={slots.keyboard} />
        <SlotBox tall filled={slots.mouse} />
        <SlotBox filled={slots.tower} />
      </View>
    </View>
  );
}

function SetupCard({ setup, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* User row */}
      <View style={styles.cardHeader}>
        <Avatar initials={setup.initials} />
        <Text style={styles.cardUsername}>{setup.username}</Text>
      </View>

      {/* Real photo — the beauty shot (falls back to a gradient placeholder) */}
      <View style={styles.photoWrap}>
        {setup.photo ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${setup.photo}` }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <LinearGradient colors={setup.gradient} style={StyleSheet.absoluteFill} />
        )}
      </View>

      {/* Interactive board — the real arranged board for user posts, or the
          placeholder mini-board for the mock/sample feed. */}
      <View style={styles.boardPanel}>
        <Text style={styles.boardPanelLabel}>interactive board</Text>
        {setup.boardSetup ? (
          <BoardPreview setup={setup.boardSetup} items={setup.boardItems} />
        ) : (
          <MiniBoard slots={setup.slots} />
        )}
        <View style={styles.tapBadge}>
          <Text style={styles.tapBadgeText}>tap to explore</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.cardFooter}>
        <View style={styles.footerLeft}>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statIcon}>♡</Text>
            <Text style={styles.statText}>{setup.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem}>
            <Text style={styles.statIcon}>⌁</Text>
            <Text style={styles.statText}>{setup.comments}</Text>
          </TouchableOpacity>
        </View>
        {setup.trending && (
          <View style={styles.trendingBadge}>
            <Text style={styles.trendingIcon}>↑</Text>
            <Text style={styles.trendingText}>trending</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Grid tiles on a creator profile only carry {id, name, likes, gradient}. If
// the tapped tile matches a real feed post, reuse that full post object;
// otherwise fill in reasonable defaults so SetupPostScreen has what it needs.
function postFromCreatorSetup(creator, setupEntry) {
  const existing = MOCK_SETUPS.find(s => s.id === setupEntry.id);
  if (existing) return existing;
  return {
    id: setupEntry.id,
    username: creator.username,
    handle: `@${creator.username}`,
    initials: creator.initials,
    title: setupEntry.name,
    tags: [],
    likes: setupEntry.likes,
    items: 0,
    setupsCount: creator.setupsCount,
    followers: creator.followers,
    gradient: setupEntry.gradient,
    dots: [],
    slots: { monitor: false, keyboard: false, mouse: false, tower: false },
    extras: [],
  };
}

// A user's own posts have no MOCK_CREATORS entry, so build a minimal creator
// object from the post itself for the profile view opened from a feed card.
function creatorFromPost(post) {
  return {
    username: post.username, initials: post.initials, isPrivate: false,
    setupsCount: post.setupsCount || 1, followers: post.followers || '0', following: 0,
    bioTitle: post.title, bioSubtitle: post.description || '',
    setups: [{ id: post.id, name: post.title, likes: post.likes || 0, gradient: post.gradient }],
  };
}

export default function HomeScreen({ onStartScan, onViewSetup, onRevamp }) {
  const [activeTab, setActiveTab] = useState('Trending');
  const [openedPost, setOpenedPost] = useState(null);
  const [viewedCreator, setViewedCreator] = useState(null);
  const [userPosts, setUserPosts] = useState([]);

  // Load the user's published posts and hydrate each with its setup photo
  // (kept out of the stored post to stay under AsyncStorage's row cap). Runs on
  // mount — HomeScreen remounts whenever you navigate back to it, so a setup
  // posted elsewhere shows up as soon as you return to the feed.
  useEffect(() => {
    (async () => {
      const [posts, setups, allItems] = await Promise.all([getPosts(), getSetups(), getAllItems()]);
      const hydrated = posts.map(p => {
        const setup = setups.find(s => s.id === p.setupId);
        return {
          ...p,
          photo: setup?.photo,
          // Live tags from the setup (not the post-time snapshot) so re-tagging
          // the setup updates the post too, and both views stay in sync.
          dots: setup?.dots ?? p.dots,
          // The real arranged board + the gear library, so the feed card can
          // render the actual board the user posted (not the placeholder grid).
          boardSetup: setup,
          boardItems: allItems,
        };
      });
      setUserPosts(hydrated);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>my setup</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.headerIcon}>
              <Text style={styles.headerIconText}>⌕</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon}>
              <Text style={styles.headerIconText}>♔</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Feed */}
        <ScrollView
          contentContainerStyle={styles.feed}
          showsVerticalScrollIndicator={false}
        >
          {[...userPosts, ...MOCK_SETUPS].map(setup => (
            <SetupCard key={setup.id} setup={setup} onPress={() => setOpenedPost(setup)} />
          ))}
        </ScrollView>

      </SafeAreaView>

      {/* Post view + creator profile share ONE Modal and swap content — RN's
          Modal is a single native presentation, so two sibling Modals both
          visible at once (post open underneath, creator opened on top of it)
          don't stack reliably; the second one fails to present correctly. */}
      <Modal
        visible={!!openedPost || !!viewedCreator}
        animationType="slide"
        onRequestClose={() => (viewedCreator ? setViewedCreator(null) : setOpenedPost(null))}
      >
        <SafeAreaProvider>
          {viewedCreator ? (
            <CreatorProfileScreen
              creator={viewedCreator}
              onBack={() => setViewedCreator(null)}
              onOpenSetup={(setupEntry) => {
                setViewedCreator(null);
                setOpenedPost(postFromCreatorSetup(viewedCreator, setupEntry));
              }}
            />
          ) : openedPost ? (
            <SetupPostScreen
              post={openedPost}
              onBack={() => setOpenedPost(null)}
              onOpenCreator={() => setViewedCreator(MOCK_CREATORS[openedPost.username] || creatorFromPost(openedPost))}
            />
          ) : null}
        </SafeAreaProvider>
      </Modal>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={[styles.navIcon, styles.navIconActive]}>⌂</Text>
          <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>⌕</Text>
          <Text style={styles.navLabel}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navScanBtn} onPress={onStartScan}>
          <Text style={styles.navScanIcon}>⊕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={onRevamp}>
          <Text style={styles.navIcon}>✨</Text>
          <Text style={styles.navLabel}>Revamp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={onViewSetup}>
          <Text style={styles.navIcon}>⊙</Text>
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const C = {
  bg:     '#FAFAF8',
  card:   '#FFFFFF',
  slot:   '#FFFFFF',
  filled: '#F3F1EC',
  border: '#E0E0E0',
  text:   '#161616',
  sub:    '#8A8792',
  accent: '#161616',
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safeArea: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  logo: { color: C.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  headerIcons: { flexDirection: 'row', gap: 8 },
  headerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconText: { color: C.sub, fontSize: 17 },

  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 14 },
  tab: {
    paddingVertical: 7, paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border,
  },
  tabActive: { backgroundColor: C.accent, borderColor: C.accent },
  tabText: { color: C.sub, fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '700' },

  feed: { paddingHorizontal: 14, gap: 12, paddingBottom: 100 },

  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#2a4a7a',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cardUsername: { color: C.text, fontSize: 17, fontWeight: '700' },

  // Real photo hero — the beauty shot.
  photoWrap: {
    marginHorizontal: 14,
    marginBottom: 12,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },

  // Interactive board panel
  boardPanel: {
    marginHorizontal: 14,
    marginBottom: 8,
    backgroundColor: '#F0EFEA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 12,
    position: 'relative',
  },
  boardPanelLabel: { color: C.sub, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  tapBadge: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  tapBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },

  // Mini board
  miniBoard: {
    gap: 8,
    position: 'relative',
  },
  miniMonitorRow: { alignItems: 'center' },
  miniBottomRow: { flexDirection: 'row', gap: 7 },
  miniSlot: {
    flex: 1, height: 38,
    backgroundColor: C.slot,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D9D6CE',
    borderStyle: 'dashed',
  },
  miniSlotWide: { width: '60%', flex: 0 },
  miniSlotTall: { height: 52 },
  miniSlotFilled: { backgroundColor: C.filled, borderStyle: 'solid', borderColor: C.border },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  footerLeft: { flexDirection: 'row', gap: 16 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statIcon: { color: C.sub, fontSize: 15 },
  statText: { color: C.sub, fontSize: 13 },
  trendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendingIcon: { color: C.sub, fontSize: 13 },
  trendingText: { color: C.sub, fontSize: 13 },

  // Bottom nav
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingBottom: 28,
    paddingTop: 10,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: { alignItems: 'center', justifyContent: 'center', width: 48, height: 36 },
  navIcon: { color: C.sub, fontSize: 20 },
  navIconActive: { color: C.accent },
  navLabel: { color: C.sub, fontSize: 9, marginTop: 2 },
  navLabelActive: { color: C.accent },
  navScanBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  navScanIcon: { color: '#FFFFFF', fontSize: 26, fontWeight: '300' },
});
