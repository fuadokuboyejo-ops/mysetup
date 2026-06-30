import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { getSetupItems, removeSetupItem } from '../config/setup';

export default function SetupScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await getSetupItems();
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRemove = (id, name) => {
    Alert.alert('Remove Item', `Remove ${name} from your setup?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await removeSetupItem(id);
          load();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Setup</Text>
        <Text style={styles.count}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>Your setup is empty</Text>
          <Text style={styles.emptyHint}>Scan a product and tap "Add to My Setup"</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {items.map(item => (
            <View key={item.id} style={styles.card}>
              <View style={styles.photoBox}>
                <Image
                  source={{ uri: `data:image/png;base64,${item.photoBase64}` }}
                  style={styles.photo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.cardInfo}>
                {item.product.brand && item.product.brand !== 'Unknown' && (
                  <Text style={styles.cardBrand}>{item.product.brand.toUpperCase()}</Text>
                )}
                <Text style={styles.cardName} numberOfLines={2}>{item.product.product_name}</Text>
                <Text style={styles.cardCategory}>{item.product.category}</Text>
              </View>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => handleRemove(item.id, item.product.product_name)}
              >
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },

  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    gap: 4,
  },
  backBtn: { marginBottom: 8 },
  backText: { color: '#888', fontSize: 15 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800' },
  count: { color: '#555', fontSize: 13 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: '#aaa', fontSize: 18, fontWeight: '600' },
  emptyHint: { color: '#555', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },

  grid: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photoBox: {
    width: 100,
    height: 100,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { width: 90, height: 90 },
  cardInfo: { flex: 1, padding: 14, gap: 3 },
  cardBrand: { color: '#666', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  cardName: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 19 },
  cardCategory: { color: '#555', fontSize: 12, marginTop: 2 },
  removeBtn: {
    padding: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#555', fontSize: 16 },
});
