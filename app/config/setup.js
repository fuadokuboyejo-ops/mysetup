import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { isMediaUrl, stripDataUrl } from './media';

export const SETUP_TYPES = [
  { key: 'pc',      label: 'PC / Console', symbol: '⬡' },
  { key: 'server',  label: 'Server Setup', symbol: '⬡' },
  { key: 'laptop',  label: 'Laptop Setup', symbol: '⬡' },
];

export const BUILDABLE_TYPES = ['pc', 'server', 'laptop'];
export const GENERATIONS_LIMIT = 100;

const BUCKETS = {
  items: 'item-photos',
  setups: 'setup-photos',
  history: 'revamp-history',
};
const SIGNED_URL_SECONDS = 60 * 60;
const HISTORY_LIMIT = 12;

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user) throw new Error('Sign in to save and sync your data.');
  return data.user;
}

function throwIfError(error) {
  if (error) throw error;
}

async function signedUrl(bucket, path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error) throw error;
  return data?.signedUrl || null;
}

async function uploadBase64(bucket, path, value, contentType) {
  const base64 = stripDataUrl(value);
  if (!base64) throw new Error('The selected media could not be read.');
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, decode(base64), { contentType, cacheControl: '3600', upsert: true });
  throwIfError(error);
  return path;
}

function imageFormat(value, fallback = 'jpg') {
  const raw = stripDataUrl(value);
  if (raw.startsWith('iVBOR')) return { extension: 'png', contentType: 'image/png' };
  if (raw.startsWith('UklGR')) return { extension: 'webp', contentType: 'image/webp' };
  return fallback === 'png'
    ? { extension: 'png', contentType: 'image/png' }
    : { extension: 'jpg', contentType: 'image/jpeg' };
}

async function uploadUri(bucket, path, uri, contentType) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uploadBase64(bucket, path, base64, contentType);
}

async function removeStorageObjects(bucket, paths) {
  const filtered = [...new Set((paths || []).filter(Boolean))];
  if (filtered.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(filtered);
  if (error) console.warn(`[storage] Could not remove ${bucket} objects:`, error.message);
}

async function mapSetup(row) {
  if (!row) return null;
  const [photo, monitorWallpaper, ...extraPhotos] = await Promise.all([
    signedUrl(BUCKETS.setups, row.photo_path),
    signedUrl(BUCKETS.setups, row.wallpaper_path),
    ...(row.extra_photo_paths || []).map(path => signedUrl(BUCKETS.setups, path)),
  ]);
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    photo,
    photoPath: row.photo_path,
    monitorWallpaper,
    wallpaperPath: row.wallpaper_path,
    extraPhotos,
    extraPhotoPaths: row.extra_photo_paths || [],
    dots: row.dots || [],
    boardLayout: row.board_layout || null,
    slots: row.slots || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function mapItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    product: row.product || {},
    photoBase64: await signedUrl(BUCKETS.items, row.photo_path),
    photoPath: row.photo_path,
    isCutout: row.is_cutout,
    isPublic: row.is_public,
    addedAt: row.added_at,
  };
}

function setupItemIds(setup) {
  return [...new Set([
    ...Object.values(setup?.slots || {}),
    ...(setup?.dots || []).map(dot => dot.libraryItemId),
  ].filter(Boolean))];
}

async function updateSetup(setupId, patch) {
  const user = await currentUser();
  const { error } = await supabase
    .from('setups')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', setupId)
    .eq('user_id', user.id);
  throwIfError(error);
}

export async function getSetups() {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('setups')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
  throwIfError(error);
  return Promise.all((data || []).map(mapSetup));
}

export async function createSetup(name, type = 'pc') {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('setups')
    .insert({ user_id: user.id, name, type })
    .select('*')
    .single();
  throwIfError(error);
  return mapSetup(data);
}

export async function getAllItems() {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false });
  throwIfError(error);
  return Promise.all((data || []).map(mapItem));
}

export async function getPublicItems() {
  await currentUser();
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('is_public', true)
    .order('added_at', { ascending: false })
    .limit(100);
  throwIfError(error);
  return Promise.all((data || []).map(mapItem));
}

export async function getSetupItems() {
  return getAllItems();
}

export async function addSetupItem(_setupId, product, photoBase64, isCutout = true) {
  const user = await currentUser();
  const id = uuid();
  const extension = isCutout ? 'png' : 'jpg';
  const contentType = isCutout ? 'image/png' : 'image/jpeg';
  const photoPath = `${user.id}/${id}.${extension}`;
  await uploadBase64(BUCKETS.items, photoPath, photoBase64, contentType);

  const { data, error } = await supabase
    .from('items')
    .insert({
      id,
      user_id: user.id,
      product,
      photo_path: photoPath,
      is_cutout: isCutout,
      is_public: false,
    })
    .select('*')
    .single();
  if (error) {
    await removeStorageObjects(BUCKETS.items, [photoPath]);
    throw error;
  }
  return mapItem(data);
}

