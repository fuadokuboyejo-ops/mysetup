import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

export const PRODUCT_GUIDES = {
  mouse:      { label: 'Mouse',     tip: 'side profile so the shape reads',      outline: 'portrait',  guide: 'Side profile so the shape reads. Steady, well-lit.' },
  monitor:    { label: 'Monitor',   tip: 'shoot straight-on, screen off',        outline: 'landscape', guide: 'Straight-on, screen off, fill the frame. Avoids glare & keystone.' },
  keyboard:   { label: 'Keyboard',  tip: 'top-down, slight tilt to show keys',   outline: 'landscape', guide: 'Top-down, slight tilt to show keys, on a plain surface.' },
  pc_tower:   { label: 'PC Tower',  tip: 'front 3/4 angle to show side panel',   outline: 'portrait',  guide: 'Front 3/4 angle to show the side panel & RGB.' },
  deskmat:    { label: 'Desk Mat',  tip: 'top-down, show the full mat',           outline: 'landscape', guide: 'Top-down shot, show the full mat on a plain desk.' },
  other:      { label: 'Other',     tip: 'center the item, good lighting',        outline: 'square',    guide: 'Center the item against a plain background with good lighting.' },
};

export default function ProductPickerScreen({ onSelect, onBack }) {
  const products = Object.entries(PRODUCT_GUIDES);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>What are you scanning?</Text>
        <Text style={styles.subtitle}>We'll guide you on how to photograph it</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {products.map(([key, product]) => (
          <TouchableOpacity
            key={key}
            style={styles.item}
            onPress={() => onSelect(key, product)}
            activeOpacity={0.75}
          >
            <View style={styles.itemInfo}>
              <Text style={styles.itemLabel}>{product.label}</Text>
              <Text style={styles.itemGuide} numberOfLines={1}>{product.guide}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e0e10' },

  header: {
    paddingTop: 64,
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 6,
  },
  backBtn: { marginBottom: 16 },
  backText: { color: '#a0a0a8', fontSize: 20 },
  title: { color: '#f5f5f7', fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#a0a0a8', fontSize: 14 },

  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },

  item: {
    backgroundColor: '#1a1a1d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2e2e32',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  itemInfo: { flex: 1, gap: 3 },
  itemLabel: { color: '#f5f5f7', fontSize: 16, fontWeight: '600' },
  itemGuide: { color: '#a0a0a8', fontSize: 12 },
  chevron: { color: '#a0a0a8', fontSize: 20 },
});
