import { useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
  TextInput, SafeAreaView,
} from 'react-native';
import { addSetupItem } from '../config/setup';
import { API_BASE } from '../config/api';

export default function ResultsScreen({ items: product, photoUri, photoBase64, setupId, onScanAgain, onViewSetup }) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  // Only the board cares about cutouts — save unconditionally so the item still
  // reaches the library either way, but remember whether it's a real cutout.
  const finishAdd = async (image, isCutout) => {
    try {
      await addSetupItem(setupId || 'default', product, image, isCutout);
      setAdded(true);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setAdding(false);
    }
  };

  const attemptCutout = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/remove-bg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: photoBase64 }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.image) return data.image;
      }
    } catch {
      // fall through to the retry/skip prompt below
    }
    return null;
  };

  const handleAddToSetup = async () => {
    setAdding(true);
    const cutImage = await attemptCutout();
    if (cutImage) {
      await finishAdd(cutImage, true);
      return;
    }
    // Background removal failed — some products (monitors/displays) fill the
    // frame with no isolated foreground, so remove.bg can't always cut them
    // out. Ask instead of silently keeping the raw photo: items without a
    // real cutout aren't placeable on the board until this succeeds.
    setAdding(false);
    Alert.alert(
      "Couldn't cut out background",
      'This item will still be saved to your library, but it needs a clean cutout before it can go on your board.',
      [
        { text: 'Try again', onPress: handleAddToSetup },
        { text: 'Save without cutout', onPress: () => { setAdding(true); finishAdd(photoBase64, false); } },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  if (!product) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>No product data returned.</Text>
        </View>
        <TouchableOpacity style={styles.againButton} onPress={onScanAgain}>
          <Text style={styles.againText}>Scan Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const dims = product.estimated_dimensions;
  const keyboardSpecs = product.keyboard_specs;
  const monitorSpecs = product.monitor_specs;
  const mouseSpecs = product.mouse_specs;
  const pcSpecs = product.pc_specs;
  const productText = `${product.product_name || ''} ${product.category || ''}`.toLowerCase();
  const isKeyboardResult = !!keyboardSpecs || productText.includes('keyboard');
  const isMonitorResult = !!monitorSpecs || productText.includes('monitor');
  const isMouseResult = !!mouseSpecs || product.category?.toLowerCase() === 'mouse';
  const isPcResult = !!pcSpecs || product.category?.toLowerCase() === 'pc';
  const manualResult = isKeyboardResult || isMonitorResult || isMouseResult || isPcResult;

  const detailRows = buildDetailRows(product, {
    isKeyboardResult, isMonitorResult, isMouseResult, isPcResult,
    keyboardSpecs, monitorSpecs, mouseSpecs, pcSpecs,
  });

  return (
    <SafeAreaView style={styles.container}>
      <Image source={{ uri: photoUri }} style={styles.thumbnail} resizeMode="cover" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            {!!product.brand && product.brand !== 'Unknown' && (
              <Text style={styles.brand}>{product.brand.toUpperCase()}</Text>
            )}
            <Text style={styles.productName}>{product.product_name}</Text>
            <Text style={styles.category}>{product.category}</Text>
          </View>
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>{manualResult ? 'Manual' : `${Math.round(product.confidence * 100)}%`}</Text>
            <Text style={styles.confidenceLabel}>{manualResult ? 'entry' : 'match'}</Text>
          </View>
        </View>

        {/* AI-scanned products keep the Dimensions boxes as a quick glance —
            everything else lives in the Details card below. Manual-entry types
            (keyboard/monitor/mouse/PC) skip this to avoid repeating the card. */}
        {!manualResult && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dimensions</Text>
            <View style={styles.dimsRow}>
              <DimBox label="W" value={dims?.width} unit={dims?.unit} />
              <DimBox label="H" value={dims?.height} unit={dims?.unit} />
              <DimBox label="D" value={dims?.depth} unit={dims?.unit} />
            </View>
          </View>
        )}

        {/* Add to Setup */}
        {!added ? (
          <TouchableOpacity
            style={[styles.addButton, adding && styles.buttonDisabled]}
            onPress={handleAddToSetup}
            disabled={adding}
            activeOpacity={0.85}
          >
            {adding ? (
              <View style={styles.row}>
                <ActivityIndicator color="#0F0F0F" size="small" />
                <Text style={styles.addText}>Adding to Setup…</Text>
              </View>
            ) : (
              <Text style={styles.addText}>{isKeyboardResult ? '+ Add Keyboard to My Setup' : '+ Add to My Setup'}</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.addedButton} onPress={onViewSetup} activeOpacity={0.85}>
            <Text style={styles.addedText}>✓ Added — View My Setup</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.againButton} onPress={onScanAgain} activeOpacity={0.85}>
          <Text style={styles.againText}>Scan Another Product</Text>
        </TouchableOpacity>

        {detailRows.length > 0 && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.detailsList}>
              {detailRows.map((r, i) => (
                <View
                  key={r.label}
                  style={[styles.detailRow, i < detailRows.length - 1 && styles.detailRowBorder]}
                >
                  <Text style={styles.detailLabel}>{r.label}</Text>
                  <Text style={styles.detailValue}>{r.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Build a labeled spec sheet from whatever fields the product actually has.
function buildDetailRows(product, ctx) {
  const { isKeyboardResult, isMonitorResult, isMouseResult, isPcResult,
    keyboardSpecs, monitorSpecs, mouseSpecs, pcSpecs } = ctx;
  const rows = [];
  const push = (label, value) => {
    if (value === undefined || value === null) return;
    const v = String(value).trim();
    if (v) rows.push({ label, value: v });
  };

  if (product.brand && product.brand !== 'Unknown') push('Brand', product.brand);
  push('Model', product.product_name);
  push('Category', product.category);

  if (isMouseResult && mouseSpecs) {
    if (mouseSpecs.weight) push('Weight', `${mouseSpecs.weight}g`);
    push('Connection', mouseSpecs.connection);
    push('DPI', mouseSpecs.dpi);
    push('Polling rate', mouseSpecs.polling);
    push('Sensor', mouseSpecs.sensor);
  } else if (isKeyboardResult && keyboardSpecs) {
    push('Size', keyboardSpecs.percentage);
    push('Switches', keyboardSpecs.switches);
    push('Layout', keyboardSpecs.layout);
  } else if (isMonitorResult && monitorSpecs) {
    if (monitorSpecs.inches) push('Size', `${monitorSpecs.inches}"`);
    if (monitorSpecs.hz) push('Refresh rate', `${monitorSpecs.hz}Hz`);
    push('Resolution', monitorSpecs.resolution);
    if (monitorSpecs.features?.length) push('Panel', monitorSpecs.features.join(' · '));
  } else if (isPcResult && pcSpecs) {
    push('CPU', pcSpecs.cpu);
    push('GPU', pcSpecs.gpu);
    push('Power supply', pcSpecs.psu);
    push('Motherboard', pcSpecs.motherboard);
    push('Case', pcSpecs.case);
    push('RGB', pcSpecs.rgb);
  } else {
    // AI-analyzed photo products (everything that isn't a manual-entry type).
    if (product.primary_colors?.length) push('Colors', product.primary_colors.join(', '));
    if (product.materials?.length) push('Materials', product.materials.join(', '));
    push('Surface', product.surface_texture);
  }

  return rows;
}

function DimBox({ label, value, unit }) {
  return (
    <View style={styles.dimBox}>
      <Text style={styles.dimLabel}>{label}</Text>
      <Text style={styles.dimValue}>{value ?? '—'}</Text>
      {unit && <Text style={styles.dimUnit}>{unit}</Text>}
    </View>
  );
}

function ManualField({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor="#666"
        autoCapitalize="words"
        autoCorrect={false}
      />
    </View>
  );
}

function QuickChip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.quickChip, selected && styles.quickChipSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.quickChipText, selected && styles.quickChipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  thumbnail: { width: '100%', height: 220, position: 'absolute', top: 0 },

  scroll: { flex: 1, marginTop: 200 },
  scrollContent: {
    backgroundColor: '#0F0F0F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 60,
    gap: 20,
  },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  brand: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 2 },
  productName: { color: '#fff', fontSize: 22, fontWeight: '800' },
  category: { color: '#666', fontSize: 13, marginTop: 2 },

  confidenceBadge: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  confidenceText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  confidenceLabel: { color: '#666', fontSize: 10 },

  section: { gap: 8 },
  sectionTitle: { color: '#888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  bodyText: { color: '#ccc', fontSize: 14, lineHeight: 20 },
  manualCard: {
    backgroundColor: '#171719',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2e2e32',
    padding: 14,
    gap: 14,
  },
  fieldGroup: { gap: 10 },
  field: { gap: 7 },
  fieldLabel: { color: '#888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: '#222226',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#34343a',
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: '#222226',
    borderWidth: 1,
    borderColor: '#34343a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipSelected: {
    backgroundColor: '#f5f5f7',
    borderColor: '#f5f5f7',
  },
  quickChipText: { color: '#b8b8be', fontSize: 13, fontWeight: '600' },
  quickChipTextSelected: { color: '#0F0F0F' },

  dimsRow: { flexDirection: 'row', gap: 10 },
  dimBox: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 12,
    padding: 14, alignItems: 'center', gap: 2,
  },
  dimLabel: { color: '#555', fontSize: 11, fontWeight: '700' },
  dimValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dimUnit: { color: '#555', fontSize: 10 },
  detailsCard: { backgroundColor: '#161616', borderRadius: 16, padding: 18, marginTop: 4, gap: 12 },
  detailsList: {},
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: '#242424' },
  detailLabel: { color: '#777', fontSize: 14 },
  detailValue: { color: '#fff', fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: 12 },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { backgroundColor: '#1A1A1A', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  pillText: { color: '#ccc', fontSize: 13 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  addButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  addedButton: {
    backgroundColor: '#1A3A1A',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d6a2d',
  },
  buttonDisabled: { opacity: 0.7 },
  addText: { color: '#0F0F0F', fontSize: 16, fontWeight: '700' },
  addedText: { color: '#4CAF50', fontSize: 16, fontWeight: '700' },

  againButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  againText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: '#aaa', fontSize: 16 },
});