export async function updateSetupItemPhoto(itemId, photoBase64, isCutout) {
  const user = await currentUser();
  const extension = isCutout ? 'png' : 'jpg';
  const contentType = isCutout ? 'image/png' : 'image/jpeg';
  const photoPath = `${user.id}/${itemId}.${extension}`;
  const { data: existing, error: readError } = await supabase
    .from('items')
    .select('photo_path')
    .eq('id', itemId)
    .eq('user_id', user.id)
    .single();
  throwIfError(readError);
  await uploadBase64(BUCKETS.items, photoPath, photoBase64, contentType);
  const { data, error } = await supabase
    .from('items')
    .update({ photo_path: photoPath, is_cutout: isCutout })
    .eq('id', itemId)
    .eq('user_id', user.id)
    .select('*')
    .single();
  throwIfError(error);
  if (existing?.photo_path !== photoPath) {
    await removeStorageObjects(BUCKETS.items, [existing?.photo_path]);
  }
  return mapItem(data);
}

export async function removeSetupItem(_setupId, itemId) {
  const user = await currentUser();
  const { data, error: readError } = await supabase
    .from('items')
    .select('photo_path')
    .eq('id', itemId)
    .eq('user_id', user.id)
    .single();
  throwIfError(readError);
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', user.id);
  throwIfError(error);
  await removeStorageObjects(BUCKETS.items, [data?.photo_path]);
}

export async function setItemPublic(itemId, isPublic) {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('items')
    .update({ is_public: !!isPublic })
    .eq('id', itemId)
    .eq('user_id', user.id)
    .select('*')
    .single();
  throwIfError(error);
  return mapItem(data);
}

export async function makeItemsPublic(itemIds) {
  const ids = [...new Set((itemIds || []).filter(Boolean))];
  if (ids.length === 0) return;
  const user = await currentUser();
  const { error } = await supabase
    .from('items')
    .update({ is_public: true })
    .eq('user_id', user.id)
    .in('id', ids);
  throwIfError(error);
}

export async function syncPublicItemsFromPosts() {
  const user = await currentUser();
  const [{ data: posts, error: postsError }, { data: setups, error: setupsError }] = await Promise.all([
    supabase.from('posts').select('setup_id').eq('user_id', user.id),
    supabase.from('setups').select('id, slots').eq('user_id', user.id),
  ]);
  throwIfError(postsError);
  throwIfError(setupsError);
  const publishedIds = new Set((posts || []).map(post => post.setup_id));
  const publicItemIds = [...new Set((setups || [])
    .filter(setup => publishedIds.has(setup.id))
    .flatMap(setup => Object.values(setup.slots || {}))
    .filter(Boolean))];
  await makeItemsPublic(publicItemIds);
  return getAllItems();
}

export async function updateItemProduct(itemId, patch) {
  const user = await currentUser();
  const { data: current, error: readError } = await supabase
    .from('items')
    .select('product')
    .eq('id', itemId)
    .eq('user_id', user.id)
    .single();
  throwIfError(readError);
  const { data, error } = await supabase
    .from('items')
    .update({ product: { ...(current?.product || {}), ...patch } })
    .eq('id', itemId)
    .eq('user_id', user.id)
    .select('*')
    .single();
  throwIfError(error);
  return mapItem(data);
}

export async function fetchItemPrice(item) {
  const { data, error } = await supabase.functions.invoke('price-lookup', {
    body: {
      name: item.product?.product_name,
      brand: item.product?.brand,
      category: item.product?.category,
    },
  });
  if (error) throw new Error(error.message || 'Price lookup failed');
  if (data?.error) throw new Error(data.error);
  if (data?.price == null) return { item, matched: false };

  const updated = await updateItemProduct(item.id, {
    price: data.price,
    regular_price: data.regularPrice ?? null,
    currency: data.currency || 'USD',
    price_source: data.source || 'ebay',
    purchase_url: data.purchase_url || item.product?.purchase_url || null,
    price_updated_at: new Date().toISOString(),
  });
  return { item: updated, matched: true };
}

export async function deleteSetup(setupId) {
  const user = await currentUser();
  const { data: setup, error: readError } = await supabase
    .from('setups')
    .select('photo_path, wallpaper_path, extra_photo_paths')
    .eq('id', setupId)
    .eq('user_id', user.id)
    .single();
  throwIfError(readError);
  const { error } = await supabase.rpc('delete_setup', { p_setup_id: setupId });
  throwIfError(error);
  await removeStorageObjects(BUCKETS.setups, [
    setup?.photo_path,
    setup?.wallpaper_path,
    ...(setup?.extra_photo_paths || []),
  ]);
}

