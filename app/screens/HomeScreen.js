import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';

export default function HomeScreen({ onStartScan, onViewSetup }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.hero}>
        <Text style={styles.logo}>⚙️</Text>
        <Text style={styles.title}>mysetup</Text>
        <Text style={styles.subtitle}>Scan your desk. Identify everything.</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.scanButton} onPress={onStartScan} activeOpacity={0.85}>
          <Text style={styles.scanButtonText}>Scan a Product</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.setupButton} onPress={onViewSetup} activeOpacity={0.85}>
          <Text style={styles.setupButtonText}>My Setup</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    justifyContent: 'space-between',
    paddingBottom: 60,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logo: { fontSize: 64 },
  title: { fontSize: 42, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1 },
  subtitle: { fontSize: 16, color: '#888', textAlign: 'center', paddingHorizontal: 40 },

  actions: { paddingHorizontal: 24, gap: 12 },
  scanButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  scanButtonText: { fontSize: 17, fontWeight: '700', color: '#0F0F0F' },
  setupButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  setupButtonText: { fontSize: 17, fontWeight: '600', color: '#fff' },
});
