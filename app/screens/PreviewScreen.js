import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SCAN_ENDPOINT } from '../config/api';

export default function PreviewScreen({ photoUri, photoBase64, onResults, onRetake }) {
  const [scanning, setScanning] = useState(false);

  const analyzeSetup = async () => {
    setScanning(true);
    try {
      const response = await fetch(SCAN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: photoBase64 }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(`Server error ${response.status}: ${errBody.details || errBody.error || 'unknown'}`);
      }

      const data = await response.json();
      onResults(data.product, photoUri);
    } catch (e) {
      Alert.alert('Scan Failed', e.message, [{ text: 'OK' }]);
    } finally {
      setScanning(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />

      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onRetake} style={styles.retakeButton} disabled={scanning}>
            <Text style={styles.retakeText}>← Retake</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPanel}>
          <Text style={styles.panelTitle}>Ready to scan</Text>
          <Text style={styles.panelSub}>We'll identify every item in your setup</Text>

          <TouchableOpacity
            style={[styles.analyzeButton, scanning && styles.analyzeDisabled]}
            onPress={analyzeSetup}
            disabled={scanning}
            activeOpacity={0.85}
          >
            {scanning ? (
              <View style={styles.scanningRow}>
                <ActivityIndicator color="#0F0F0F" size="small" />
                <Text style={styles.analyzeText}>Analyzing...</Text>
              </View>
            ) : (
              <Text style={styles.analyzeText}>Analyze Setup</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  preview: { flex: 1, width: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  retakeButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  retakeText: { color: '#fff', fontSize: 15, fontWeight: '500' },

  bottomPanel: {
    backgroundColor: 'rgba(15,15,15,0.92)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 48,
    gap: 8,
  },
  panelTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  panelSub: { color: '#888', fontSize: 14, marginBottom: 8 },

  analyzeButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 8,
  },
  analyzeDisabled: { opacity: 0.6 },
  analyzeText: { color: '#0F0F0F', fontSize: 16, fontWeight: '700' },
  scanningRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