export async function updateSetupPhoto(setupId, photoBase64) {
  const user = await currentUser();
  const { data: existing, error: readError } = await supabase
    .from('setups')
    .select('photo_path')
    .eq('id', setupId)
    .eq('user_id', user.id)
    .single();
  throwIfError(readError);
  const format = imageFormat(photoBase64);
  const photoPath = `${user.id}/${setupId}/main.${format.extension}`;
  await uploadBase64(BUCKETS.setups, photoPath, photoBase64, format.contentType);
  await updateSetup(setupId, { photo_path: photoPath });
  if (existing?.photo_path !== photoPath) {
    await removeStorageObjects(BUCKETS.setups, [existing?.photo_path]);
  }
  return signedUrl(BUCKETS.setups, photoPath);
}

export async function addSetupExtraPhoto(setupId, photoBase64) {
  const user = await currentUser();
  const { data, error: readError } = await supabase
    .from('setups')
    .select('extra_photo_paths')
    .eq('id', setupId)
    .eq('user_id', user.id)
    .single();
  throwIfError(readError);
  const path = `${user.id}/${setupId}/extra-${uuid()}.jpg`;
  await uploadBase64(BUCKETS.setups, path, photoBase64, 'image/jpeg');
  try {
    await updateSetup(setupId, { extra_photo_paths: [...(data?.extra_photo_paths || []), path] });
  } catch (error) {
    await removeStorageObjects(BUCKETS.setups, [path]);
    throw error;
  }
  return signedUrl(BUCKETS.setups, path);
}

export async function removeSetupExtraPhoto(setupId, index) {
  const user = await currentUser();
  const { data, error: readError } = await supabase
    .from('setups')
    .select('extra_photo_paths')
    .eq('id', setupId)
    .eq('user_id', user.id)
    .single();
  throwIfError(readError);
  const paths = data?.extra_photo_paths || [];
  const removed = paths[index];
  await updateSetup(setupId, { extra_photo_paths: paths.filter((_, i) => i !== index) });
  await removeStorageObjects(BUCKETS.setups, [removed]);
}

export async function updateSetupDots(setupId, dots) {
  await updateSetup(setupId, { dots });
}

export async function updateSetupWallpaper(setupId, wallpaperUri) {
  const user = await currentUser();
  const isVideo = /\.mp4(?:$|\?)/i.test(wallpaperUri || '');
  const extension = isVideo ? 'mp4' : 'jpg';
  const contentType = isVideo ? 'video/mp4' : 'image/jpeg';
  const path = `${user.id}/${setupId}/wallpaper.${extension}`;
  if (isMediaUrl(wallpaperUri) && !/^https?:/i.test(wallpaperUri)) {
    await uploadUri(BUCKETS.setups, path, wallpaperUri, contentType);
  } else {
    await uploadBase64(BUCKETS.setups, path, wallpaperUri, contentType);
  }
  await updateSetup(setupId, { wallpaper_path: path });
  return signedUrl(BUCKETS.setups, path);
}

export async function updateSetupLayout(setupId, boardLayout) {
  await updateSetup(setupId, { board_layout: boardLayout });
}

export async function updateSetupSlots(setupId, slots) {
  await updateSetup(setupId, { slots });
}

export async function getIsPremium() {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('id', user.id)
    .single();
  throwIfError(error);
  return !!data?.is_premium;
}

