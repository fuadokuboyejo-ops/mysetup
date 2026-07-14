import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, Alert, TextInput, Modal, ActivityIndicator, StatusBar,
} from 'react-native';
import { getSetups, createSetup, deleteSetup, getAllItems } from '../config/setup';
import { computeLayout, normalizeNodes, nodeSpan } from '../config/boardLayout';
import StitchBorder from '../components/StitchBorder';

// Renders a setup's saved custom board — identical grid geometry to the builder
// and the setup Board tab (shared computeLayout), filled with THIS setup's own
// placements (nodeId → itemId) resolved against the shared item library.
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
    <View
      style={[S.previewBoard, { height: layout.height }]}
      onLayout={e => setW(e.nativeEvent.layout.width)}
    >
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
              <Image
                source={{ uri: `data:image/png;base64,${photo}` }}
                style={S.previewSlotImage}
                resizeMode="contain"
              />
            ) : (
              <>
                <StitchBorder
                  width={r.w} height={r.h} radius={14}
                  color="#C7C7CC" strokeWidth={1.3} dash={5} gap={5}
                />
                <View style={S.previewSlotContent} pointerEvents="none">
                  {!vertical && <Text style={S.previewPlus}>+</Text>}
                  <Text style={[S.previewLabel, vertical && S.previewLabelRotated]} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

const SETUP_TYPES = [
  { key: 'pc',      label: 'PC / Console',  symbol: '⬡' },
  { key: 'server',  label: 'Server Setup',  symbol: '⬡' },
  { key: 'laptop',  label: 'Laptop Setup',  symbol: '⬡' },
];

export default function ProfileScreen({ onOpenSetup, onBuildSetup, onBack, onSetupDeleted }) {
  const [setups, setSetups] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [data, items] = await Promise.all([getSetups(), getAllItems()]);
    setSetups(data);
    setAllItems(items);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openModal = () => { setNewName(''); setNewType(''); setModalStep(1); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setNewName(''); setNewType(''); setModalStep(1); };

  const handleNext = () => {
    if (!newName.trim()) return;
    setModalStep(2);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newType) return;
    setCreating(true);
    const setup = await createSetup(newName.trim(), newType);
    closeModal();
    setCreating(false);
    await load();
    // These types start in the board builder so users can edit the layout first.
    const BUILDABLE = ['pc', 'server', 'laptop'];
    if (BUILDABLE.includes(newType) && onBuildSetup) onBuildSetup(setup);
    else onOpenSetup(setup);
  };

  const handleDelete = (setup) => {
    Alert.alert('Delete Setup', `Delete "${setup.name}"? This removes the board and photo — your items stay in your library.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSetup(setup.id);
          onSetupDeleted?.(setup.id);
          load();
        },
      },
    ]);
  };

  const totalItems = allItems.length;

  return (
    <View style={S.container}>
      <StatusBar barStyle="dark-content" />
      <View style={S.header}>
        <TouchableOpacity onPress={onBack} style={S.backBtn}>
          <Text style={S.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Profile info */}
      <View style={S.profile}>
        <View style={S.avatar}><Text style={S.avatarText}>F</Text></View>
        <Text style={S.username}>fuad</Text>
        <Text style={S.handle}>@fuad.oku12</Text>
        <View style={S.statsRow}>
          <View style={S.stat}>
            <Text style={S.statNum}>{setups.length}</Text>
            <Text style={S.statLabel}>Setups</Text>
          </View>
          <View style={S.statDivider} />
          <View style={S.stat}>
            <Text style={S.statNum}>{totalItems}</Text>
            <Text style={S.statLabel}>Items</Text>
          </View>
          <View style={S.statDivider} />
          <View style={S.stat}>
            <Text style={S.statNum}>0</Text>
            <Text style={S.statLabel}>Followers</Text>
          </View>
        </View>
      </View>

      {/* Setups section */}
      <View style={S.sectionRow}>
        <Text style={S.sectionTitle}>My Setups</Text>
        <TouchableOpacity style={S.newBtn} onPress={openModal}>
          <Text style={S.newBtnText}>+ New Setup</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={S.center}><ActivityIndicator color={C.accent} /></View>
      ) : (
        <ScrollView contentContainerStyle={S.grid} showsVerticalScrollIndicator={false}>
          {setups.map(setup => {
            const placements = setup.slots || {};
            const placed = Object.values(placements).filter(id => allItems.some(i => i.id === id)).length;
            return (
            <View key={setup.id} style={S.setupCard}>
              <TouchableOpacity
                onPress={() => onOpenSetup(setup)}
                activeOpacity={0.8}
              >
                <BoardPreview setup={setup} items={allItems} />
              </TouchableOpacity>
              <View style={S.setupFooter}>
                <TouchableOpacity style={S.setupFooterMain} onPress={() => onOpenSetup(setup)} activeOpacity={0.8}>
                  <Text style={S.setupName}>{setup.name}</Text>
                  <Text style={S.setupCount}>{placed} on board</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={S.deleteBtn}
                  onPress={() => handleDelete(setup)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={S.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
            );
          })}

          {setups.length === 0 && (
            <View style={S.empty}>
              <Text style={S.emptyText}>No setups yet</Text>
              <Text style={S.emptyHint}>Tap "+ New Setup" to get started</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* New setup modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={S.overlay}>
          <View style={S.modal}>

            {modalStep === 1 ? (
              <>
                <Text style={S.modalTitle}>Name your setup</Text>
                <TextInput
                  style={S.input}
                  placeholder="e.g. Main Rig, Work Setup, Bedroom..."
                  placeholderTextColor="#ADADAD"
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                  onSubmitEditing={handleNext}
                  returnKeyType="next"
                />
                <View style={S.modalBtns}>
                  <TouchableOpacity style={S.cancelBtn} onPress={closeModal}>
                    <Text style={S.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[S.createBtn, !newName.trim() && S.createBtnDisabled]}
                    onPress={handleNext}
                    disabled={!newName.trim()}
                  >
                    <Text style={S.createText}>Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={S.modalTitle}>What kind of setup?</Text>
                <Text style={S.modalSub}>"{newName}"</Text>
                <View style={S.typeGrid}>
                  {SETUP_TYPES.map(t => (
                    <TouchableOpacity
                      key={t.key}
                      style={[S.typeBtn, newType === t.key && S.typeBtnActive]}
                      onPress={() => setNewType(t.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[S.typeBtnText, newType === t.key && S.typeBtnTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={S.modalBtns}>
                  <TouchableOpacity style={S.cancelBtn} onPress={() => setModalStep(1)}>
                    <Text style={S.cancelText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[S.createBtn, (!newType || creating) && S.createBtnDisabled]}
                    onPress={handleCreate}
                    disabled={!newType || creating}
                  >
                    <Text style={S.createText}>{creating ? 'Creating...' : 'Create'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

          </View>
        </View>
      </Modal>
    </View>
  );
}

const C = { bg: '#FAFAF8', card: '#FFFFFF', border: '#E0E0E0', text: '#161616', sub: '#6E6E73', slot: '#FAFAFA', filled: '#F0F0F0', accent: '#6D5EF0' };

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 36 },
  backText: { color: C.text, fontSize: 28, fontWeight: '300' },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '600' },

  profile: { alignItems: 'center', paddingBottom: 24, gap: 4 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#2a4a7a', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  username: { color: C.text, fontSize: 20, fontWeight: '700' },
  handle: { color: C.sub, fontSize: 14 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 28 },
  stat: { alignItems: 'center', gap: 2 },
  statNum: { color: C.text, fontSize: 18, fontWeight: '700' },
  statLabel: { color: C.sub, fontSize: 12 },
  statDivider: { width: 1, height: 28, backgroundColor: C.border },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14 },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  newBtn: { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingVertical: 7, paddingHorizontal: 14 },
  newBtnText: { color: C.text, fontSize: 13, fontWeight: '500' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { paddingHorizontal: 16, paddingBottom: 60, gap: 14 },

  setupCard: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },

  // Absolute-positioned grid (gap baked into coordinates via computeLayout), so
  // no padding/gap here — matches the builder + setup Board tab exactly.
  previewBoard: { backgroundColor: C.bg, marginHorizontal: 12, marginVertical: 12, borderRadius: 16, position: 'relative' },
  previewSlot: { backgroundColor: C.slot, borderRadius: 14, borderWidth: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewSlotFilled: { backgroundColor: C.filled, borderStyle: 'solid', borderColor: C.border, borderWidth: 1 },
  previewSlotImage: { width: '85%', height: '80%' },
  previewSlotContent: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  previewPlus: { color: C.sub, fontSize: 16, fontWeight: '300', lineHeight: 18 },
  previewLabel: { color: C.sub, fontSize: 11, fontWeight: '500' },
  previewLabelRotated: { transform: [{ rotate: '90deg' }] },

  setupFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  setupFooterMain: { flex: 1 },
  setupName: { color: C.text, fontSize: 15, fontWeight: '600' },
  setupCount: { color: C.sub, fontSize: 12, marginTop: 2 },
  deleteBtn: {
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,59,48,0.35)',
    backgroundColor: 'rgba(255,59,48,0.08)',
    minWidth: 64, alignItems: 'center',
  },
  deleteBtnText: { color: '#ff453a', fontSize: 12, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { color: C.text, fontSize: 16, fontWeight: '600' },
  emptyHint: { color: C.sub, fontSize: 13 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  modal: { backgroundColor: C.card, borderRadius: 20, padding: 24, width: '85%', gap: 16, borderWidth: 1, borderColor: C.border },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  modalSub: { color: C.sub, fontSize: 14, marginTop: -8 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeBtn: { width: '47%', paddingVertical: 18, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.slot, alignItems: 'center', justifyContent: 'center' },
  typeBtnActive: { borderColor: C.accent, backgroundColor: 'rgba(109,94,240,0.1)' },
  typeBtnText: { color: C.sub, fontSize: 14, fontWeight: '600' },
  typeBtnTextActive: { color: C.accent },
  input: { backgroundColor: C.slot, borderRadius: 12, borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 15, paddingVertical: 12, paddingHorizontal: 14 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingVertical: 13, alignItems: 'center' },
  cancelText: { color: C.sub, fontSize: 15 },
  createBtn: { flex: 1, borderRadius: 12, backgroundColor: C.accent, paddingVertical: 13, alignItems: 'center' },
  createBtnDisabled: { opacity: 0.4 },
  createText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
