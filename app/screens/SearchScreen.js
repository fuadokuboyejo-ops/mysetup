import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
  ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Circle, Line } from 'react-native-svg';
import { getPublicItems, getPosts, getSetups } from '../config/setup';
import BoardPreview from '../components/BoardPreview';
import SetupPostScreen from './SetupPostScreen';
import CreatorProfileScreen from './CreatorProfileScreen';
import ProductDetailScreen from './ProductDetailScreen';
import { imageUri } from '../config/media';

const C = {
  bg: '#FFFFFF', panel: '#F5F5F7', border: '#ECECEE',
  ink: '#0E0E10', sub: '#8A8A92', sub2: '#4A4A52', link: '#3D6BB3',
};

function SearchIcon({ size = 18, color = C.sub }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="8" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  );
}

function SectionHeader({ title, link }) {
  return (
    <View style={s.sec}>
      <Text style={s.secTitle}>{title}</Text>
      {!!link && <Text style={s.secLink}>{link}</Text>}
    </View>
  );
}

function buildCreators(posts) {
  const creators = new Map();
  for (const post of posts) {
    const key = post.username || post.handle || 'you';
    const existing = creators.get(key) || {
      id: key,
      username: post.username || 'you',
      name: post.handle || `@${post.username || 'you'}`,
      initials: post.initials || 'ME',
      followers: post.followers || '0',
      posts: [],
      tags: new Set(),
    };
    existing.posts.push(post);
    for (const tag of post.tags || []) existing.tags.add(tag);
    creators.set(key, existing);
  }
  return [...creators.values()].map(creator => ({
    ...creator,
    tags: [...creator.tags],
    meta: `${creator.posts.length} ${creator.posts.length === 1 ? 'setup' : 'setups'} · ${creator.followers} followers`,
  }));
}