export async function setIsPremium(value) {
  const user = await currentUser();
  const { error } = await supabase
    .from('profiles')
    .update({ is_premium: !!value, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  throwIfError(error);
}

function currentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

export async function getGenerationsUsed() {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('profiles')
    .select('generations_count, generations_month')
    .eq('id', user.id)
    .single();
  throwIfError(error);
  return data?.generations_month === currentMonthKey() ? data.generations_count : 0;
}

export async function incrementGenerationsUsed() {
  const { data, error } = await supabase.rpc('increment_generation_count');
  throwIfError(error);
  return data;
}

export async function getGenerationHistory() {
  const user = await currentUser();
  const { data, error } = await supabase
    .from('generation_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  throwIfError(error);
  return Promise.all((data || []).map(async row => ({
    id: row.id,
    image: await signedUrl(BUCKETS.history, row.image_path),
    imagePath: row.image_path,
    createdAt: row.created_at,
  })));
}

export async function addGenerationToHistory(image) {
  const user = await currentUser();
  const id = uuid();
  const path = `${user.id}/${id}.jpg`;
  await uploadBase64(BUCKETS.history, path, image, 'image/jpeg');
  const { error } = await supabase
    .from('generation_history')
    .insert({ id, user_id: user.id, image_path: path });
  if (error) {
    await removeStorageObjects(BUCKETS.history, [path]);
    throw error;
  }

  const { data: overflow, error: overflowError } = await supabase
    .from('generation_history')
    .select('id, image_path')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(HISTORY_LIMIT, 1000);
  throwIfError(overflowError);
  if (overflow?.length) {
    const { error: deleteError } = await supabase
      .from('generation_history')
      .delete()
      .in('id', overflow.map(entry => entry.id));
    throwIfError(deleteError);
    await removeStorageObjects(BUCKETS.history, overflow.map(entry => entry.image_path));
  }
  return getGenerationHistory();
}

function profileIdentity(profile, userId) {
  const username = profile?.username || `user-${String(userId).slice(0, 8)}`;
  const displayName = profile?.display_name || username;
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'ME';
  return { username, displayName, initials };
}

export async function getPosts() {
  await currentUser();
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  throwIfError(error);
  const rows = data || [];
  if (rows.length === 0) return [];

  const setupIds = [...new Set(rows.map(row => row.setup_id))];
  const userIds = [...new Set(rows.map(row => row.user_id))];
  const [{ data: setupRows, error: setupsError }, { data: profileRows, error: profilesError }] = await Promise.all([
    supabase.from('setups').select('*').in('id', setupIds),
    supabase
      .from('profiles')
      .select('id, username, display_name, bio, avatar_path, banner_path, account_private')
      .in('id', userIds),
  ]);
  throwIfError(setupsError);
  throwIfError(profilesError);

  const mappedSetups = await Promise.all((setupRows || []).map(mapSetup));
  const setupById = new Map(mappedSetups.map(setup => [setup.id, setup]));
  const allItemIds = [...new Set(mappedSetups.flatMap(setupItemIds))];
  let mappedItems = [];
  if (allItemIds.length > 0) {
    const { data: itemRows, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .in('id', allItemIds);
    throwIfError(itemsError);
    mappedItems = await Promise.all((itemRows || []).map(mapItem));
  }
  const itemById = new Map(mappedItems.map(item => [item.id, item]));
  const profileById = new Map((profileRows || []).map(profile => [profile.id, profile]));

  return rows.map(row => {
    const setup = setupById.get(row.setup_id) || null;
    const ids = setupItemIds(setup);
    const boardItems = ids.map(id => itemById.get(id)).filter(Boolean);
    const identity = profileIdentity(profileById.get(row.user_id), row.user_id);
    return {
      id: row.id,
      setupId: row.setup_id,
      userId: row.user_id,
      username: identity.username,
      handle: `@${identity.username}`,
      initials: identity.initials,
      title: row.title,
      caption: row.caption || '',
      description: row.caption || (row.tags || []).join(' · '),
      tags: row.tags || [],
      likes: row.likes || 0,
      comments: row.comments || 0,
      trending: false,
      items: ids.length,
      setupsCount: 1,
      followers: '0',
      gradient: ['#4A4368', '#8B5A56', '#C08552'],
      dots: setup?.dots || [],
      slots: {},
      extras: [],
      photo: setup?.photo || null,
      extraPhotos: setup?.extraPhotos || [],
      boardSetup: setup,
      boardItems,
      createdAt: row.created_at,
    };
  });
}

export async function addPost(post) {
  const user = await currentUser();
  const { data: setup, error: setupError } = await supabase
    .from('setups')
    .select('slots')
    .eq('id', post.setupId)
    .eq('user_id', user.id)
    .single();
  throwIfError(setupError);
  await makeItemsPublic(Object.values(setup?.slots || {}));

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      setup_id: post.setupId,
      title: post.title || 'Untitled setup',
      caption: post.caption || '',
      tags: post.tags || [],
    })
    .select('*')
    .single();
  throwIfError(error);
  return { ...post, id: data.id, createdAt: data.created_at };
}

export async function deletePostsBySetup(setupId) {
  const user = await currentUser();
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('setup_id', setupId)
    .eq('user_id', user.id);
  throwIfError(error);
}

export function buildPostFromSetup(setup, items, data) {
  const categories = (items || []).map(item => (item.product?.category || '').toLowerCase());
  const has = keyword => categories.some(category => category.includes(keyword));
  const slots = {
    monitor: has('monitor'),
    keyboard: has('keyboard'),
    mouse: has('mouse'),
    tower: has('pc') || has('tower') || has('server') || has('console') || has('laptop'),
  };
  const tags = data.tags || [];
  const caption = (data.caption || '').trim();
  return {
    setupId: setup?.id,
    username: 'you',
    handle: '@you',
    initials: 'ME',
    title: data.title,
    caption,
    description: caption || tags.join(' · '),
    tags,
    likes: 0,
    comments: 0,
    trending: false,
    items: (items || []).length,
    setupsCount: 1,
    followers: '0',
    gradient: ['#4A4368', '#8B5A56', '#C08552'],
    dots: setup?.dots || [],
    slots,
    extras: [],
  };
}
