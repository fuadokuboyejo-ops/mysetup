import AsyncStorage from '@react-native-async-storage/async-storage';

const SETUPS_KEY = 'mysetup_setups';
const ITEMS_KEY = 'mysetup_items_v2';   // universal item library — shared by every setup
const LEGACY_KEY = 'mysetup_items';

// Ensures storage exists and that items live in the global ITEMS_KEY store.
// Older builds kept items per-setup; migrate those into the shared library once.
// Cached so concurrent callers (e.g. getSetups + getAllItems in parallel) share
// a single run instead of racing the migration.
let _migration = null;
function migrate() {
  if (!_migration) _migration = runMigration();
  return _migration;
}

async function runMigration() {
  const existingRaw = await AsyncStorage.getItem(SETUPS_KEY);

  if (!existingRaw) {
    // Fresh install (or very old layout): seed a default setup and move any
    // legacy items into the global library.
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    const legacyItems = legacy ? JSON.parse(legacy) : [];
    await AsyncStorage.setItem(SETUPS_KEY, JSON.stringify([
      { id: 'default', name: 'Main Rig', createdAt: new Date().toISOString() },
    ]));
    if ((await AsyncStorage.getItem(ITEMS_KEY)) == null) {
      await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(legacyItems));
    }
    return;
  }

  // One-time: pull any per-setup items into the shared library, then strip them
  // from the setups so items are truly universal from here on.
  if ((await AsyncStorage.getItem(ITEMS_KEY)) == null) {
    const setups = JSON.parse(existingRaw);
    const all = [];
    const seen = new Set();
    for (const s of setups) {
      for (const it of (s.items || [])) {
        if (!seen.has(it.id)) { seen.add(it.id); all.push(it); }
      }
    }
    await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(all));
    await AsyncStorage.setItem(
      SETUPS_KEY,
      JSON.stringify(setups.map(({ items, ...rest }) => rest)),
    );
  }
}

export async function getSetups() {
  await migrate();
  const raw = await AsyncStorage.getItem(SETUPS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function createSetup(name, type = 'pc') {
  const setups = await getSetups();
  const newSetup = { id: Date.now().toString(), name, type, createdAt: new Date().toISOString() };
  await AsyncStorage.setItem(SETUPS_KEY, JSON.stringify([...setups, newSetup]));
  return newSetup;
}

// ─── Universal item library (shared across all setups) ───────────────────────
export async function getAllItems() {
  await migrate();
  const raw = await AsyncStorage.getItem(ITEMS_KEY);
  return raw ? JSON.parse(raw) : [];
}

// `setupId` is kept for call-site compatibility — items are global now.
export async function getSetupItems() {
  return getAllItems();
}

export async function addSetupItem(_setupId, product, photoBase64) {
  const items = await getAllItems();
  const item = { id: Date.now().toString(), product, photoBase64, addedAt: new Date().toISOString() };
  await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify([item, ...items]));
  return item;
}

export async function removeSetupItem(_setupId, itemId) {
  const items = await getAllItems();
  await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items.filter(i => i.id !== itemId)));
}

export async function deleteSetup(setupId) {
  const setups = await getSetups();
  await AsyncStorage.setItem(SETUPS_KEY, JSON.stringify(setups.filter(s => s.id !== setupId)));
}

export async function updateSetupPhoto(setupId, photoBase64) {
  const setups = await getSetups();
  const updated = setups.map(s => s.id === setupId ? { ...s, photo: photoBase64 } : s);
  await AsyncStorage.setItem(SETUPS_KEY, JSON.stringify(updated));
}

export async function updateSetupDots(setupId, dots) {
  const setups = await getSetups();
  const updated = setups.map(s => s.id === setupId ? { ...s, dots } : s);
  await AsyncStorage.setItem(SETUPS_KEY, JSON.stringify(updated));
}

export async function updateSetupWallpaper(setupId, wallpaperUri) {
  const setups = await getSetups();
  const updated = setups.map(s => s.id === setupId ? { ...s, monitorWallpaper: wallpaperUri } : s);
  await AsyncStorage.setItem(SETUPS_KEY, JSON.stringify(updated));
}

export async function updateSetupLayout(setupId, boardLayout) {
  const setups = await getSetups();
  const updated = setups.map(s => s.id === setupId ? { ...s, boardLayout } : s);
  await AsyncStorage.setItem(SETUPS_KEY, JSON.stringify(updated));
}

// Per-setup board placements: { [nodeId]: itemId }. Items come from the shared
// library, but which item sits in which slot is unique to each setup. Stored as
// a plain id→id map so it maps cleanly onto a future backend table.
export async function updateSetupSlots(setupId, slots) {
  const setups = await getSetups();
  const updated = setups.map(s => s.id === setupId ? { ...s, slots } : s);
  await AsyncStorage.setItem(SETUPS_KEY, JSON.stringify(updated));
}
