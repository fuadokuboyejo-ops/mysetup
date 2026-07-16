import { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { computeLayout, normalizeNodes, nodeSpan } from '../config/boardLayout';

const SUGGESTED_TAGS = ['minimal', 'gaming', 'productivity', 'cozy', 'RGB', 'wood', 'white', 'mechanical'];
const mono = Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' });
const BARCODE_BARS = [3, 1, 2, 4, 1, 3, 1, 1, 2, 3, 1, 4, 2, 1, 3, 1, 2, 1, 4, 1, 2, 3, 1, 1, 3, 2, 4, 1, 2, 1, 3, 1, 2, 4, 1, 1, 2, 3, 1, 2];

// Read-only board preview for the composer — same geometry as the Board tab
// and ProfileScreen's card preview, just rendered smaller/non-interactive.
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
    <View style={[styles.board, { height: layout.height }]} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {w > 0 && nodes.map(node => {
        const r = layout.rects[node.id];
        if (!r) return null;
        const photo = filled[node.id]?.photoBase64;
        return (
          <View
            key={node.id}
            style={[styles.slot, { position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h }, photo && styles.slotFilled]}
          >
            {photo && (
              <Image
                source={{ uri: `data:image/png;base64,${photo}` }}
                style={styles.slotImage}
                contentFit="contain"
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

// Perforated paper edge — same zigzag teeth as the Gear Receipt screen.
const ZIG_TEETH = Array.from({ length: 20 });
function Zig({ dir }) {
  return (
    <View style={styles.zigRow}>
      {ZIG_TEETH.map((_, index) => (
        <View key={index} style={dir === 'up' ? styles.toothUp : styles.toothDown} />
      ))}
    </View>
  );
}

function DashedLine() {
  return <Text style={styles.dashedLine} numberOfLines={1}>{'- '.repeat(40)}</Text>;
}

function Barcode() {
  return (
    <View style={styles.barcode}>
      {BARCODE_BARS.map((width, index) => (
        <View key={index} style={{ width, height: 40, backgroundColor: '#2B271E', marginRight: 2 }} />
      ))}
    </View>
  );
}

// One receipt line-item: label left, value right, dashed underline.
function ReceiptField({ label, hint, children, block }) {
  return (
    <View style={[styles.rRow, block && styles.rRowBlock]}>
      <View style={styles.rRowHeader}>
        <Text style={styles.rRowLabel}>{label}</Text>
        {hint && <Text style={styles.rHint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

// Post-composer — opened from the Setup Board tab's "Post" button. Preview
// (photo + board) up top, then a Gear-Receipt-styled paper form below for
// title/caption/tags/visibility — same monospace, perforated, barcode look
// used when logging a new piece of gear.
export default function PostComposerScreen({ setup, items, onClose, onSubmit }) {
  const [title, setTitle] = useState(setup?.name || '');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState([]);
  const [tagDraft, setTagDraft] = useState('');

  const dotCount = setup?.dots?.length || 0;
  const suggestions = SUGGESTED_TAGS.filter(t => !tags.includes(t)).slice(0, 4);
  const filledCount = [title, caption, tags.length > 0].filter(Boolean).length;

  const addTag = (tag) => {
    const clean = tag.trim().toLowerCase();
    if (clean && !tags.includes(clean)) setTags(prev => [...prev, clean]);
    setTagDraft('');
  };
  const removeTag = (tag) => setTags(prev => prev.filter(t => t !== tag));

  const submit = () => {
    onSubmit({ title: title.trim() || 'Untitled setup', caption: caption.trim(), tags });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.headerBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New post</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* Preview */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>PREVIEW</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.editLink}>edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.previewCard}>
            <View style={styles.photoWrap}>
              {setup?.photo ? (
                <Image source={{ uri: `data:image/jpeg;base64,${setup.photo}` }} style={styles.photoImg} contentFit="cover" />
              ) : (
                <LinearGradient colors={['#3A4152', '#4E5D6E', '#5E6B72']} style={styles.photoImg} />
              )}
              <View style={styles.tagsBadge}>
                <Text style={styles.tagsBadgeIcon}>◉</Text>
                <Text style={styles.tagsBadgeText}>{dotCount} tags</Text>
              </View>
            </View>
            <BoardPreview setup={setup} items={items} />
          </View>

          {/* Receipt — same paper/perforated/barcode treatment as the Gear Receipt screen */}
          <View style={styles.receipt}>
            <Zig dir="up" />
            <View style={styles.receiptBody}>
              <Text style={styles.rTitle}>MY SETUP</Text>
              <Text style={styles.rSubtitle}>POST RECEIPT · 2026</Text>

              <View style={styles.rMetaRow}>
                <Text style={styles.rMeta}>SETUP: {(setup?.name || 'UNTITLED').toUpperCase()}</Text>
                <Text style={styles.rMeta}>{items?.length || 0} ITEMS</Text>
              </View>

              <DashedLine />
              <Text style={styles.rSection}>— POST DETAILS —</Text>

              <ReceiptField label="TITLE">
                <View style={styles.rInputBox}>
                  <TextInput
                    style={styles.rInput}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="cozy walnut battlestation"
                    placeholderTextColor="#B8AF9A"
                  />
                </View>
              </ReceiptField>

              <ReceiptField label="CAPTION" hint="(OPT)" block>
                <View style={[styles.rInputBox, styles.rCaptionBox]}>
                  <TextInput
                    style={[styles.rInput, styles.rCaptionInput]}
                    value={caption}
                    onChangeText={t => setCaption(t.slice(0, 500))}
                    placeholder="finally finished the walnut refresh. new arm mount opened up so much desk space. still hunting for the right lamp."
                    placeholderTextColor="#B8AF9A"
                    multiline
                  />
                </View>
                <Text style={styles.rCharCount}>{caption.length} / 500</Text>
              </ReceiptField>

              <View style={[styles.rRow, styles.rRowBlock]}>
                <View style={styles.rRowHeader}>
                  <Text style={styles.rRowLabel}>TAGS</Text>
                  <Text style={styles.rHint}>helps others find you</Text>
                </View>
                <View style={styles.rTagRow}>
                  {tags.map(tag => (
                    <TouchableOpacity key={tag} style={styles.rTagChip} onPress={() => removeTag(tag)} activeOpacity={0.75}>
                      <Text style={styles.rTagChipText}>{tag.toUpperCase()} ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.rInputBox}>
                  <TextInput
                    style={styles.rTagInput}
                    value={tagDraft}
                    onChangeText={setTagDraft}
                    onSubmitEditing={() => addTag(tagDraft)}
                    placeholder="+ add tag..."
                    placeholderTextColor="#B8AF9A"
                    returnKeyType="done"
                  />
                </View>
                {suggestions.length > 0 && (
                  <View style={styles.rSuggestRow}>
                    {suggestions.map(tag => (
                      <TouchableOpacity key={tag} style={styles.rSuggestChip} onPress={() => addTag(tag)} activeOpacity={0.75}>
                        <Text style={styles.rSuggestChipText}>+ {tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <DashedLine />
              <View style={styles.rMetaRow}>
                <Text style={styles.rLoggedLabel}>DETAILS LOGGED</Text>
                <Text style={styles.rLoggedVal}>{filledCount} / 3</Text>
              </View>
              <DashedLine />

              <Text style={styles.rStars}>✦    ✦    ✦    ✦</Text>
              <Text style={styles.rFooter}>READY TO POST</Text>
              <Text style={styles.rFooterSub}>KEEP THIS RECEIPT FOR YOUR RECORDS</Text>
              <Barcode />
              <Text style={styles.rBarcodeText}>{tags.length} TAGS</Text>
            </View>
            <Zig dir="down" />
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={submit} activeOpacity={0.85}>
            <Text style={styles.submitBtnText}>post to feed</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const C = {
  bg: '#FAFAF8', card: '#FFFFFF', border: '#E0E0E0', text: '#161616', sub: '#8A8792', accent: '#6D5EF0',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { color: C.text, fontSize: 18, fontWeight: '600' },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '700' },

  body: { padding: 20, paddingBottom: 60, gap: 8 },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 8 },
  sectionLabel: { color: C.sub, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginTop: 18, marginBottom: 8 },
  editLink: { color: C.accent, fontSize: 14, fontWeight: '700' },

  previewCard: { backgroundColor: '#F4F4F4', borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 10, gap: 10 },
  photoWrap: { borderRadius: 14, overflow: 'hidden', aspectRatio: 4 / 3, position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  tagsBadge: {
    position: 'absolute', bottom: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(22,22,22,0.85)', borderRadius: 16,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  tagsBadgeIcon: { color: '#FFFFFF', fontSize: 10 },
  tagsBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  board: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 14, position: 'relative' },
  slot: { backgroundColor: '#F4F4F4', borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  slotFilled: { backgroundColor: '#F4F4F4' },
  slotImage: { width: '80%', height: '78%' },

  // ─── Receipt — matches GearReceiptScreen's paper/perforated/barcode look ───
  receipt: {
    marginTop: 22,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  receiptBody: { backgroundColor: '#FFFFFF', paddingHorizontal: 22, paddingVertical: 20 },
  rTitle: { fontFamily: mono, fontSize: 21, fontWeight: '700', color: '#2B271E', textAlign: 'center', letterSpacing: 6 },
  rSubtitle: { fontFamily: mono, fontSize: 10.5, color: '#8C846F', textAlign: 'center', letterSpacing: 2, marginTop: 4 },
  rMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  rMeta: { fontFamily: mono, fontSize: 10.5, color: '#8C846F', letterSpacing: 1 },
  rSection: { fontFamily: mono, fontSize: 12, fontWeight: '700', color: '#2B271E', textAlign: 'center', letterSpacing: 2, marginVertical: 4 },

  rRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#CFC6B0', borderStyle: 'dashed' },
  rRowBlock: { gap: 8 },
  rRowLast: { borderBottomWidth: 0 },
  rRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rRowLabel: { fontFamily: mono, fontSize: 12.5, fontWeight: '700', color: '#2B271E', letterSpacing: 1 },
  rHint: { fontFamily: mono, fontSize: 9, color: '#8C846F' },
  // Boxed "fill in the blank" field — dashed border + faint tint so it reads
  // clearly as an editable box against the plain receipt paper.
  rInputBox: {
    backgroundColor: '#FAF7EE', borderWidth: 1.5, borderColor: '#B8AF9A', borderStyle: 'dashed',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 6,
  },
  rCaptionBox: { minHeight: 76 },
  rInput: { fontFamily: mono, fontSize: 13, color: '#2B271E', padding: 0, margin: 0 },
  rCaptionInput: { textAlign: 'left', minHeight: 60, textAlignVertical: 'top' },
  rCharCount: { fontFamily: mono, fontSize: 9, color: '#8C846F', textAlign: 'right' },

  rTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rTagChip: { backgroundColor: '#F2F0EA', borderWidth: 1, borderColor: '#D8D2C3', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10 },
  rTagChipText: { fontFamily: mono, fontSize: 11, fontWeight: '700', color: '#2B271E', letterSpacing: 0.5 },
  rTagInput: { fontFamily: mono, fontSize: 13, color: '#2B271E', padding: 0, margin: 0 },
  rSuggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rSuggestChip: { borderWidth: 1, borderColor: '#D8D2C3', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10 },
  rSuggestChipText: { fontFamily: mono, fontSize: 11, fontWeight: '700', color: '#8C846F' },

  dashedLine: { fontFamily: mono, fontSize: 12, color: '#B8AF9A', marginVertical: 8 },
  rLoggedLabel: { fontFamily: mono, fontSize: 12.5, fontWeight: '700', color: '#2B271E', letterSpacing: 1 },
  rLoggedVal: { fontFamily: mono, fontSize: 13, fontWeight: '700', color: '#2B271E' },
  rStars: { textAlign: 'center', color: '#8C846F', fontSize: 12, letterSpacing: 2, marginTop: 12 },
  rFooter: { fontFamily: mono, fontSize: 12, fontWeight: '700', color: '#2B271E', textAlign: 'center', letterSpacing: 2, marginTop: 8 },
  rFooterSub: { fontFamily: mono, fontSize: 9, color: '#8C846F', textAlign: 'center', letterSpacing: 1, marginTop: 4 },
  barcode: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginTop: 16 },
  rBarcodeText: { fontFamily: mono, fontSize: 11, color: '#2B271E', textAlign: 'center', letterSpacing: 2, marginTop: 6 },
  zigRow: { height: 9, flexDirection: 'row', overflow: 'hidden' },
  toothUp: {
    width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#FFFFFF',
  },
  toothDown: {
    width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderTopWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFFFFF',
  },

  submitBtn: { marginTop: 22, backgroundColor: '#F2F0EA', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  submitBtnText: { color: '#1A1A1A', fontSize: 15, fontWeight: '600' },
});
