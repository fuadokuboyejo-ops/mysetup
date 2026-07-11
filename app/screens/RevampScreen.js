import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, StatusBar, SafeAreaView,
} from 'react-native';
import { getAllItems, getSetups, updateSetupPhoto } from '../config/setup';
import { REVAMP_ENDPOINT } from '../config/api';
import { normalizeNodes, computeLayout, nodeSpan } from '../config/boardLayout';

// The default PC board (monitor / keyboard / mouse / PC tower / deskmat).
const PC_NODES = normalizeNodes(null, 'pc');

// Loosely match library items into the PC board slots by category / name.
function matchPcBoard(items) {
  const slots = {};
  const used = new Set();
  for (const node of PC_NODES) {
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

export default function RevampScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [setups, setSetups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [image, setImage] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [boardW, setBoardW] = useState(0);

  const boardSlots = matchPcBoard(items);
  const layout = computeLayout(PC_NODES, boardW);
  const placedItems = Object.values(boardSlots);

  const load = useCallback(async () => {
    const [its, sts] = await Promise.all([getAllItems(), getSetups()]);
    setItems(its);
    setSetups(sts);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (items.length === 0) {
      Alert.alert('No items yet', 'Scan a few products first, then generate a setup photo.');
      return;
    }
    // Prefer the items placed on the board; fall back to the whole library.
    const source = placedItems.length > 0 ? placedItems : items;
    setGenerating(true);
    try {
      const payload = {
        items: source.map(it => ({
          name: it.product?.product_name,
          category: it.product?.category,
          photo: it.photoBase64,
        })),
      };
      const res = await fetch(REVAMP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.image) throw new Error(data.error || 'Generation failed');
      setImage(data.image);
    } catch (e) {
      Alert.alert('Revamp failed', e.message);
    } finally {
      setGenerating(false);
    }
  };

  const saveTo = async (setupId) => {
    if (!image) return;
    await updateSetupPhoto(setupId, image);
    setSaveOpen(false);
    Alert.alert('Saved', 'Set as the photo for that setup.');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>✨ AI Revamp</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.sub}>
            Your default PC board — we generate a photorealistic setup photo from the items on it.
          </Text>

          {/* Default PC board */}
          <View
            style={[styles.board, { height: layout.height }]}
            onLayout={e => setBoardW(e.nativeEvent.layout.width)}
          >
            {boardW > 0 && PC_NODES.map(node => {
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
                    <>
                      <Image source={{ uri: `data:image/png;base64,${item.photoBase64}` }} style={styles.slotImg} resizeMode="contain" />
                      <Text style={[styles.slotLabelFilled, vertical && styles.slotLabelRot]}>{label}</Text>
                    </>
                  ) : (
                    <View style={styles.slotEmptyContent} pointerEvents="none">
                      {!vertical && <Text style={styles.slotPlus}>+</Text>}
                      <Text style={[styles.slotLabel, vertical && styles.slotLabelRot]} numberOfLines={1}>{label}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {image && (
            <View style={styles.preview}>
              <Image source={{ uri: `data:image/png;base64,${image}` }} style={styles.previewImg} resizeMode="contain" />
            </View>
          )}

          <TouchableOpacity style={styles.genBtn} onPress={generate} disabled={generating} activeOpacity={0.85}>
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.genText}>{image ? '✨  Regenerate' : '✨  Generate setup photo'}</Text>
            )}
          </TouchableOpacity>

          {image && setups.length > 0 && (
            <TouchableOpacity style={styles.saveBtn} onPress={() => setSaveOpen(true)} activeOpacity={0.85}>
              <Text style={styles.saveText}>Save to a setup</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Generating overlay */}
      <Modal visible={generating} transparent animationType="fade">
        <View style={styles.loadOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.loadText}>Generating your setup photo…</Text>
          <Text style={styles.loadSub}>This can take up to a minute.</Text>
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
    </View>
  );
}

const C = { bg: '#0c0c0e', panel: '#1a1a1d', border: '#2a2a2e', text: '#f5f5f7', sub: '#8e8e96' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { color: C.text, fontSize: 28, fontWeight: '300' },
  title: { color: C.text, fontSize: 18, fontWeight: '700' },

  body: { padding: 20, paddingBottom: 60, gap: 16 },
  sub: { color: C.sub, fontSize: 14, lineHeight: 20 },

  // Default PC board
  board: { width: '100%', backgroundColor: '#111113', borderRadius: 16, position: 'relative' },
  slot: { backgroundColor: '#242428', borderRadius: 14, borderWidth: 1, borderColor: '#424248', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  slotFilled: { backgroundColor: '#2e2e33', borderStyle: 'solid', borderColor: '#3a3a40' },
  slotImg: { width: '85%', height: '78%' },
  slotEmptyContent: { alignItems: 'center', gap: 2 },
  slotPlus: { color: C.sub, fontSize: 18, fontWeight: '300', lineHeight: 20 },
  slotLabel: { color: C.sub, fontSize: 12 },
  slotLabelFilled: { position: 'absolute', bottom: 5, color: C.sub, fontSize: 11, fontWeight: '500' },
  slotLabelRot: { transform: [{ rotate: '90deg' }] },

  preview: { width: '100%', aspectRatio: 1, borderRadius: 18, backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewImg: { width: '100%', height: '100%' },
  previewEmpty: { color: C.sub, fontSize: 14, paddingHorizontal: 24, textAlign: 'center' },

  genBtn: { borderRadius: 14, backgroundColor: '#6d5ef0', paddingVertical: 16, alignItems: 'center' },
  genText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  saveBtn: { borderRadius: 14, backgroundColor: '#fff', paddingVertical: 16, alignItems: 'center' },
  saveText: { color: '#0e0e10', fontSize: 15, fontWeight: '700' },

  loadOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  loadText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loadSub: { color: C.sub, fontSize: 13 },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, gap: 8 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 10 },
  sheetTitle: { color: C.text, fontSize: 17, fontWeight: '700', marginBottom: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.border },
  sheetRowText: { color: C.text, fontSize: 15, fontWeight: '500' },
  sheetChevron: { color: C.sub, fontSize: 22 },
});