function buildTags(posts) {
  const counts = new Map();
  for (const post of posts) {
    for (const rawTag of post.tags || []) {
      const tag = rawTag.trim().replace(/^#/, '');
      if (tag) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function CreatorRow({ creator, onOpen }) {
  const [following, setFollowing] = useState(false);
  return (
    <TouchableOpacity style={s.creator} onPress={onOpen} activeOpacity={0.85}>
      <View style={s.avatar}><Text style={s.avatarText}>{creator.initials}</Text></View>
      <View style={s.creatorInfo}>
        <View style={s.creatorNameRow}>
          <Text style={s.creatorName}>{creator.name}</Text>
          <Text style={s.creatorBadge}>✦</Text>
        </View>
        <Text style={s.creatorMeta} numberOfLines={1}>{creator.meta}</Text>
      </View>
      <TouchableOpacity
        style={[s.followBtn, following && s.followBtnOn]}
        onPress={event => { event.stopPropagation?.(); setFollowing(value => !value); }}
        activeOpacity={0.85}
      >
        <Text style={[s.followText, following && s.followTextOn]}>{following ? 'Following' : 'Follow'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function SearchScreen({ onClose }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [posts, setPosts] = useState([]);
  const [gear, setGear] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openedPost, setOpenedPost] = useState(null);
  const [openedCreator, setOpenedCreator] = useState(null);
  const [openedItem, setOpenedItem] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [storedPosts, setups, items] = await Promise.all([getPosts(), getSetups(), getPublicItems()]);
        const hydratedPosts = storedPosts.map(post => {
          const setup = setups.find(candidate => candidate.id === post.setupId) || post.boardSetup;
          return {
            ...post,
            tags: post.tags || [],
            photo: setup?.photo || post.photo || null,
            extraPhotos: setup?.extraPhotos || post.extraPhotos || [],
            dots: setup?.dots || post.dots || [],
            boardSetup: setup || null,
            boardItems: post.boardItems?.length ? post.boardItems : items,
          };
        });

        // Search only surfaces PUBLIC gear. An item counts as public when the
        // user has explicitly marked it public (item.isPublic), OR it's placed on
        // the board of a setup they've published. Everything else stays private.
        const publishedSetupIds = new Set(storedPosts.map(post => post.setupId).filter(Boolean));
        const publicItemIds = new Set();
        for (const setup of setups) {
          if (!publishedSetupIds.has(setup.id)) continue;
          for (const itemId of Object.values(setup.slots || {})) {
            if (itemId) publicItemIds.add(itemId);
          }
        }
        const publicItems = items.filter(item => item.isPublic || publicItemIds.has(item.id));

        if (active) {
          setPosts(hydratedPosts);
          setGear(publicItems);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const creators = useMemo(() => buildCreators(posts), [posts]);
  const tags = useMemo(() => buildTags(posts), [posts]);
  const normalizedQuery = query.trim().replace(/^#/, '').toLowerCase();
  const matches = (...values) => !normalizedQuery
    || values.some(value => String(value || '').toLowerCase().includes(normalizedQuery));

  const setupResults = posts.filter(post => matches(
    post.title, post.username, post.handle, post.caption, post.description, ...(post.tags || []),
  ));
  const gearResults = gear.filter(item => matches(
    item.product?.product_name, item.product?.brand, item.product?.category,
  ));
  const creatorResults = creators.filter(creator => matches(
    creator.name, creator.username, creator.meta, ...creator.tags,
  ));
  const tagResults = tags.filter(tag => matches(tag.name));

  const showSetups = filter === 'All' || filter === 'Setups';
  const showGear = filter === 'All' || filter === 'Gear';
  const showPeople = filter === 'All' || filter === 'People';
  const showTags = filter === 'All' || filter === 'Tags';
  const hasResults = (showSetups && setupResults.length > 0)
    || (showGear && gearResults.length > 0)
    || (showPeople && creatorResults.length > 0)
    || (showTags && tagResults.length > 0);
  const filters = [
    { label: 'All' },
    { label: 'Setups', count: posts.length },
    { label: 'Gear', count: gear.length },
    { label: 'People', count: creators.length },
    { label: 'Tags', count: tags.length },
  ];

  const creatorProfile = openedCreator ? {
    username: openedCreator.username,
    initials: openedCreator.initials,
    isPrivate: false,
    setupsCount: openedCreator.posts.length,
    followers: openedCreator.followers,
    following: 0,
    bioTitle: openedCreator.name,
    bioSubtitle: openedCreator.tags.map(tag => `#${tag}`).join(' · ') || 'setup creator',
    setups: openedCreator.posts.map(post => ({
      id: post.id,
      name: post.title,
      likes: post.likes || 0,
      photo: post.photo,
      post,
    })),
  } : null;

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <View style={s.searchRow}>
            <View style={[s.searchBar, query.length > 0 && s.searchBarActive]}>
              <SearchIcon />
              <TextInput
                style={s.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="search setups, gear, people…"
                placeholderTextColor="#A0A0A8"
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={s.clear}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Text style={s.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
            {filters.map(item => {
              const selected = filter === item.label;
              return (
                <TouchableOpacity key={item.label} style={[s.chip, selected && s.chipOn]} onPress={() => setFilter(item.label)} activeOpacity={0.8}>
                  <Text style={[s.chipText, selected && s.chipTextOn]}>
                    {item.label}{item.label !== 'All' ? <Text style={s.chipCount}>  {item.count}</Text> : null}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <View style={s.loading}><ActivityIndicator color={C.ink} /></View>
        ) : (
          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {showSetups && setupResults.length > 0 && (
              <>
                <SectionHeader title="Published Setups" link="see all" />
                <View style={s.grid}>
                  {setupResults.map(post => (
                    <TouchableOpacity key={post.id} style={s.setupCard} onPress={() => setOpenedPost(post)} activeOpacity={0.9}>
                      <View style={s.setupPhoto}>
                        {post.photo ? (
                          <Image source={{ uri: imageUri(post.photo) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                        ) : post.boardSetup ? (
                          <BoardPreview setup={post.boardSetup} items={post.boardItems} />
                        ) : (
                          <View style={s.noPhoto}><Text style={s.noPhotoText}>No setup photo</Text></View>
                        )}
                      </View>
                      <View style={s.setupInfo}>
                        <Text style={s.setupTitle} numberOfLines={1}>{post.title}</Text>
                        <View style={s.setupMeta}>
                          <Text style={s.setupUser} numberOfLines={1}>{post.handle || `@${post.username}`}</Text>
                          <Text style={s.setupLikes}>♡ {post.likes || 0}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {showGear && gearResults.length > 0 && (
              <>
                <SectionHeader title="Popular Items" link="see all" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.gearScroll}>
                  {gearResults.map(item => (
                    <TouchableOpacity key={item.id} style={s.gearCard} onPress={() => setOpenedItem(item)} activeOpacity={0.85}>
                      <View style={s.gearThumb}>
                        {item.photoBase64 ? (
                          <Image source={{ uri: imageUri(item.photoBase64, 'image/png') }} style={s.gearImage} contentFit="contain" />
                        ) : (
                          <Text style={s.noGearPhoto}>No photo</Text>
                        )}
                      </View>
                      <Text style={s.gearName} numberOfLines={1}>{item.product?.product_name || 'Unnamed gear'}</Text>
                      <Text style={s.gearCount} numberOfLines={1}>{item.product?.category || 'gear'}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {showPeople && creatorResults.length > 0 && (
              <>
                <SectionHeader title="Creators" link="explore" />
                <View style={s.creators}>
                  {creatorResults.map(creator => (
                    <CreatorRow key={creator.id} creator={creator} onOpen={() => setOpenedCreator(creator)} />
                  ))}
                </View>
              </>
            )}

            {showTags && tagResults.length > 0 && (
              <>
                <SectionHeader title="Browse by Tag" />
                <View style={s.tags}>
                  {tagResults.map(tag => (
                    <TouchableOpacity key={tag.name} style={s.tag} onPress={() => { setQuery(tag.name); setFilter('All'); }} activeOpacity={0.8}>
                      <Text style={s.tagText}><Text style={s.tagHash}>#</Text>{tag.name}</Text>
                      <Text style={s.tagCount}>{tag.count}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {!hasResults && (
              <View style={s.emptyState}>
                <Text style={s.emptyTitle}>{normalizedQuery ? 'No results found' : 'Nothing to search yet'}</Text>
                <Text style={s.emptyText}>
                  {normalizedQuery
                    ? 'Try another search or choose a different filter.'
                    : 'Publish a setup or save some gear, then it will appear here.'}
                </Text>
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal
        visible={!!openedPost || !!openedCreator || !!openedItem}
        animationType="slide"
        onRequestClose={() => {
          if (openedItem) setOpenedItem(null);
          else if (openedCreator) setOpenedCreator(null);
          else setOpenedPost(null);
        }}
      >
        <SafeAreaProvider>
          {openedItem ? (
            <ProductDetailScreen
              item={openedItem}
              onBack={() => setOpenedItem(null)}
              onOpenSetup={({ post }) => {
                if (post) {
                  setOpenedItem(null);
                  setOpenedPost(post);
                }
              }}
            />
          ) : openedCreator && creatorProfile ? (
            <CreatorProfileScreen
              creator={creatorProfile}
              onBack={() => setOpenedCreator(null)}
              onOpenSetup={entry => { setOpenedCreator(null); setOpenedPost(entry.post); }}
            />
          ) : openedPost ? (
            <SetupPostScreen
              post={openedPost}
              onBack={() => setOpenedPost(null)}
              onOpenCreator={() => {
                const creator = creators.find(candidate => candidate.username === openedPost.username);
                if (creator) { setOpenedPost(null); setOpenedCreator(creator); }
              }}
            />
          ) : null}
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  header: { paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchBarActive: { borderColor: C.ink, backgroundColor: C.bg },
  searchInput: { flex: 1, fontSize: 15, color: C.ink, padding: 0 },
  clear: { color: '#A0A0A8', fontSize: 14, fontWeight: '700' },
  cancel: { color: C.link, fontSize: 14, fontWeight: '600' },
  filters: { gap: 6, paddingHorizontal: 16 },
  chip: { paddingVertical: 7, paddingHorizontal: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 20 },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 12.5, fontWeight: '600', color: C.sub2 },
  chipTextOn: { color: '#FFFFFF' },
  chipCount: { fontSize: 10.5, opacity: 0.6 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  sec: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10 },
  secTitle: { fontSize: 12, letterSpacing: 1.5, fontWeight: '700', color: C.sub, textTransform: 'uppercase' },
  secLink: { fontSize: 12, color: C.link, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  setupCard: { width: '48%', backgroundColor: C.panel, borderRadius: 12, overflow: 'hidden' },
  setupPhoto: { aspectRatio: 1, width: '100%', backgroundColor: '#FFFFFF', overflow: 'hidden', justifyContent: 'center' },
  noPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel },
  noPhotoText: { color: C.sub, fontSize: 11 },
  setupInfo: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 },
  setupTitle: { fontSize: 12.5, fontWeight: '600', color: C.ink, marginBottom: 3 },
  setupMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  setupUser: { flex: 1, fontSize: 11, color: C.sub },
  setupLikes: { fontSize: 11, color: C.sub },
  gearScroll: { gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  gearCard: { width: 130, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10 },
  gearThumb: {
    aspectRatio: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border,
    borderRadius: 6, marginBottom: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  gearImage: { width: '86%', height: '86%' },
  noGearPhoto: { color: C.sub, fontSize: 11 },
  gearName: { fontSize: 12, fontWeight: '600', color: C.ink },
  gearCount: { fontSize: 10.5, color: C.sub, marginTop: 2 },
  creators: { paddingHorizontal: 16, gap: 8 },
  creator: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#4E6FA8', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  creatorInfo: { flex: 1, minWidth: 0 },
  creatorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  creatorName: { fontSize: 13.5, fontWeight: '600', color: C.ink },
  creatorBadge: { color: C.link, fontSize: 11 },
  creatorMeta: { fontSize: 11.5, color: '#6A6A72', marginTop: 1 },
  followBtn: { paddingVertical: 6, paddingHorizontal: 14, backgroundColor: C.ink, borderRadius: 16 },
  followBtnOn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#DCDCE0' },
  followText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  followTextOn: { color: C.sub2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 20 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 16 },
  tagText: { fontSize: 13, fontWeight: '500', color: C.ink },
  tagHash: { color: C.sub, fontWeight: '400' },
  tagCount: { color: C.sub, fontSize: 10.5 },
  emptyState: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 64 },
  emptyTitle: { color: C.ink, fontSize: 16, fontWeight: '700' },
  emptyText: { color: C.sub, fontSize: 13, textAlign: 'center', marginTop: 6 },
});
