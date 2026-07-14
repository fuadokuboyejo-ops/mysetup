import AsyncStorage from '@react-native-async-storage/async-storage';

const SETUPS_KEY = 'mysetup_setups';
const ITEMS_KEY = 'mysetup_items_v2';   // universal item library — shared by every setup
const LEGACY_KEY = 'mysetup_items';
const PREMIUM_KEY = 'mysetup_is_premium';
const GENERATIONS_KEY = 'mysetup_generations'; // { count, monthKey } — resets when the calendar month changes
const HISTORY_KEY = 'mysetup_generation_history';
// Android's SQLite CursorWindow caps a single AsyncStorage row around ~2MB —
// callers must pass small compressed thumbnails here, not full-size images.
const HISTORY_LIMIT = 12;

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

// `isCutout` records whether `photoBase64` actually went through background
// removal (vs. falling back to the raw photo) — the board only places items
// where this is true (or missing, for items saved before this flag existed).
export async function addSetupItem(_setupId, product, photoBase64, isCutout = true) {
  const items = await getAllItems();
  const item = { id: Date.now().toString(), product, photoBase64, isCutout, addedAt: new Date().toISOString() };
  await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify([item, ...items]));
  return item;
}

// Used to retry background removal on an already-saved item (e.g. from the
// board's "needs cutout" prompt) without creating a duplicate library entry.
export async function updateSetupItemPhoto(itemId, photoBase64, isCutout) {
  const items = await getAllItems();
  const updated = items.map(i => i.id === itemId ? { ...i, photoBase64, isCutout } : i);
  await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(updated));
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

// ─── Premium gating (AI Revamp) — no payment processor wired up yet; this just
// remembers the "unlocked" flag locally so the paywall isn't shown every time. ─
export async function getIsPremium() {
  return (await AsyncStorage.getItem(PREMIUM_KEY)) === 'true';
}

export async function setIsPremium(value) {
  await AsyncStorage.setItem(PREMIUM_KEY, value ? 'true' : 'false');
}

// ─── AI Revamp generations — capped per calendar month ────────────────────────
export const GENERATIONS_LIMIT = 100;

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export async function getGenerationsUsed() {
  const raw = await AsyncStorage.getItem(GENERATIONS_KEY);
  const data = raw ? JSON.parse(raw) : null;
  if (!data || data.monthKey !== currentMonthKey()) return 0;
  return data.count;
}

export async function incrementGenerationsUsed() {
  const used = await getGenerationsUsed();
  const count = used + 1;
  await AsyncStorage.setItem(GENERATIONS_KEY, JSON.stringify({ count, monthKey: currentMonthKey() }));
  return count;
}

// ─── Generation history — thumbnails of past AI Revamp results ───────────────
export async function getGenerationHistory() {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function addGenerationToHistory(image) {
  const history = await getGenerationHistory();
  const entry = { id: Date.now().toString(), image, createdAt: new Date().toISOString() };
  const next = [entry, ...history].slice(0, HISTORY_LIMIT);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}
