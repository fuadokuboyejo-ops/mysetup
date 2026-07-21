import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSetups, getAllItems } from '../config/setup';
import { imageUri } from '../config/media';
import { computeLayout, normalizeNodes, nodeSpan } from '../config/boardLayout';
import StitchBorder from '../components/StitchBorder';

// Board preview matching the Profile setups list: the arranged node layout with
// each slot's gear photo, dashed labelled placeholders for empty slots.
function BoardPreview({ setup, items }) {
  const [w, setW] = useState(0);
  const nodes = normalizeNodes(setup?.boardLayout, setup?.type);
  const placements = setup?.slots || {};
  const filled = {};
  for (const [nodeId, itemId] of Object.entries(placements)) {
    const it = items?.find(i => i.id === itemId);
    if (it) filled[nodeId] = it;
  }
  const layout = computeLayout(nodes, w);

  return (
    <View style={[S.previewBoard, { height: layout.height }]} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {w > 0 && nodes.map(node => {
        const r = layout.rects[node.id];
        if (!r) return null;
        const photo = filled[node.id]?.photoBase64;
        const span = nodeSpan(node);
        const vertical = span.rh > span.cw;
        const label = node.label?.trim() || 'slot';
        return (
          <View
            key={node.id}
            style={[
              S.previewSlot,
              { position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h },
              photo && S.previewSlotFilled,
            ]}
          >
            {photo ? (
              <Image source={{ uri: imageUri(photo, 'image/png') }} style={S.previewSlotImage} resizeMode="contain" />
            ) : (
              <>
                <StitchBorder width={r.w} height={r.h} radius={14} color="#C7C7CC" strokeWidth={1.3} dash={5} gap={5} />
                <View style={S.previewSlotContent} pointerEvents="none">
                  {!vertical && <Text style={S.previewPlus}>+</Text>}
                  <Text style={[S.previewLabel, vertical && S.previewLabelRotated]} numberOfLines={1}>{label}</Text>
                </View>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

// Full-screen "Generate an existing setup" picker — shows every saved board as a
// card; tapping one hands it back to open the revamp for that setup.
export default function RevampSetupPickerScreen({ onBack, onSelect }) {
  const [setups, setSetups] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [sts, its] = await Promise.all([getSetups(), getAllItems()]);
      setSetups(sts);
      setAllItems(its);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <View style={S.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={S.safe} edges={['top']}>
        <View style={S.header}>
          <TouchableOpacity onPress={onBack} style={S.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={S.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={S.title}>Choose a setup</Text>
          <View style={S.backBtn} />
        </View>

        {loading ? (
          <View style={S.center}><ActivityIndicator color={C.accent} /></View>
        ) : setups.length === 0 ? (
          <View style={S.empty}>
            <Text style={S.emptyText}>No saved setups yet</Text>
            <Text style={S.emptyHint}>Build a setup first, then it’ll show up here.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={S.grid} showsVerticalScrollIndicator={false}>
            <Text style={S.sub}>Pick a board to turn into a photorealistic photo.</Text>
            {setups.map(setup => {
              const placed = Object.values(setup.slots || {}).filter(id => allItems.some(i => i.id === id)).length;
              return (
                <View key={setup.id} style={S.setupCardWrap}>
                  <View style={S.setupCardHardShadow} />
                  <TouchableOpacity style={S.setupCard} activeOpacity={0.85} onPress={() => onSelect(setup)}>
                    <BoardPreview setup={setup} items={allItems} />
                    <View style={S.setupFooter}>
                      <View style={S.setupFooterMain}>
                        <Text style={S.setupName} numberOfLines={1}>{setup.name}</Text>
                        <Text style={S.setupCount}>{placed} on board</Text>
                      </View>
                      <View style={S.generateBtn}>
                        <Text style={S.generateBtnText}>Generate ›</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const C = { bg: '#FAFAF8', card: '#FFFFFF', border: '#E0E0E0', text: '#161616', sub: '#6E6E73', accent: '#6D5EF0' };

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  backBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  backText: { color: C.text, fontSize: 30, fontWeight: '300' },
  title: { color: C.text, fontSize: 17, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { paddingHorizontal: 20, paddingBottom: 60, gap: 18 },
  sub: { color: C.sub, fontSize: 13.5, lineHeight: 20, marginTop: 4, marginBottom: 2 },

  setupCardWrap: { position: 'relative' },
  setupCardHardShadow: {
    position: 'absolute', top: 3, left: 3, right: -3, bottom: -3,
    backgroundColor: '#615A78', borderRadius: 16,
  },
  setupCard: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1.5, borderColor: '#161616', overflow: 'hidden' },

  previewBoard: { backgroundColor: '#F0EFEA', marginHorizontal: 12, marginVertical: 12, borderRadius: 16, position: 'relative' },
  previewSlot: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewSlotFilled: { backgroundColor: '#FFFFFF', borderStyle: 'solid', borderColor: '#E3E0D8', borderWidth: 1 },
  previewSlotImage: { width: '85%', height: '80%' },
  previewSlotContent: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  previewPlus: { color: C.sub, fontSize: 16, fontWeight: '300', lineHeight: 18 },
  previewLabel: { color: C.sub, fontSize: 11, fontWeight: '500' },
  previewLabelRotated: { transform: [{ rotate: '90deg' }] },

  setupFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#EEEBE3',
  },
  setupFooterMain: { flex: 1 },
  setupName: { color: C.text, fontSize: 16, fontWeight: '700' },
  setupCount: { color: C.accent, fontSize: 12, fontWeight: '600', marginTop: 2 },
  generateBtn: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#161616',
    backgroundColor: C.accent, minWidth: 64, alignItems: 'center',
  },
  generateBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyText: { color: C.text, fontSize: 16, fontWeight: '700' },
  emptyHint: { color: C.sub, fontSize: 13, marginTop: 6, textAlign: 'center' },
});
