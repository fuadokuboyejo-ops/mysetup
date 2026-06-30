import { useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { addSetupItem } from '../config/setup';
import { API_BASE } from '../config/api';

export default function ResultsScreen({ items: product, photoUri, photoBase64, onScanAgain, onViewSetup }) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const handleAddToSetup = async () => {
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE}/api/remove-bg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: photoBase64 }),
      });
      if (!res.ok) throw new Error('Background removal failed');
      const data = await res.json();
      await addSetupItem(product, data.image);
      setAdded(true);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setAdding(false);
    }
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

  return (
    <View style={styles.container}>
      <Image source={{ uri: photoUri }} style={styles.thumbnail} resizeMode="cover" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            {product.brand && product.brand !== 'Unknown' && (
              <Text style={styles.brand}>{product.brand.toUpperCase()}</Text>
            )}
            <Text style={styles.productName}>{product.product_name}</Text>
            <Text style={styles.category}>{product.category}</Text>
          </View>
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>{Math.round(product.confidence * 100)}%</Text>
            <Text style={styles.confidenceLabel}>match</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dimensions</Text>
          <View style={styles.dimsRow}>
            <DimBox label="W" value={dims?.width} unit={dims?.unit} />
            <DimBox label="H" value={dims?.height} unit={dims?.unit} />
            <DimBox label="D" value={dims?.depth} unit={dims?.unit} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Colors</Text>
          <View style={styles.pillsRow}>
            {(product.primary_colors || []).map((c, i) => (
              <View key={i} style={styles.pill}><Text style={styles.pillText}>{c}</Text></View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Materials</Text>
          <View style={styles.pillsRow}>
            {(product.materials || []).map((m, i) => (
              <View key={i} style={styles.pill}><Text style={styles.pillText}>{m}</Text></View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Surface</Text>
          <Text style={styles.bodyText}>{product.surface_texture}</Text>
        </View>

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
              <Text style={styles.addText}>+ Add to My Setup</Text>
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
      </ScrollView>
    </View>
  );
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
  confidenceText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  confidenceLabel: { color: '#666', fontSize: 10 },

  section: { gap: 8 },
  sectionTitle: { color: '#888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  bodyText: { color: '#ccc', fontSize: 14, lineHeight: 20 },

  dimsRow: { flexDirection: 'row', gap: 10 },
  dimBox: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 12,
    padding: 14, alignItems: 'center', gap: 2,
  },
  dimLabel: { color: '#555', fontSize: 11, fontWeight: '700' },
  dimValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dimUnit: { color: '#555', fontSize: 10 },

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
