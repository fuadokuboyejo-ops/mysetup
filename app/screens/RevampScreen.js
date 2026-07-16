import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, StatusBar, TextInput, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library/legacy';
import { File, Paths } from 'expo-file-system';
import { getAllItems, getSetups, updateSetupPhoto, createSetup, updateSetupLayout, updateSetupSlots, getGenerationsUsed, incrementGenerationsUsed, addGenerationToHistory, GENERATIONS_LIMIT } from '../config/setup';
import { REVAMP_ENDPOINT } from '../config/api';
import { normalizeNodes, computeLayout, nodeSpan } from '../config/boardLayout';

// Loosely match library items into the board's slots by category / name.
function matchBoard(items, nodes) {
  const slots = {};
  const used = new Set();
  for (const node of nodes) {
    const words = (node.label || node.id).toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const found = items.find(it => {
      if (used.has(it.id)) return false;
      const cat = (it.product?.category || '').toLowerCase();
      const name = (it.product?.product_name || '').toLowerCase();
      return words.some(w => cat.includes(w) || name.includes(w));
    });
    if (found) { slots[node.id] = found; used.add(found.id); }
  }
  return slots;
}

export default function RevampScreen({ onBack, setup, onArrangeBoard, basePhoto, autoGenerate = false, onAutoGenerateStarted }) {
  const [items, setItems] = useState([]);
  const [setups, setSetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const loadPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!generating) return;
    loadPulse.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(loadPulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(loadPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [generating]);
  const [image, setImage] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savingToCameraRoll, setSavingToCameraRoll] = useState(false);
  const [boardW, setBoardW] = useState(0);
  const [generationsUsed, setGenerationsUsed] = useState(0);
  const [boardSaveOpen, setBoardSaveOpen] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [savingBoard, setSavingBoard] = useState(false);
  const autoGenerateStarted = useRef(false);

  // `setup` (from App.js's activeSetup) goes stale after arranging — arranging
  // only persists to AsyncStorage + SetupScreen's own local state, it never
  // flows back up. Look up the freshest copy from `setups` (reloaded from
  // storage on every mount) instead of trusting the prop's slots directly.
  const currentSetup = setup ? (setups.find(s => s.id === setup.id) || setup) : null;

  // Use the setup's own board layout when we have one (e.g. arriving from
  // "Design from scratch"); otherwise fall back to the generic default board.
  const nodes = normalizeNodes(currentSetup?.boardLayout, currentSetup?.type || 'pc');
  // A real setup shows only what's actually been placed on it (empty until the
  // user places something) — auto-guessing from the whole library is only for
  // the no-setup "generic board" case.
  const boardSlots = currentSetup
    ? Object.fromEntries(
        Object.entries(currentSetup.slots || {})
          .map(([nodeId, itemId]) => [nodeId, items.find(it => it.id === itemId)])
          .filter(([, it]) => it),
      )
    : matchBoard(items, nodes);
  const layout = computeLayout(nodes, boardW);
  const placedItems = Object.values(boardSlots);

  const load = useCallback(async () => {
    const [its, sts, used] = await Promise.all([getAllItems(), getSetups(), getGenerationsUsed()]);
    setItems(its);
    setSetups(sts);
    setGenerationsUsed(used);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (items.length === 0) {
      Alert.alert('No items yet', 'Scan a few products first, then generate a setup photo.');
      return;
    }
    if (placedItems.length === 0) {
      Alert.alert('Board is empty', 'Place at least one item on your board before generating a photo.');
      return;
    }
    if (generationsUsed >= GENERATIONS_LIMIT) {
      Alert.alert('Monthly limit reached', `You've used all ${GENERATIONS_LIMIT} generations this month. It resets next month.`);
      return;
    }
    const source = placedItems;
    setGenerating(true);
    try {
      const payload = {
        items: source.map(it => ({
          name: it.product?.product_name,
          category: it.product?.category,
          photo: it.photoBase64,
        })),
        // "Try different gear" starts from a real photo of the user's setup;
        // the backend uses it as the base scene to re-render with new gear.
        basePhoto: basePhoto?.base64 || undefined,
      };
      const res = await fetch(REVAMP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.image) throw new Error(data.error || 'Generation failed');
      setImage(data.image);
      setGenerationsUsed(await incrementGenerationsUsed());
      // Store a small compressed thumbnail, not the full image — Android's
      // AsyncStorage backend rejects rows over ~2MB (the full render is 2-3MB).
      ImageManipulator.manipulateAsync(
        `data:image/png;base64,${data.image}`,
        [{ resize: { width: 320 } }],
        { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      )
        .then(thumb => addGenerationToHistory(thumb.base64))
        .catch(e => console.warn('addGenerationToHistory failed:', e.message));
    } catch (e) {
      Alert.alert('Revamp failed', e.message);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!autoGenerate || loading || autoGenerateStarted.current) return;
    autoGenerateStarted.current = true;
    onAutoGenerateStarted?.();
    generate();
  }, [autoGenerate, loading]);

  const saveTo = async (setupId) => {
    if (!image) return;
    await updateSetupPhoto(setupId, image);
    setSaveOpen(false);
    Alert.alert('Saved', 'Set as the photo for that setup.');
  };

  const saveToCameraRoll = async () => {
    if (!image) return;
    setSavingToCameraRoll(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to save this photo.');
        return;
      }
      const file = new File(Paths.cache, `revamp-${Date.now()}.png`);
      file.create();
      file.write(image, { encoding: 'base64' });
      await MediaLibrary.createAssetAsync(file.uri);
      Alert.alert('Saved', 'Photo saved to your camera roll.');
    } catch (e) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSavingToCameraRoll(false);
    }
  };

  const openSaveBoard = () => {
    setBoardName('My board');
    setBoardSaveOpen(true);
  };

  // Save the board currently on screen (its layout + placed items) as a new
  // entry in the user's setups library — a copy they can revisit later.
  const saveBoard = async () => {
    const name = boardName.trim();
    if (!name) return;
    setSavingBoard(true);
    try {
      const created = await createSetup(name, currentSetup?.type || 'pc');
      await updateSetupLayout(created.id, nodes);
      const slotMap = Object.fromEntries(
        Object.entries(boardSlots)
          .filter(([, it]) => it)
          .map(([nodeId, it]) => [nodeId, it.id]),
      );
      await updateSetupSlots(created.id, slotMap);
      setBoardSaveOpen(false);
      await load();
      Alert.alert('Board saved', `"${name}" was added to your setups.`);
    } catch (e) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSavingBoard(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>AI Revamp</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.sub}>
            {basePhoto
              ? 'Your setup photo — pick items on the board below and we’ll re-render it with different gear.'
              : `${setup ? 'Your board' : 'Your default PC board'} — we generate a photorealistic setup photo from the items on it.`}
          </Text>
          <Text style={styles.genCount}>{generationsUsed} of {GENERATIONS_LIMIT} generations used this month</Text>

          {basePhoto && (
            <View style={styles.basePhotoWrap}>
              <Image source={{ uri: basePhoto.uri }} style={styles.basePhotoImg} resizeMode="cover" />
              <View style={styles.basePhotoTag}>
                <Text style={styles.basePhotoTagText}>Your setup</Text>
              </View>
            </View>
          )}

          {/* Default PC board */}
          <View
            style={[styles.board, { height: layout.height }]}
            onLayout={e => setBoardW(e.nativeEvent.layout.width)}
          >
            {boardW > 0 && nodes.map(node => {
              const r = layout.rects[node.id];
              if (!r) return null;
              const item = boardSlots[node.id];
              const span = nodeSpan(node);
              const vertical = span.rh > span.cw;
              const label = node.label?.trim() || 'slot';
              return (
                <View
                  key={node.id}
                  style={[
                    styles.slot,
                    { position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h },
                    item && styles.slotFilled,
                  ]}
                >
                  {item ? (
                    <Image source={{ uri: `data:image/png;base64,${item.photoBase64}` }} style={styles.slotImg} resizeMode="contain" />
                  ) : (
                    <View style={styles.slotEmptyContent} pointerEvents="none">
                      {!vertical && <Text style={styles.slotPlus}>+</Text>}
                      <Text style={[styles.slotLabel, vertical && styles.slotLabelRot]} numberOfLines={1}>{label}</Text>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Save this board as a setup in the user's library */}
            <TouchableOpacity
              style={styles.boardSaveBtn}
              onPress={openSaveBoard}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.boardSaveText}>Save</Text>
            </TouchableOpacity>
          </View>

          {setup && (
            <View style={styles.hardBtnWrap}>
              <View style={styles.hardBtnShadow} />
              <TouchableOpacity style={styles.arrangeBtn} onPress={onArrangeBoard} activeOpacity={0.85}>
                <Text style={styles.arrangeText}>⤢  Arrange board</Text>
              </TouchableOpacity>
            </View>
          )}

          {image && (
            <View style={styles.preview}>
              <Image source={{ uri: `data:image/png;base64,${image}` }} style={styles.previewImg} resizeMode="contain" />
            </View>
          )}

          <View style={styles.hardBtnWrap}>
            <View style={styles.hardBtnShadow} />
            <TouchableOpacity style={styles.genBtn} onPress={generate} disabled={generating} activeOpacity={0.85}>
              {generating ? (
                <ActivityIndicator color="#161616" />
              ) : (
                <Text style={styles.genText}>{image ? 'Regenerate' : 'Generate setup photo'}</Text>
              )}
            </TouchableOpacity>
          </View>

          {image && (
            <View style={styles.hardBtnWrap}>
              <View style={styles.hardBtnShadow} />
              <TouchableOpacity style={styles.saveBtn} onPress={saveToCameraRoll} disabled={savingToCameraRoll} activeOpacity={0.85}>
                {savingToCameraRoll ? (
                  <ActivityIndicator color={C.text} />
                ) : (
                  <Text style={styles.saveText}>Save to camera roll</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {image && setups.length > 0 && (
            <View style={styles.hardBtnWrap}>
              <View style={styles.hardBtnShadow} />
              <TouchableOpacity style={styles.saveBtn} onPress={() => setSaveOpen(true)} activeOpacity={0.85}>
                <Text style={styles.saveText}>Save to a setup</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Generating overlay */}
      <Modal visible={generating} transparent animationType="fade">
        <View style={styles.loadOverlay}>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: loadPulse }] }]}>
            <ExpoImage source={require('../assets/loadingscreen.png')} style={StyleSheet.absoluteFill} contentFit="cover" />
          </Animated.View>
          <View style={styles.loadContent}>
            <ActivityIndicator color="#161616" size="large" />
            <Text style={styles.loadText}>Generating your setup photo…</Text>
            <Text style={styles.loadSub}>This can take up to a minute.</Text>
          </View>
        </View>
      </Modal>

      {/* Save-to-setup picker */}
      <Modal visible={saveOpen} transparent animationType="slide" onRequestClose={() => setSaveOpen(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setSaveOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Save to which setup?</Text>
            {setups.map(s => (
              <TouchableOpacity key={s.id} style={styles.sheetRow} onPress={() => saveTo(s.id)} activeOpacity={0.75}>
                <Text style={styles.sheetRowText}>{s.name}</Text>
                <Text style={styles.sheetChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Save-board naming sheet */}
      <Modal visible={boardSaveOpen} transparent animationType="slide" onRequestClose={() => setBoardSaveOpen(false)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setBoardSaveOpen(false)}>
          <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Save this board</Text>
            <TextInput
              style={styles.nameInput}
              value={boardName}
              onChangeText={setBoardName}
              placeholder="Board name"
              placeholderTextColor={C.sub}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveBoard}
            />
            <TouchableOpacity
              style={[styles.genBtn, styles.saveBoardConfirm]}
              onPress={saveBoard}
              disabled={savingBoard || !boardName.trim()}
              activeOpacity={0.85}
            >
              {savingBoard ? <ActivityIndicator color="#161616" /> : <Text style={styles.genText}>Save to my setups</Text>}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const C = { bg: '#FAFAF8', panel: '#FFFFFF', border: '#E0E0E0', text: '#161616', sub: '#8A8792', purple: '#6D5EF0' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { color: C.text, fontSize: 28, fontWeight: '300' },
  title: { color: C.text, fontSize: 18, fontWeight: '700' },

  body: { padding: 20, paddingBottom: 60, gap: 16 },
  sub: { color: C.sub, fontSize: 14, lineHeight: 20 },
  genCount: { color: C.sub, fontSize: 12, fontWeight: '600' },

  // Base photo of the user's setup (from "Try different gear")
  basePhotoWrap: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F0EFEA', borderWidth: 1.5, borderColor: '#161616', position: 'relative' },
  basePhotoImg: { width: '100%', height: '100%' },
  basePhotoTag: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(22,22,22,0.85)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  basePhotoTagText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // Default PC board
  board: { width: '100%', backgroundColor: '#F0EFEA', borderRadius: 16, position: 'relative' },
  slot: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#D9D6CE', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  slotFilled: { backgroundColor: '#FFFFFF', borderStyle: 'solid', borderColor: C.border },
  slotImg: { width: '85%', height: '78%' },
  slotEmptyContent: { alignItems: 'center', gap: 2 },
  slotPlus: { color: C.sub, fontSize: 18, fontWeight: '300', lineHeight: 20 },
  slotLabel: { color: C.sub, fontSize: 12 },
  slotLabelRot: { transform: [{ rotate: '90deg' }] },

  // "Save this board" pill, pinned to the board's top-right corner. Pill shape
  // borrowed from the "Go to library" button, in red.
  boardSaveBtn: {
    position: 'absolute', top: 8, right: 8, zIndex: 10,
    backgroundColor: '#E5484D',
    borderWidth: 1.5, borderColor: '#161616',
    borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  boardSaveText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },

  // Hard (unblurred) drop shadow — a solid offset shape behind the button,
  // matching the option cards on the AI Revamp menu.
  hardBtnWrap: { position: 'relative' },
  hardBtnShadow: {
    position: 'absolute',
    top: 3, left: 3, right: -3, bottom: -3,
    backgroundColor: '#615A78',
    borderRadius: 16,
  },

  arrangeBtn: { borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#161616', paddingVertical: 15, alignItems: 'center' },
  arrangeText: { color: '#161616', fontSize: 15, fontWeight: '700' },

  preview: { width: '100%', aspectRatio: 1, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewImg: { width: '100%', height: '100%' },
  previewEmpty: { color: C.sub, fontSize: 14, paddingHorizontal: 24, textAlign: 'center' },

  genBtn: { borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#161616', paddingVertical: 16, alignItems: 'center' },
  genText: { color: '#161616', fontSize: 15, fontWeight: '700' },
  saveBtn: { borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#161616', paddingVertical: 16, alignItems: 'center' },
  saveText: { color: C.text, fontSize: 15, fontWeight: '700' },

  loadOverlay: { flex: 1, backgroundColor: '#DCD3E8', alignItems: 'center', justifyContent: 'flex-end' },
  loadContent: { alignItems: 'center', gap: 10, paddingBottom: 90, paddingHorizontal: 40 },
  loadText: { color: '#161616', fontSize: 16, fontWeight: '700' },
  loadSub: { color: '#5B5566', fontSize: 13 },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, gap: 8 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 10 },
  sheetTitle: { color: C.text, fontSize: 17, fontWeight: '700', marginBottom: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.border },
  sheetRowText: { color: C.text, fontSize: 15, fontWeight: '500' },
  sheetChevron: { color: C.sub, fontSize: 22 },

  nameInput: {
    borderWidth: 1.5, borderColor: '#161616', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.text, backgroundColor: '#FFFFFF',
  },
  saveBoardConfirm: { marginTop: 12 },
});
