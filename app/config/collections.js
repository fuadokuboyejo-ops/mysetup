// Collection — the posts a user has liked, saved on-device per account. Kept
// local (not a DB table) because the feed mixes real posts with sample/template
// setups that have no posts row to reference; a personal saved-list works for
// both. Likes as a public server-side count can come later (see FUTURE_UPDATES).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const KEY_PREFIX = 'mysetup_collection_v1:';

async function currentUserId() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id || 'anon';
  } catch {
    return 'anon';
  }
}

async function readAll() {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + (await currentUserId()));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeAll(list) {
  try {
    await AsyncStorage.setItem(KEY_PREFIX + (await currentUserId()), JSON.stringify(list));
  } catch {
    /* storage full / unavailable — the like just won't persist this time */
  }
}

// Store a compact snapshot so the Collections tab can render the card without
// re-fetching (works offline and for template setups).
function snapshot(post) {
  return {
    id: post.id,
    username: post.username,
    handle: post.handle,
    initials: post.initials,
    title: post.title,
    description: post.description,
    tags: post.tags,
    likes: post.likes,
    comments: post.comments,
    gradient: post.gradient,
    photo: post.photo || null,
    slots: post.slots,
    dots: post.dots,
    setupsCount: post.setupsCount,
    followers: post.followers,
    savedAt: Date.now(),
  };
}

export async function isPostLiked(postId) {
  const list = await readAll();
  return list.some(p => p.id === postId);
}

// Newest-liked first.
export async function getLikedPosts() {
  const list = await readAll();
  return list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

// Add/remove a post from the collection. Returns the new liked state
// (true = now saved in the collection).
export async function toggleLikedPost(post) {
  const list = await readAll();
  const exists = list.some(p => p.id === post.id);
  const next = exists ? list.filter(p => p.id !== post.id) : [snapshot(post), ...list];
  await writeAll(next);
  return !exists;
}
